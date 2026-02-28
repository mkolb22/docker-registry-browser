package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"
)

const (
	mediaTypeManifestList   = "application/vnd.docker.distribution.manifest.list.v2+json"
	mediaTypeManifestV2     = "application/vnd.docker.distribution.manifest.v2+json"
	mediaTypeOCIIndex       = "application/vnd.oci.image.index.v1+json"
	mediaTypeOCIManifest    = "application/vnd.oci.image.manifest.v1+json"
	mediaTypeOCIConfig      = "application/vnd.oci.image.config.v1+json"
	mediaTypeDockerConfig   = "application/vnd.docker.container.image.v1+json"

	maxConcurrentFetches = 5
)

// acceptHeader is the Accept header for manifest requests, preferring manifest lists.
var acceptHeader = strings.Join([]string{
	mediaTypeOCIIndex,
	mediaTypeManifestList,
	mediaTypeOCIManifest,
	mediaTypeManifestV2,
}, ", ")

// TagDetail fetches the full manifest detail for a repository tag.
func (c *Client) TagDetail(ctx context.Context, repo, tag string) (*TagDetail, error) {
	url := fmt.Sprintf("%s/v2/%s/manifests/%s", c.baseURL, repo, tag)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating manifest request: %w", err)
	}
	req.Header.Set("Accept", acceptHeader)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("manifest request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("manifest returned status %d", resp.StatusCode)
	}

	contentDigest := resp.Header.Get("Docker-Content-Digest")
	contentType := resp.Header.Get("Content-Type")

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading manifest body: %w", err)
	}

	detail := &TagDetail{
		Repository:    repo,
		Tag:           tag,
		ContentDigest: contentDigest,
	}

	// Check if this is a manifest list (multi-arch)
	if isManifestList(contentType) {
		manifests, err := c.resolveManifestList(ctx, repo, body)
		if err != nil {
			return nil, fmt.Errorf("resolving manifest list: %w", err)
		}
		detail.Manifests = manifests
	} else {
		// Single manifest
		manifest, err := c.resolveManifest(ctx, repo, contentType, contentDigest, body)
		if err != nil {
			return nil, fmt.Errorf("resolving manifest: %w", err)
		}
		detail.Manifests = []Manifest{*manifest}
	}

	return detail, nil
}

