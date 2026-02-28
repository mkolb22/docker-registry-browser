package registry

import "testing"

func TestSortTags_Name(t *testing.T) {
	tags := []string{"beta", "alpha", "gamma", "1.0.0"}
	result := SortTags(tags, "name", "asc")
	expected := []string{"1.0.0", "alpha", "beta", "gamma"}
	if len(result) != len(expected) {
		t.Fatalf("expected %d tags, got %d", len(expected), len(result))
	}
	for i, v := range expected {
		if result[i] != v {
			t.Errorf("index %d: expected %q, got %q", i, v, result[i])
		}
	}
}

func TestSortTags_NameDesc(t *testing.T) {
	tags := []string{"beta", "alpha", "gamma"}
	result := SortTags(tags, "name", "desc")
	expected := []string{"gamma", "beta", "alpha"}
	for i, v := range expected {
		if result[i] != v {
			t.Errorf("index %d: expected %q, got %q", i, v, result[i])
		}
	}
}

func TestSortTags_Version(t *testing.T) {
	tags := []string{"v1.0.0", "v2.1.0", "v1.2.3", "v1.2.3-rc1", "latest", "v10.0.0"}
	result := SortTags(tags, "version", "asc")

	// latest (non-version) < v1.0.0 < v1.2.3-rc1 < v1.2.3 < v2.1.0 < v10.0.0
	expected := []string{"latest", "v1.0.0", "v1.2.3-rc1", "v1.2.3", "v2.1.0", "v10.0.0"}
	if len(result) != len(expected) {
		t.Fatalf("expected %d tags, got %d", len(expected), len(result))
	}
	for i, v := range expected {
		if result[i] != v {
			t.Errorf("index %d: expected %q, got %q", i, v, result[i])
		}
	}
}

func TestSortTags_API(t *testing.T) {
	tags := []string{"c", "a", "b"}
	result := SortTags(tags, "api", "asc")
	// API order preserves original
	expected := []string{"c", "a", "b"}
	for i, v := range expected {
		if result[i] != v {
			t.Errorf("index %d: expected %q, got %q", i, v, result[i])
		}
	}
}

func TestSortTags_DoesNotMutateInput(t *testing.T) {
	tags := []string{"b", "a", "c"}
	_ = SortTags(tags, "name", "asc")
	// Original should be unchanged
	if tags[0] != "b" || tags[1] != "a" || tags[2] != "c" {
		t.Errorf("original slice was mutated: %v", tags)
	}
}

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "2.0.0", -1},
		{"2.0.0", "1.0.0", 1},
		{"1.0.0", "1.0.0", 0},
		{"1.2.3", "1.2.4", -1},
		{"v1.0.0", "v1.0.1", -1},
		{"1.0.0-rc1", "1.0.0", -1},
		{"1.0.0", "1.0.0-rc1", 1},
		{"latest", "stable", -8}, // both non-version, lexicographic
		{"latest", "1.0.0", -1},  // non-version < version
		{"1.0.0", "latest", 1},
	}
	for _, tt := range tests {
		got := compareVersions(tt.a, tt.b)
		if (tt.want < 0 && got >= 0) || (tt.want > 0 && got <= 0) || (tt.want == 0 && got != 0) {
			t.Errorf("compareVersions(%q, %q) = %d, want sign of %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestParseRepository(t *testing.T) {
	tests := []struct {
		input     string
		namespace string
		image     string
	}{
		{"library/nginx", "library", "nginx"},
		{"nginx", "", "nginx"},
		{"org/sub/image", "org", "sub/image"},
	}
	for _, tt := range tests {
		r := ParseRepository(tt.input)
		if r.Namespace != tt.namespace {
			t.Errorf("ParseRepository(%q).Namespace = %q, want %q", tt.input, r.Namespace, tt.namespace)
		}
		if r.Image != tt.image {
			t.Errorf("ParseRepository(%q).Image = %q, want %q", tt.input, r.Image, tt.image)
		}
	}
}
