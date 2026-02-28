package registry

import "testing"

func TestParseChallenge(t *testing.T) {
	tests := []struct {
		header string
		want   map[string]string
	}{
		{
			header: `Bearer realm="https://auth.example.com/token",service="registry.example.com",scope="repository:library/nginx:pull"`,
			want: map[string]string{
				"realm":   "https://auth.example.com/token",
				"service": "registry.example.com",
				"scope":   "repository:library/nginx:pull",
			},
		},
		{
			header: `Basic realm="Registry"`,
			want: map[string]string{
				"realm": "Registry",
			},
		},
		{
			header: `Bearer realm="https://auth.io/token"`,
			want: map[string]string{
				"realm": "https://auth.io/token",
			},
		},
	}

	for _, tt := range tests {
		got := parseChallenge(tt.header)
		for k, v := range tt.want {
			if got[k] != v {
				t.Errorf("parseChallenge(%q)[%q] = %q, want %q", tt.header, k, got[k], v)
			}
		}
	}
}

func TestSplitRespectingQuotes(t *testing.T) {
	input := `realm="https://example.com",service="registry",scope="repo:lib:pull"`
	parts := splitRespectingQuotes(input)
	if len(parts) != 3 {
		t.Fatalf("expected 3 parts, got %d: %v", len(parts), parts)
	}
}
