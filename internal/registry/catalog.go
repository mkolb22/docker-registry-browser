package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// Catalog fetches a page of repositories from the registry.
func (c *Client) Catalog(ctx context.Context, pageSize int, last string) (*CatalogPage, error) {
	url := fmt.Sprintf("%s/v2/_catalog?n=%d", c.baseURL, pageSize)
	if last != "" {
		url += "&last=" + last
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating catalog request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("catalog request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("catalog returned status %d", resp.StatusCode)
	}

	var result struct {
		Repositories []string `json:"repositories"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding catalog: %w", err)
	}

	repos := make([]Repository, 0, len(result.Repositories))
	for _, name := range result.Repositories {
		repos = append(repos, ParseRepository(name))
	}

	// Check Link header for pagination
	hasMore := false
	lastEntry := ""
	if link := resp.Header.Get("Link"); link != "" {
		hasMore = strings.Contains(link, `rel="next"`)
	}
	if len(result.Repositories) > 0 {
		lastEntry = result.Repositories[len(result.Repositories)-1]
	}

	return &CatalogPage{
		Repositories: repos,
		HasMore:      hasMore,
		LastEntry:    lastEntry,
	}, nil
}
