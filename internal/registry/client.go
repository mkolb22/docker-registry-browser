package registry

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/mkolb22/docker-registry-browser/internal/config"
)

// Client is the Docker Registry V2 API client.
type Client struct {
	baseURL    string
	httpClient *http.Client
	config     *config.Config
	logger     *slog.Logger
}

// NewClient creates a new registry client with connection pooling and auth.
func NewClient(cfg *config.Config, logger *slog.Logger) (*Client, error) {
	tlsCfg := &tls.Config{
		InsecureSkipVerify: cfg.NoSSLVerification,
	}

	if cfg.CAFile != "" {
		caCert, err := os.ReadFile(cfg.CAFile)
		if err != nil {
			return nil, fmt.Errorf("reading CA file %q: %w", cfg.CAFile, err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificates from %q", cfg.CAFile)
		}
		tlsCfg.RootCAs = pool
	}

	baseTransport := &http.Transport{
		TLSClientConfig: tlsCfg,
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
	}

	auth := &authTransport{
		base:   baseTransport,
		cfg:    cfg,
		logger: logger,
	}

	return &Client{
		baseURL: cfg.RegistryURL,
		httpClient: &http.Client{
			Transport: auth,
			Timeout:   30 * time.Second,
		},
		config: cfg,
		logger: logger,
	}, nil
}
