package cli

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mkolb22/docker-registry-browser/internal/api"
	"github.com/mkolb22/docker-registry-browser/internal/config"
	"github.com/mkolb22/docker-registry-browser/internal/registry"
	"github.com/spf13/cobra"
)

func newServeCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "serve",
		Short: "Start the registry browser web server",
		Long:  "Start the HTTP server serving the registry browser UI and API.",
		RunE:  runServe,
	}
}

func runServe(_ *cobra.Command, _ []string) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:     cfg.SlogLevel(),
		AddSource: cfg.LogLevel == "debug",
	}))

	logger.Info("starting registry-browser",
		"version", version,
		"commit", commit,
		"registry_url", cfg.RegistryURL,
		"port", cfg.Port,
	)

	client, err := registry.NewClient(cfg, logger)
	if err != nil {
		return fmt.Errorf("creating registry client: %w", err)
	}

	srv := api.NewServer(fmt.Sprintf(":%d", cfg.Port), api.ServerDeps{
		Client:  client,
		Config:  cfg,
		Logger:  logger,
		Version: version,
	})

	if err := srv.Start(); err != nil {
		return fmt.Errorf("starting server: %w", err)
	}

	logger.Info("server ready", "addr", fmt.Sprintf("http://0.0.0.0:%d", cfg.Port))

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	<-ctx.Done()
	logger.Info("shutting down")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Stop(shutdownCtx); err != nil {
		logger.Error("shutdown error", "error", err)
	}

	logger.Info("stopped")
	return nil
}
