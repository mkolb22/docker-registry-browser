BINARY := registry-browser
PKG := github.com/mkolb22/docker-registry-browser
VERSION ?= dev
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS := -ldflags "-s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT)"

.PHONY: build test test-race lint clean docker fmt vet tidy

build:
	go build $(LDFLAGS) -o bin/$(BINARY) ./cmd/registry-browser

test:
	go test ./... -count=1

test-race:
	go test ./... -race -count=1

test-cover:
	go test ./... -coverprofile=coverage.out -count=1
	go tool cover -func=coverage.out

lint:
	golangci-lint run ./...

vet:
	go vet ./...

fmt:
	gofmt -s -w .

clean:
	rm -rf bin/ coverage.out

docker:
	docker build -t $(BINARY):$(VERSION) --build-arg VERSION=$(VERSION) --build-arg COMMIT=$(COMMIT) .

tidy:
	go mod tidy
