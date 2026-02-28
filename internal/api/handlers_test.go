package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/mkolb22/docker-registry-browser/internal/config"
	"github.com/mkolb22/docker-registry-browser/internal/registry"
	"log/slog"
	"os"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
}

func testConfig() *config.Config {
	return &config.Config{
		RegistryURL:        "http://localhost:5000",
		DeleteEnabled:      true,
		CollapseNamespaces: false,
		SortTagsBy:         "name",
		SortTagsOrder:      "desc",
		CatalogPageSize:    100,
		Port:               8080,
		LogLevel:           "info",
	}
}

func TestHealthz(t *testing.T) {
	h := &Handler{
		config:  testConfig(),
		logger:  testLogger(),
		version: "test",
	}

	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	h.Healthz(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp["status"] != "ok" {
		t.Errorf("expected status=ok, got %q", resp["status"])
	}
}

func TestGetConfig(t *testing.T) {
	h := &Handler{
		config:  testConfig(),
		logger:  testLogger(),
		version: "1.0.0",
	}

	req := httptest.NewRequest("GET", "/api/v1/config", nil)
	w := httptest.NewRecorder()

	h.GetConfig(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp ConfigResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp.Version != "1.0.0" {
		t.Errorf("expected version 1.0.0, got %q", resp.Version)
	}
	if !resp.DeleteEnabled {
		t.Error("expected deleteEnabled=true")
	}
	if resp.DefaultSortBy != "name" {
		t.Errorf("expected sort=name, got %q", resp.DefaultSortBy)
	}
}

func TestListTags_MissingRepo(t *testing.T) {
	h := &Handler{
		config:  testConfig(),
		logger:  testLogger(),
		version: "test",
	}

	req := httptest.NewRequest("GET", "/api/v1/tags", nil)
	w := httptest.NewRecorder()

	h.ListTags(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestGetTagDetail_MissingParams(t *testing.T) {
	h := &Handler{
		config:  testConfig(),
		logger:  testLogger(),
		version: "test",
	}

	req := httptest.NewRequest("GET", "/api/v1/tag", nil)
	w := httptest.NewRecorder()

	h.GetTagDetail(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestDeleteTag_Disabled(t *testing.T) {
	cfg := testConfig()
	cfg.DeleteEnabled = false
	h := &Handler{
		config:  cfg,
		logger:  testLogger(),
		version: "test",
	}

	req := httptest.NewRequest("DELETE", "/api/v1/tag?repo=test&tag=v1", nil)
	w := httptest.NewRecorder()

	h.DeleteTag(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

// TestListRepositories_WithMockRegistry tests with a fake registry server
func TestListRepositories_WithMockRegistry(t *testing.T) {
	// Create mock registry
	mockRegistry := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/_catalog":
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"repositories": []string{"library/nginx", "library/redis", "myapp/api"},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockRegistry.Close()

	cfg := testConfig()
	cfg.RegistryURL = mockRegistry.URL

	client, err := registry.NewClient(cfg, testLogger())
	if err != nil {
		t.Fatalf("creating client: %v", err)
	}

	h := &Handler{
		client:  client,
		config:  cfg,
		logger:  testLogger(),
		version: "test",
	}

	// Create chi router for full integration test
	r := chi.NewRouter()
	r.Get("/api/v1/repositories", h.ListRepositories)

	req := httptest.NewRequest("GET", "/api/v1/repositories", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp CatalogResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if len(resp.Namespaces["library"]) != 2 {
		t.Errorf("expected 2 library repos, got %d", len(resp.Namespaces["library"]))
	}
	if len(resp.Namespaces["myapp"]) != 1 {
		t.Errorf("expected 1 myapp repo, got %d", len(resp.Namespaces["myapp"]))
	}
}

func TestListTags_WithMockRegistry(t *testing.T) {
	mockRegistry := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/library/nginx/tags/list" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"name": "library/nginx",
				"tags": []string{"latest", "1.25.0", "1.24.0", "1.25.1"},
			})
		} else {
			http.NotFound(w, r)
		}
	}))
	defer mockRegistry.Close()

	cfg := testConfig()
	cfg.RegistryURL = mockRegistry.URL

	client, err := registry.NewClient(cfg, testLogger())
	if err != nil {
		t.Fatalf("creating client: %v", err)
	}

	h := &Handler{
		client:  client,
		config:  cfg,
		logger:  testLogger(),
		version: "test",
	}

	req := httptest.NewRequest("GET", "/api/v1/tags?repo=library/nginx&sort=version&order=desc", nil)
	w := httptest.NewRecorder()
	h.ListTags(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp TagListResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if resp.Repository != "library/nginx" {
		t.Errorf("expected repo=library/nginx, got %q", resp.Repository)
	}
	if len(resp.Tags) != 4 {
		t.Errorf("expected 4 tags, got %d", len(resp.Tags))
	}
	// Version desc: 1.25.1 > 1.25.0 > 1.24.0 > latest
	if resp.Tags[0] != "1.25.1" {
		t.Errorf("expected first tag=1.25.1, got %q", resp.Tags[0])
	}
}

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusOK, map[string]string{"hello": "world"})

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json, got %q", ct)
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, http.StatusBadRequest, "bad input", CodeBadRequest)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}

	var resp ErrorResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp.Error != "bad input" {
		t.Errorf("expected error=bad input, got %q", resp.Error)
	}
	if resp.Code != CodeBadRequest {
		t.Errorf("expected code=BAD_REQUEST, got %q", resp.Code)
	}
}

func TestQueryInt(t *testing.T) {
	req := httptest.NewRequest("GET", "/?n=50", nil)
	if got := queryInt(req, "n", 100); got != 50 {
		t.Errorf("expected 50, got %d", got)
	}
	if got := queryInt(req, "missing", 100); got != 100 {
		t.Errorf("expected 100, got %d", got)
	}
}
