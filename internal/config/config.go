package config

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	RegistryURL        string `mapstructure:"registry_url"`
	PublicRegistryURL  string `mapstructure:"public_registry_url"`
	BasicAuthUser      string `mapstructure:"basic_auth_user"`
	BasicAuthPassword  string `mapstructure:"basic_auth_password"`
	TokenAuthUser      string `mapstructure:"token_auth_user"`
	TokenAuthPassword  string `mapstructure:"token_auth_password"`
	DeleteEnabled      bool   `mapstructure:"delete_enabled"`
	NoSSLVerification  bool   `mapstructure:"no_ssl_verification"`
	CAFile             string `mapstructure:"ca_file"`
	CollapseNamespaces bool   `mapstructure:"collapse_namespaces"`
	SortTagsBy         string `mapstructure:"sort_tags_by"`
	SortTagsOrder      string `mapstructure:"sort_tags_order"`
	CatalogPageSize    int    `mapstructure:"catalog_page_size"`
	Port               int    `mapstructure:"port"`
	LogLevel           string `mapstructure:"log_level"`
}

func (c *Config) Validate() error {
	if c.RegistryURL == "" {
		return fmt.Errorf("DOCKER_REGISTRY_URL must not be empty")
	}
	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("PORT must be 1-65535, got %d", c.Port)
	}
	if c.CatalogPageSize < 1 {
		return fmt.Errorf("CATALOG_PAGE_SIZE must be >= 1, got %d", c.CatalogPageSize)
	}
	validSort := map[string]bool{"api": true, "name": true, "version": true}
	if !validSort[c.SortTagsBy] {
		return fmt.Errorf("SORT_TAGS_BY must be api/name/version, got %q", c.SortTagsBy)
	}
	validOrder := map[string]bool{"asc": true, "desc": true}
	if !validOrder[c.SortTagsOrder] {
		return fmt.Errorf("SORT_TAGS_ORDER must be asc/desc, got %q", c.SortTagsOrder)
	}
	validLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}
	if !validLevels[c.LogLevel] {
		return fmt.Errorf("LOG_LEVEL must be debug/info/warn/error, got %q", c.LogLevel)
	}
	return nil
}

func (c *Config) SlogLevel() slog.Level {
	switch c.LogLevel {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func Load() (*Config, error) {
	v := viper.New()

	v.SetDefault("registry_url", "http://localhost:5000")
	v.SetDefault("public_registry_url", "")
	v.SetDefault("basic_auth_user", "")
	v.SetDefault("basic_auth_password", "")
	v.SetDefault("token_auth_user", "")
	v.SetDefault("token_auth_password", "")
	v.SetDefault("delete_enabled", false)
	v.SetDefault("no_ssl_verification", false)
	v.SetDefault("ca_file", "")
	v.SetDefault("collapse_namespaces", false)
	v.SetDefault("sort_tags_by", "name")
	v.SetDefault("sort_tags_order", "desc")
	v.SetDefault("catalog_page_size", 100)
	v.SetDefault("port", 8080)
	v.SetDefault("log_level", "info")

	// Bind env vars with exact upstream names (no prefix)
	_ = v.BindEnv("registry_url", "DOCKER_REGISTRY_URL")
	_ = v.BindEnv("public_registry_url", "PUBLIC_REGISTRY_URL")
	_ = v.BindEnv("basic_auth_user", "BASIC_AUTH_USER")
	_ = v.BindEnv("basic_auth_password", "BASIC_AUTH_PASSWORD")
	_ = v.BindEnv("token_auth_user", "TOKEN_AUTH_USER")
	_ = v.BindEnv("token_auth_password", "TOKEN_AUTH_PASSWORD")
	_ = v.BindEnv("delete_enabled", "ENABLE_DELETE_IMAGES")
	_ = v.BindEnv("no_ssl_verification", "NO_SSL_VERIFICATION")
	_ = v.BindEnv("ca_file", "CA_FILE")
	_ = v.BindEnv("collapse_namespaces", "ENABLE_COLLAPSE_NAMESPACES")
	_ = v.BindEnv("sort_tags_by", "SORT_TAGS_BY")
	_ = v.BindEnv("sort_tags_order", "SORT_TAGS_ORDER")
	_ = v.BindEnv("catalog_page_size", "CATALOG_PAGE_SIZE")
	_ = v.BindEnv("port", "PORT")
	_ = v.BindEnv("log_level", "LOG_LEVEL")

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshaling config: %w", err)
	}

	// Docker secrets override for credential fields
	cfg.BasicAuthUser = readSecret("BASIC_AUTH_USER", cfg.BasicAuthUser)
	cfg.BasicAuthPassword = readSecret("BASIC_AUTH_PASSWORD", cfg.BasicAuthPassword)
	cfg.TokenAuthUser = readSecret("TOKEN_AUTH_USER", cfg.TokenAuthUser)
	cfg.TokenAuthPassword = readSecret("TOKEN_AUTH_PASSWORD", cfg.TokenAuthPassword)

	// Normalize
	cfg.RegistryURL = strings.TrimRight(cfg.RegistryURL, "/")
	cfg.SortTagsBy = strings.ToLower(cfg.SortTagsBy)
	cfg.SortTagsOrder = strings.ToLower(cfg.SortTagsOrder)
	cfg.LogLevel = strings.ToLower(cfg.LogLevel)

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("validating config: %w", err)
	}

	return &cfg, nil
}

// readSecret checks /run/secrets/{name} first, then falls back to the provided default.
func readSecret(name, fallback string) string {
	path := filepath.Join("/run/secrets", name)
	data, err := os.ReadFile(path)
	if err != nil {
		return fallback
	}
	val := strings.TrimSpace(string(data))
	if val != "" {
		return val
	}
	return fallback
}
