package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mkolb22/docker-registry-browser/internal/registry"
)

const (
	CodeBadRequest    = "BAD_REQUEST"
	CodeNotFound      = "NOT_FOUND"
	CodeInternalError = "INTERNAL_ERROR"
	CodeForbidden     = "FORBIDDEN"
)

const maxRequestBody = 1 << 20 // 1 MB

type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

type ConfigResponse struct {
	DeleteEnabled      bool   `json:"deleteEnabled"`
	PublicRegistryURL  string `json:"publicRegistryURL"`
	CollapseNamespaces bool   `json:"collapseNamespaces"`
	DefaultSortBy      string `json:"defaultSortBy"`
	DefaultSortOrder   string `json:"defaultSortOrder"`
	Version            string `json:"version"`
}

type CatalogResponse struct {
	Namespaces map[string][]registry.Repository `json:"namespaces"`
	HasMore    bool                             `json:"hasMore"`
	LastEntry  string                           `json:"lastEntry"`
}

type TagListResponse struct {
	Repository string   `json:"repository"`
	Tags       []string `json:"tags"`
	Sort       string   `json:"sort"`
	Order      string   `json:"order"`
}

type TagDigestsResponse struct {
	Repository string            `json:"repository"`
	Digests    map[string]string `json:"digests"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: msg, Code: code})
}

func queryString(r *http.Request, key, defaultVal string) string {
	v := r.URL.Query().Get(key)
	if v == "" {
		return defaultVal
	}
	return v
}

func queryInt(r *http.Request, key string, defaultVal int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return defaultVal
	}
	return n
}
