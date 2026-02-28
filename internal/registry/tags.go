package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Tags fetches the tag list for a repository.
func (c *Client) Tags(ctx context.Context, repo string) (*TagList, error) {
	url := fmt.Sprintf("%s/v2/%s/tags/list", c.baseURL, repo)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating tags request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tags request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return &TagList{Name: repo, Tags: nil}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tags returned status %d", resp.StatusCode)
	}

	var result TagList
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding tags: %w", err)
	}

	if result.Tags == nil {
		result.Tags = []string{}
	}

	return &result, nil
}

// SortTags sorts a tag list according to the given strategy and order.
func SortTags(tags []string, sortBy, order string) []string {
	sorted := make([]string, len(tags))
	copy(sorted, tags)

	switch sortBy {
	case "api":
		// Preserve API order, just reverse if desc
	case "version":
		sort.SliceStable(sorted, func(i, j int) bool {
			return compareVersions(sorted[i], sorted[j]) < 0
		})
	default: // "name"
		sort.Strings(sorted)
	}

	if order == "desc" {
		for i, j := 0, len(sorted)-1; i < j; i, j = i+1, j-1 {
			sorted[i], sorted[j] = sorted[j], sorted[i]
		}
	}

	return sorted
}

var versionRegex = regexp.MustCompile(`^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)$`)

// compareVersions implements semver-aware comparison.
// Returns -1, 0, or 1 like strings.Compare.
func compareVersions(a, b string) int {
	am := versionRegex.FindStringSubmatch(a)
	bm := versionRegex.FindStringSubmatch(b)

	// If neither matches semver, fall back to lexicographic
	if am == nil && bm == nil {
		return strings.Compare(a, b)
	}
	// Version-like strings sort after non-version strings
	if am == nil {
		return -1
	}
	if bm == nil {
		return 1
	}

	// Compare major, minor, patch
	for i := 1; i <= 3; i++ {
		av := toInt(am[i])
		bv := toInt(bm[i])
		if av != bv {
			if av < bv {
				return -1
			}
			return 1
		}
	}

	// Compare suffix (pre-release)
	aSuffix := am[4]
	bSuffix := bm[4]
	if aSuffix == "" && bSuffix != "" {
		return 1 // No suffix (release) > with suffix (pre-release)
	}
	if aSuffix != "" && bSuffix == "" {
		return -1
	}
	return strings.Compare(aSuffix, bSuffix)
}

func toInt(s string) int {
	if s == "" {
		return 0
	}
	n, _ := strconv.Atoi(s)
	return n
}
