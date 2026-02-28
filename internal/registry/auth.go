package registry

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"

	"github.com/mkolb22/docker-registry-browser/internal/config"
)

// authTransport handles Registry V2 authentication at the transport level.
// It supports both Basic auth and Bearer token auth with WWW-Authenticate challenges.
type authTransport struct {
	base   http.RoundTripper
	cfg    *config.Config
	logger *slog.Logger

	mu          sync.RWMutex
	cachedToken string
	cachedScope string
}

func (t *authTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Clone the request to avoid mutating the original
	r := req.Clone(req.Context())

	// Apply cached bearer token if available
	t.mu.RLock()
	token := t.cachedToken
	t.mu.RUnlock()

	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	} else if t.cfg.BasicAuthUser != "" {
		r.SetBasicAuth(t.cfg.BasicAuthUser, t.cfg.BasicAuthPassword)
	}

	resp, err := t.base.RoundTrip(r)
	if err != nil {
		return nil, err
	}

	// Handle 401 challenges
	if resp.StatusCode == http.StatusUnauthorized {
		challenge := resp.Header.Get("WWW-Authenticate")
		if strings.HasPrefix(strings.ToLower(challenge), "bearer ") {
			resp.Body.Close()

			newToken, err := t.exchangeToken(challenge)
			if err != nil {
				return nil, fmt.Errorf("token exchange: %w", err)
			}

			// Cache the token
			t.mu.Lock()
			t.cachedToken = newToken
			t.mu.Unlock()

			// Retry with new token
			retry := req.Clone(req.Context())
			retry.Header.Set("Authorization", "Bearer "+newToken)
			return t.base.RoundTrip(retry)
		}
	}

	return resp, nil
}

// exchangeToken parses a WWW-Authenticate challenge and exchanges credentials for a bearer token.
func (t *authTransport) exchangeToken(challenge string) (string, error) {
	params := parseChallenge(challenge)
	realm := params["realm"]
	if realm == "" {
		return "", fmt.Errorf("no realm in WWW-Authenticate challenge")
	}

	req, err := http.NewRequest("GET", realm, nil)
	if err != nil {
		return "", fmt.Errorf("creating token request: %w", err)
	}

	q := req.URL.Query()
	if svc := params["service"]; svc != "" {
		q.Set("service", svc)
	}
	if scope := params["scope"]; scope != "" {
		q.Set("scope", scope)
	}
	q.Set("client_id", "docker-registry-browser")
	req.URL.RawQuery = q.Encode()

	// Use token auth creds if available, otherwise basic auth creds
	user := t.cfg.TokenAuthUser
	pass := t.cfg.TokenAuthPassword
	if user == "" {
		user = t.cfg.BasicAuthUser
		pass = t.cfg.BasicAuthPassword
	}
	if user != "" {
		req.SetBasicAuth(user, pass)
	}

	t.logger.Debug("exchanging token", "realm", realm, "service", params["service"], "scope", params["scope"])

	resp, err := t.base.RoundTrip(req)
	if err != nil {
		return "", fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token request returned status %d", resp.StatusCode)
	}

	var tokenResp struct {
		Token       string `json:"token"`
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("decoding token response: %w", err)
	}

	token := tokenResp.Token
	if token == "" {
		token = tokenResp.AccessToken
	}
	if token == "" {
		return "", fmt.Errorf("no token in response")
	}

	return token, nil
}

// parseChallenge parses a WWW-Authenticate header value like:
// Bearer realm="https://auth.example.com/token",service="registry",scope="repository:lib:pull"
func parseChallenge(header string) map[string]string {
	params := make(map[string]string)

	// Strip scheme prefix
	idx := strings.IndexByte(header, ' ')
	if idx < 0 {
		return params
	}
	rest := header[idx+1:]

	for _, part := range splitRespectingQuotes(rest) {
		part = strings.TrimSpace(part)
		eqIdx := strings.IndexByte(part, '=')
		if eqIdx < 0 {
			continue
		}
		key := strings.TrimSpace(part[:eqIdx])
		val := strings.TrimSpace(part[eqIdx+1:])
		val = strings.Trim(val, `"`)
		params[key] = val
	}

	return params
}

// splitRespectingQuotes splits on commas but respects quoted strings.
func splitRespectingQuotes(s string) []string {
	var parts []string
	var current strings.Builder
	inQuotes := false

	for _, ch := range s {
		switch {
		case ch == '"':
			inQuotes = !inQuotes
			current.WriteRune(ch)
		case ch == ',' && !inQuotes:
			parts = append(parts, current.String())
			current.Reset()
		default:
			current.WriteRune(ch)
		}
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}
