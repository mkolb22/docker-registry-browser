# Docker Registry Browser

A lightweight web interface for the [Docker Registry HTTP API V2](https://distribution.github.io/distribution/spec/api/), written in Go.

Designed as a drop-in replacement for [klausmeyer/docker-registry-browser](https://github.com/klausmeyer/docker-registry-browser) with a fraction of the memory footprint (~5–15 MB vs 150–500 MB).

## Features

- Browse repositories and tags in any Docker Registry V2 / OCI Distribution registry
- Tag detail view: layers, history, runtime config (entrypoint, cmd, ports, volumes, healthcheck)
- Dockerfile reconstruction from image history
- Search/filter with highlight matching on all list pages
- Image freshness indicators (age-based color coding)
- Digest deduplication — tags sharing the same manifest are visually grouped
- Tag comparison — side-by-side layer diff between two tags
- Multi-arch platform constellation view for manifest lists
- Registry dashboard with aggregate stats and top-N charts
- Layer reuse heatmap across tags
- OCI referrer badges (cosign signatures, SBOMs, attestations) for OCI 1.1 registries
- Glassmorphism dark theme with particle network background
- No database, no sessions, no SECRET_KEY_BASE — stateless single binary

## Usage

### Docker

```shell
docker run --name registry-browser \
  -e DOCKER_REGISTRY_URL=http://your-registry:5000 \
  -p 8080:8080 \
  mkolb22/docker-registry-browser
```

### Binary

```shell
DOCKER_REGISTRY_URL=http://your-registry:5000 registry-browser serve
```

## Configuration

All configuration is via environment variables.

| Variable | Default | Description |
|---|---|---|
| `DOCKER_REGISTRY_URL` | `http://localhost:5000` | Registry base URL (required) |
| `PUBLIC_REGISTRY_URL` | _(empty)_ | URL shown to users for pull commands (if different from above) |
| `BASIC_AUTH_USER` | _(empty)_ | HTTP Basic Auth username |
| `BASIC_AUTH_PASSWORD` | _(empty)_ | HTTP Basic Auth password |
| `TOKEN_AUTH_USER` | _(empty)_ | Token auth username |
| `TOKEN_AUTH_PASSWORD` | _(empty)_ | Token auth password |
| `ENABLE_DELETE_IMAGES` | `false` | Enable tag deletion UI |
| `NO_SSL_VERIFICATION` | `false` | Skip TLS certificate verification |
| `CA_FILE` | _(empty)_ | Path to custom CA certificate |
| `ENABLE_COLLAPSE_NAMESPACES` | `false` | Collapse nested namespaces in repo list |
| `SORT_TAGS_BY` | `name` | Sort tags by: `api`, `name`, `version` |
| `SORT_TAGS_ORDER` | `desc` | Sort direction: `asc`, `desc` |
| `CATALOG_PAGE_SIZE` | `100` | Number of repositories per page |
| `PORT` | `8080` | HTTP listen port |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

Credentials can also be supplied via Docker secrets at `/run/secrets/{VARIABLE_NAME}`.

## Building from Source

```shell
git clone https://github.com/mkolb22/docker-registry-browser
cd docker-registry-browser
go build -o registry-browser ./cmd/registry-browser
./registry-browser serve
```

## License

MIT
