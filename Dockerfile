FROM golang:1.24-alpine AS builder

ARG VERSION=dev
ARG COMMIT=unknown

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
    -o /registry-browser ./cmd/registry-browser

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /registry-browser /usr/local/bin/registry-browser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=5s \
    CMD wget -q --spider http://localhost:8080/healthz || exit 1

ENTRYPOINT ["registry-browser"]
CMD ["serve"]
