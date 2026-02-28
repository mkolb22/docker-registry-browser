package registry

import (
	"fmt"
	"strings"
	"time"
)

// Repository represents a Docker image repository.
type Repository struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Image     string `json:"image"`
}

// CatalogPage is a page of repositories from the catalog.
type CatalogPage struct {
	Repositories []Repository `json:"repositories"`
	HasMore      bool         `json:"hasMore"`
	LastEntry    string       `json:"lastEntry"`
}

// TagList is the list of tags for a repository.
type TagList struct {
	Name string   `json:"name"`
	Tags []string `json:"tags"`
}

// TagDetail is the full manifest detail for a specific tag.
type TagDetail struct {
	Repository    string     `json:"repository"`
	Tag           string     `json:"tag"`
	ContentDigest string     `json:"contentDigest"`
	Manifests     []Manifest `json:"manifests"`
}

// Manifest represents a single platform manifest.
type Manifest struct {
	Architecture  string         `json:"architecture"`
	OS            string         `json:"os"`
	Variant       string         `json:"variant,omitempty"`
	ContentDigest string         `json:"contentDigest"`
	Created       *time.Time     `json:"created,omitempty"`
	Size          int64          `json:"size"`
	Env           []string       `json:"env,omitempty"`
	Labels        map[string]string `json:"labels,omitempty"`
	History       []HistoryEntry `json:"history,omitempty"`
	Layers        []Layer        `json:"layers"`
}

// DisplayName returns a human-readable name like "linux/amd64" or "linux/arm64/v8".
func (m *Manifest) DisplayName() string {
	name := m.OS + "/" + m.Architecture
	if m.Variant != "" {
		name += "/" + m.Variant
	}
	return name
}

// ID returns a short identifier for tab selection.
func (m *Manifest) ID() string {
	id := m.Architecture
	if m.Variant != "" {
		id += "-" + m.Variant
	}
	return id
}

// Layer represents a single image layer.
type Layer struct {
	Index  int    `json:"index"`
	Digest string `json:"digest"`
	Size   int64  `json:"size"`
}

// HistoryEntry represents a build history step.
type HistoryEntry struct {
	Created   *time.Time `json:"created,omitempty"`
	CreatedBy string     `json:"createdBy"`
	Comment   string     `json:"comment,omitempty"`
	EmptyLayer bool      `json:"emptyLayer,omitempty"`
}

// ParseRepository splits a full repository name into namespace and image.
func ParseRepository(name string) Repository {
	parts := strings.SplitN(name, "/", 2)
	if len(parts) == 2 {
		return Repository{Name: name, Namespace: parts[0], Image: parts[1]}
	}
	return Repository{Name: name, Namespace: "", Image: name}
}

// formatSize returns a human-readable byte size.
func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
