package api

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/mkolb22/docker-registry-browser/internal/config"
	"github.com/mkolb22/docker-registry-browser/internal/registry"
)

//go:embed static/*
var staticFS embed.FS

type ServerDeps struct {
	Client  *registry.Client
	Config  *config.Config
	Logger  *slog.Logger
	Version string
}

type Server struct {
	httpServer *http.Server
	logger     *slog.Logger
}

func NewServer(addr string, deps ServerDeps) *Server {
	h := &Handler{
		client:  deps.Client,
		config:  deps.Config,
		logger:  deps.Logger,
		version: deps.Version,
	}

	router := chi.NewRouter()

	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(slogRequestLogger(deps.Logger))
	router.Use(middleware.Recoverer)
	router.Use(middleware.Timeout(30 * time.Second))

	// Health probe
	router.Get("/healthz", h.Healthz)

	// API routes
	router.Route("/api/v1", func(r chi.Router) {
		r.Get("/config", h.GetConfig)
		r.Get("/repositories", h.ListRepositories)
		r.Get("/tags", h.ListTags)
		r.Get("/tag", h.GetTagDetail)
		r.Delete("/tag", h.DeleteTag)
	})

	// SPA
	staticContent, _ := fs.Sub(staticFS, "static")
	fileServer := http.FileServer(http.FS(staticContent))

	router.Get("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ui/", http.StatusMovedPermanently)
	})
	uiHandler := spaHandler(staticContent, fileServer)
	router.Get("/ui", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ui/", http.StatusMovedPermanently)
	})
	router.Get("/ui/", uiHandler)
	router.Get("/ui/*", uiHandler)

	// Serve favicons at root
	router.Get("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		r2 := cloneRequest(r, "/favicon.ico")
		fileServer.ServeHTTP(w, r2)
	})

	return &Server{
		httpServer: &http.Server{
			Addr:              addr,
			Handler:           router,
			ReadHeaderTimeout: 10 * time.Second,
			ReadTimeout:       30 * time.Second,
			WriteTimeout:      60 * time.Second,
			IdleTimeout:       120 * time.Second,
		},
		logger: deps.Logger,
	}
}

func (s *Server) Start() error {
	s.logger.Info("starting API server", "addr", s.httpServer.Addr)
	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Error("API server error", "error", err)
		}
	}()
	return nil
}

func (s *Server) Stop(ctx context.Context) error {
	s.logger.Info("stopping API server")
	return s.httpServer.Shutdown(ctx)
}

func slogRequestLogger(logger *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			logger.Debug("http request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"duration", fmt.Sprintf("%.3fms", float64(time.Since(start).Microseconds())/1000),
				"bytes", ww.BytesWritten(),
			)
		})
	}
}

func spaHandler(staticContent fs.FS, fileServer http.Handler) http.HandlerFunc {
	// Pre-read index.html to avoid FileServer redirect behavior
	indexHTML, _ := fs.ReadFile(staticContent, "index.html")

	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if len(path) >= 4 {
			path = path[4:] // strip "/ui/"
		}

		if path == "" || path == "index.html" {
			serveIndex(w, indexHTML)
			return
		}

		// Try to open file
		if f, err := staticContent.Open(path); err == nil {
			f.Close()
			r2 := cloneRequest(r, "/"+path)
			fileServer.ServeHTTP(w, r2)
			return
		}

		// SPA fallback
		serveIndex(w, indexHTML)
	}
}

func serveIndex(w http.ResponseWriter, indexHTML []byte) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write(indexHTML)
}

func cloneRequest(r *http.Request, path string) *http.Request {
	r2 := new(http.Request)
	*r2 = *r
	r2.URL = new(url.URL)
	*r2.URL = *r.URL
	r2.URL.Path = path
	return r2
}