// DeleteManifest deletes a manifest by digest.
func (c *Client) DeleteManifest(ctx context.Context, repo, digest string) error {
	url := fmt.Sprintf("%s/v2/%s/manifests/%s", c.baseURL, repo, digest)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("creating delete request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func isManifestList(contentType string) bool {
	return strings.Contains(contentType, "manifest.list") ||
		strings.Contains(contentType, "image.index")
}

// resolveManifestList processes a manifest list and fetches each platform manifest in parallel.
func (c *Client) resolveManifestList(ctx context.Context, repo string, body []byte) ([]Manifest, error) {
	var list struct {
		Manifests []struct {
			MediaType string `json:"mediaType"`
			Digest    string `json:"digest"`
			Size      int64  `json:"size"`
			Platform  struct {
				Architecture string `json:"architecture"`
				OS           string `json:"os"`
				Variant      string `json:"variant"`
			} `json:"platform"`
		} `json:"manifests"`
	}
	if err := json.Unmarshal(body, &list); err != nil {
		return nil, fmt.Errorf("decoding manifest list: %w", err)
	}

	// Filter out unknown/attestation entries
	type platformEntry struct {
		digest  string
		arch    string
		os      string
		variant string
	}
	var entries []platformEntry
	for _, m := range list.Manifests {
		if m.Platform.Architecture == "unknown" || m.Platform.OS == "unknown" {
			continue
		}
		entries = append(entries, platformEntry{
			digest:  m.Digest,
			arch:    m.Platform.Architecture,
			os:      m.Platform.OS,
			variant: m.Platform.Variant,
		})
	}

	if len(entries) == 0 {
		return nil, nil
	}

	// Fetch each platform manifest in parallel with bounded concurrency
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(maxConcurrentFetches)

	results := make([]Manifest, len(entries))
	for i, entry := range entries {
		g.Go(func() error {
			manifest, err := c.fetchPlatformManifest(ctx, repo, entry.digest)
			if err != nil {
				return fmt.Errorf("fetching %s/%s manifest: %w", entry.os, entry.arch, err)
			}
			manifest.Architecture = entry.arch
			manifest.OS = entry.os
			manifest.Variant = entry.variant
			results[i] = *manifest
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	// Sort by architecture name for consistent display
	sort.Slice(results, func(i, j int) bool {
		return results[i].DisplayName() < results[j].DisplayName()
	})

	return results, nil
}

// fetchPlatformManifest fetches a single platform's manifest and resolves its config blob.
func (c *Client) fetchPlatformManifest(ctx context.Context, repo, digest string) (*Manifest, error) {
	url := fmt.Sprintf("%s/v2/%s/manifests/%s", c.baseURL, repo, digest)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", strings.Join([]string{
		mediaTypeOCIManifest,
		mediaTypeManifestV2,
	}, ", "))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("manifest %s returned status %d", digest, resp.StatusCode)
	}

	contentDigest := resp.Header.Get("Docker-Content-Digest")
	if contentDigest == "" {
		contentDigest = digest
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return c.resolveManifest(ctx, repo, resp.Header.Get("Content-Type"), contentDigest, body)
}

// resolveManifest parses a manifest and fetches its config blob to extract metadata.
func (c *Client) resolveManifest(ctx context.Context, repo, contentType, contentDigest string, body []byte) (*Manifest, error) {
	var raw struct {
		Config struct {
			Digest string `json:"digest"`
		} `json:"config"`
		Layers []struct {
			Digest    string `json:"digest"`
			Size      int64  `json:"size"`
			MediaType string `json:"mediaType"`
		} `json:"layers"`
		// V1 compat
		FSLayers []struct {
			BlobSum string `json:"blobSum"`
		} `json:"fsLayers"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("decoding manifest: %w", err)
	}

	m := &Manifest{
		ContentDigest: contentDigest,
	}

	// Build layers
	if len(raw.Layers) > 0 {
		m.Layers = make([]Layer, len(raw.Layers))
		var totalSize int64
		for i, l := range raw.Layers {
			m.Layers[i] = Layer{Index: i, Digest: l.Digest, Size: l.Size}
			totalSize += l.Size
		}
		m.Size = totalSize
	} else if len(raw.FSLayers) > 0 {
		// V1 schema compat
		m.Layers = make([]Layer, len(raw.FSLayers))
		for i, l := range raw.FSLayers {
			m.Layers[i] = Layer{Index: i, Digest: l.BlobSum}
		}
	}

	// Fetch config blob for metadata
	if raw.Config.Digest != "" {
		if err := c.resolveConfigBlob(ctx, repo, raw.Config.Digest, m); err != nil {
			c.logger.Warn("failed to resolve config blob", "repo", repo, "digest", raw.Config.Digest, "error", err)
		}
	}

	return m, nil
}

// resolveConfigBlob fetches the image config blob and extracts metadata.
func (c *Client) resolveConfigBlob(ctx context.Context, repo, digest string, m *Manifest) error {
	url := fmt.Sprintf("%s/v2/%s/blobs/%s", c.baseURL, repo, digest)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("config blob returned status %d", resp.StatusCode)
	}

	var blob struct {
		Architecture string `json:"architecture"`
		OS           string `json:"os"`
		Variant      string `json:"variant"`
		Created      string `json:"created"`
		Config       struct {
			Env    []string          `json:"Env"`
			Labels map[string]string `json:"Labels"`
		} `json:"config"`
		History []struct {
			Created    string `json:"created"`
			CreatedBy  string `json:"created_by"`
			Comment    string `json:"comment"`
			EmptyLayer bool   `json:"empty_layer"`
		} `json:"history"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&blob); err != nil {
		return fmt.Errorf("decoding config blob: %w", err)
	}

	// Only set arch/os from blob if not already set (manifest list takes precedence)
	if m.Architecture == "" {
		m.Architecture = blob.Architecture
	}
	if m.OS == "" {
		m.OS = blob.OS
	}
	if m.Variant == "" && blob.Variant != "" {
		m.Variant = blob.Variant
	}

	if blob.Created != "" {
		if t, err := time.Parse(time.RFC3339Nano, blob.Created); err == nil {
			m.Created = &t
		}
	}

	m.Env = blob.Config.Env
	m.Labels = blob.Config.Labels

	m.History = make([]HistoryEntry, 0, len(blob.History))
	for _, h := range blob.History {
		entry := HistoryEntry{
			CreatedBy:  h.CreatedBy,
			Comment:    h.Comment,
			EmptyLayer: h.EmptyLayer,
		}
		if h.Created != "" {
			if t, err := time.Parse(time.RFC3339Nano, h.Created); err == nil {
				entry.Created = &t
			}
		}
		m.History = append(m.History, entry)
	}

	return nil
}
