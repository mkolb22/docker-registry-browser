package api

import (
	"log/slog"
	"net/http"

	"github.com/mkolb22/docker-registry-browser/internal/config"
	"github.com/mkolb22/docker-registry-browser/internal/registry"
)

type Handler struct {
	client  *registry.Client
	config  *config.Config
	logger  *slog.Logger
	version string
}

func (h *Handler) Healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) GetConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, ConfigResponse{
		DeleteEnabled:      h.config.DeleteEnabled,
		PublicRegistryURL:  h.config.PublicRegistryURL,
		CollapseNamespaces: h.config.CollapseNamespaces,
		DefaultSortBy:      h.config.SortTagsBy,
		DefaultSortOrder:   h.config.SortTagsOrder,
		Version:            h.version,
	})
}

func (h *Handler) ListRepositories(w http.ResponseWriter, r *http.Request) {
	pageSize := queryInt(r, "pageSize", h.config.CatalogPageSize)
	last := queryString(r, "last", "")

	page, err := h.client.Catalog(r.Context(), pageSize, last)
	if err != nil {
		h.logger.Error("listing repositories", "error", err)
		writeError(w, http.StatusBadGateway, "failed to list repositories: "+err.Error(), CodeInternalError)
		return
	}

	// Group by namespace
	namespaces := make(map[string][]registry.Repository)
	for _, repo := range page.Repositories {
		ns := repo.Namespace
		if ns == "" {
			ns = "_"
		}
		namespaces[ns] = append(namespaces[ns], repo)
	}

	writeJSON(w, http.StatusOK, CatalogResponse{
		Namespaces: namespaces,
		HasMore:    page.HasMore,
		LastEntry:  page.LastEntry,
	})
}

func (h *Handler) ListTags(w http.ResponseWriter, r *http.Request) {
	repo := queryString(r, "repo", "")
	if repo == "" {
		writeError(w, http.StatusBadRequest, "repo query parameter required", CodeBadRequest)
		return
	}

	sortBy := queryString(r, "sort", h.config.SortTagsBy)
	order := queryString(r, "order", h.config.SortTagsOrder)

	tagList, err := h.client.Tags(r.Context(), repo)
	if err != nil {
		h.logger.Error("listing tags", "repo", repo, "error", err)
		writeError(w, http.StatusBadGateway, "failed to list tags: "+err.Error(), CodeInternalError)
		return
	}

	sorted := registry.SortTags(tagList.Tags, sortBy, order)

	writeJSON(w, http.StatusOK, TagListResponse{
		Repository: repo,
		Tags:       sorted,
		Sort:       sortBy,
		Order:      order,
	})
}

func (h *Handler) GetTagDetail(w http.ResponseWriter, r *http.Request) {
	repo := queryString(r, "repo", "")
	tag := queryString(r, "tag", "")
	if repo == "" || tag == "" {
		writeError(w, http.StatusBadRequest, "repo and tag query parameters required", CodeBadRequest)
		return
	}

	detail, err := h.client.TagDetail(r.Context(), repo, tag)
	if err != nil {
		h.logger.Error("getting tag detail", "repo", repo, "tag", tag, "error", err)
		writeError(w, http.StatusBadGateway, "failed to get tag detail: "+err.Error(), CodeInternalError)
		return
	}

	writeJSON(w, http.StatusOK, detail)
}

func (h *Handler) DeleteTag(w http.ResponseWriter, r *http.Request) {
	if !h.config.DeleteEnabled {
		writeError(w, http.StatusForbidden, "image deletion is disabled", CodeForbidden)
		return
	}

	repo := queryString(r, "repo", "")
	tag := queryString(r, "tag", "")
	if repo == "" || tag == "" {
		writeError(w, http.StatusBadRequest, "repo and tag query parameters required", CodeBadRequest)
		return
	}

	// Get the content digest for this tag
	detail, err := h.client.TagDetail(r.Context(), repo, tag)
	if err != nil {
		h.logger.Error("getting tag for delete", "repo", repo, "tag", tag, "error", err)
		writeError(w, http.StatusBadGateway, "failed to resolve tag: "+err.Error(), CodeInternalError)
		return
	}

	if detail.ContentDigest == "" {
		writeError(w, http.StatusBadGateway, "no content digest for tag", CodeInternalError)
		return
	}

	if err := h.client.DeleteManifest(r.Context(), repo, detail.ContentDigest); err != nil {
		h.logger.Error("deleting tag", "repo", repo, "tag", tag, "digest", detail.ContentDigest, "error", err)
		writeError(w, http.StatusBadGateway, "failed to delete: "+err.Error(), CodeInternalError)
		return
	}

	h.logger.Info("tag deleted", "repo", repo, "tag", tag, "digest", detail.ContentDigest)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted", "repo": repo, "tag": tag})
}
