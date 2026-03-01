# Enhanced UI Proposals

Proposals for new features and dynamic visualizations for the Docker Registry Browser. Each proposal lists what it does, why it matters, and how it would be implemented in vanilla JS + CSS (no framework dependencies).

---

## Tier 1: High Impact, Low Effort

These can be implemented quickly and dramatically improve the user experience.

### 1. Skeleton Loading States

**What:** Replace the centered spinner with gray pulsing placeholder shapes that match the actual content layout — repo list rows, tag rows, detail cards. A shimmer gradient sweeps across the skeletons.

**Why:** Reduces perceived load time dramatically. Prevents layout shift. Feels 2-3x faster than a spinner even when load time is identical.

**How:** CSS-only. Skeleton elements with `background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%)` animated with `@keyframes shimmer`. Three skeleton variants: `catalogSkeleton()`, `repoDetailSkeleton()`, `tagDetailSkeleton()`.

---

### 2. Page Transition Animations

**What:** Navigating between pages uses smooth CSS transitions. Content slides in from the right (forward) or fades in. List items stagger-animate, each appearing 30ms after the previous.

**Why:** Removes the jarring flash of new content that hash routing produces. Makes the app feel polished and native.

**How:** Wrap page renders in a container with `.page-enter` class (opacity 0, translateX(20px)). Use `requestAnimationFrame` to add `.page-enter-active` (opacity 1, translateX(0)). List items use `animation-delay: calc(var(--i) * 30ms)` set inline.

---

### 3. Image Freshness Indicators

**What:** Each tag in the repo detail list shows a colored dot indicating age: green (< 7 days), yellow (7-30 days), orange (30-90 days), red (> 90 days). Tooltip shows exact age.

**Why:** Stale images are a security risk. This makes it immediately obvious which images haven't been rebuilt. No other lightweight registry browser does this.

**How:** Requires a lightweight HEAD request per tag to get the manifest digest, then fetch the config blob's `created` timestamp. Could be done progressively (fetch in background, update dots as data arrives). Alternatively, batch-fetch on page load with a concurrency limit.

**Backend change:** New endpoint `GET /api/v1/tag-ages?repo=...` that returns `{tag: created_timestamp}` for all tags, fetched in parallel server-side.

---

### 4. Search/Filter with Fade (Not Hide)

**What:** A search input at the top of repo and tag lists. As the user types, non-matching items fade to 20% opacity instead of disappearing. Matching text is highlighted in accent color.

**Why:** Faster navigation in large registries. The fade-rather-than-hide approach preserves spatial context — items don't jump around, so the user's mental model of the list stays intact.

**How:** JS `input` event listener. Each list item gets `.filtered-out` class (opacity 0.2, pointer-events none) for non-matches. Use `String.replace()` with regex to wrap matches in `<mark>` tags.

---

### 5. Dockerfile Reconstruction View

**What:** In the History section, instead of showing raw `created_by` strings, parse them into reconstructed Dockerfile syntax with keyword highlighting. Each line shows its associated layer size as a right-aligned annotation. Lines that don't create layers (ENV, LABEL, EXPOSE) are visually dimmed.

**Why:** Raw history commands are hard to read (`/bin/sh -c #(nop)  ENV PATH=/usr/local/sbin:...`). Reconstructing them into familiar `ENV PATH=/usr/local/sbin:...` is immediately useful.

**How:** Regex to strip `/bin/sh -c #(nop)` prefixes. Syntax highlighting: instruction keywords (`FROM`, `RUN`, `COPY`, `ENV`, `LABEL`, `EXPOSE`, `CMD`, `ENTRYPOINT`, `WORKDIR`, `ARG`, `VOLUME`, `USER`, `HEALTHCHECK`) in accent color, arguments in primary text color, strings in green. Right-align size with `display: flex; justify-content: space-between`.

---

### 6. Copy Confirmation Animation

**What:** When clicking "Copy" on the pull command, the button text morphs to a checkmark with a brief green flash, then fades back after 1.5s.

**Why:** Clear inline feedback without a toast notification. Small touch that feels polished.

**How:** JS swaps button innerHTML to "Copied!", adds `.copied` class (green background, scale pulse), removes after 1.5s.

---

## Tier 2: High Impact, Medium Effort

These require more work but add significant new capabilities.

### 7. Digest Deduplication Map

**What:** In the tag list view, tags that resolve to the same manifest digest are visually grouped with a colored left border and a badge showing "= tagA, tagB" indicating they point to the same image.

**Why:** Prevents users from thinking they have 10 different images when they really have 3 unique images with multiple tag aliases. Common source of confusion and wasted storage investigation.

**How:** After fetching tag list, make HEAD requests for each tag's manifest to get digests (lightweight — no body download). Group tags by digest. Render colored `border-left: 3px solid <color>` matching digest group. Show count badge.

**Backend change:** New endpoint `GET /api/v1/tag-digests?repo=...` returns `{tag: digest}` map for all tags. Uses `HEAD /v2/{repo}/manifests/{tag}` with `Docker-Content-Digest` header.

---

### 8. Glassmorphism Theme Upgrade

**What:** Cards get `backdrop-filter: blur(12px)` with semi-transparent backgrounds. A subtle animated gradient background (slowly shifting cyan/purple/blue orbs) sits behind the content. Cards cast soft colored glow shadows. Active elements get animated gradient borders.

**Why:** Elevates the existing dark theme from utilitarian to premium. The design tokens are already in place — this is a CSS-only upgrade.

**How:**
- Cards: `background: rgba(33, 37, 43, 0.7)`, `backdrop-filter: blur(12px)`, `box-shadow: 0 0 20px rgba(82, 139, 255, 0.08)`
- Background: Fixed `<div>` with `@keyframes` animated `radial-gradient` orbs
- Active borders: CSS `@property --angle` registered as `<angle>`, animated 0-360deg, applied via `border-image: conic-gradient(from var(--angle), ...)`
- Toggle: Respect `prefers-reduced-motion` media query

---

### 9. Unexposed Config Fields

**What:** Display additional image config fields that are already in the registry blob but not currently parsed: Entrypoint, Cmd, WorkingDir, ExposedPorts, Volumes, User, Healthcheck, StopSignal.

**Why:** Users currently have to `docker inspect` to see these. Showing them in the browser eliminates a context switch and makes the browser the single source of truth for image metadata.

**How:**
- Backend: Extend `resolveConfigBlob()` in `manifests.go` to parse these additional fields from the config JSON
- Add fields to `Manifest` struct in `types.go`
- Frontend: New sections in `manifestPanel()` — "Runtime Config" card showing Entrypoint, Cmd, WorkingDir, User, StopSignal; "Networking" card showing ExposedPorts; "Storage" card showing Volumes; "Health Check" card if healthcheck is configured

---

### 10. Platform Constellation Map

**What:** For multi-arch images, replace the tab bar with a visual node graph. Center node = tag name, orbital nodes = each platform (linux/amd64, linux/arm64, etc.). Lines connect center to platforms. Each node shows size and a color ring for freshness. Clicking a platform node expands its details below.

**Why:** Multi-arch is increasingly the norm (Docker official images have 8+ platforms). Tabs don't scale well past 4-5 entries. A visual map makes the relationship between manifest list and child manifests intuitive.

**How:** SVG rendering. Central circle at (cx, cy). Platform nodes positioned with `Math.cos/sin(angle)` at equal intervals around the center. SVG `<line>` for connections, `<circle>` + `<text>` for nodes. CSS `animation: fadeIn 0.3s ease calc(var(--i) * 100ms)` for staggered entrance. Click handler swaps displayed manifest panel.

---

### 11. Tag Comparison (Diff Two Tags)

**What:** Select two tags and see a side-by-side diff: which layers they share (by digest), which are unique to each, total size delta, and a visual diff bar (+12MB added, -3MB removed).

**Why:** Essential for release management. "What changed between v1.2.3 and v1.3.0?" is a question every team asks.

**How:** Two-column layout. Fetch manifests for both tags. Compute layer intersection by digest. Render shared layers centered, unique layers offset left/right with green (added) and red (removed) coloring. Summary card shows total delta.

---

## Tier 3: Ambitious / Stretch

These are larger features that would set the browser apart from all alternatives.

### 12. Registry Overview Dashboard

**What:** A top-level dashboard (new route `#/dashboard`) showing aggregate stats: total repositories, total tags, total unique images (by digest), total storage, largest images (top 5 bar chart), most-tagged repos, recently updated images. Numbers animate in with a counting-up effect.

**Why:** No lightweight registry browser has an overview dashboard. Administrators need at-a-glance registry health. This would be the "home page" differentiator.

**How:** Vanilla JS fetches catalog, then batch-fetches tag counts and manifest sizes. CSS Grid card layout. Numbers animate with `requestAnimationFrame` counting loop. Horizontal bar charts are `<div>` elements with percentage widths. Cache results in `sessionStorage` with 5-minute TTL.

**Backend change:** New endpoint `GET /api/v1/stats` that aggregates across all repos (computed server-side with parallel fetches + caching).

---

### 13. Layer Reuse Heatmap

**What:** A grid visualization where rows are tags and columns are layer positions. Cell color intensity indicates how many tags share that layer's digest. Hot = shared by many tags, cold = unique to one tag.

**Why:** Reveals Docker build cache efficiency. If all tags share base layers, the cache is working. If every tag has completely unique layers, something is wrong with the Dockerfile structure or build process.

**How:** Fetch all tag manifests, build `Map<digest, Set<tag>>`. CSS Grid where cell background uses `hsl(200, 80%, calc(20% + sharing_pct * 60%))`. Clicking a cell highlights all tags sharing that layer.

---

### 14. OCI Referrers API (Signatures & SBOMs)

**What:** For registries that support OCI Distribution 1.1, query `GET /v2/{name}/referrers/{digest}` to discover cosign signatures, SBOMs (Software Bill of Materials), and attestations attached to an image. Display them as badges on the tag detail page: "Signed", "SBOM Available", "Provenance Attested".

**Why:** Supply chain security is the top concern in container registries. Showing whether an image is signed and has an SBOM is critical for compliance.

**How:**
- Backend: New method `Referrers(ctx, repo, digest)` calling the referrers API. Parse `artifactType` field to identify signatures vs SBOMs vs attestations.
- Frontend: Badges on tag detail header. Expandable section showing referrer details (signer identity, SBOM format, attestation chain).
- Graceful degradation: If the registry returns 404 for referrers, hide the section silently.

---

### 15. Subtle Particle Network Background

**What:** Very faint, slowly drifting dots on the page background connected by thin lines when close together (network/mesh pattern). Docker-blue color at 3-5% opacity. Responds subtly to mouse movement (nearest particles drift toward cursor).

**Why:** Adds a "living" quality that evokes the container/network metaphor. Distinguishes the app from every other registry browser. Must be extremely subtle — decoration, not distraction.

**How:** `<canvas>` with `position: fixed; z-index: -1`. ~25 particles with `requestAnimationFrame` loop. Basic physics: velocity, boundary bounce, proximity-based line drawing. Mouse interaction via `mousemove` event. Respect `prefers-reduced-motion` — disable if set. ~60 lines of vanilla JS.

---

## Implementation Priority

If implementing these incrementally, this order maximizes impact per effort:

| Order | Proposal | Effort | Impact |
|-------|----------|--------|--------|
| 1 | Skeleton Loading (1) | Small | High — instant polish |
| 2 | Search/Filter (4) | Small | High — essential for usability |
| 3 | Dockerfile Reconstruction (5) | Small | High — huge readability win |
| 4 | Copy Animation (6) | Tiny | Medium — micro-polish |
| 5 | Freshness Indicators (3) | Medium | High — unique feature |
| 6 | Page Transitions (2) | Small | Medium — perceived quality |
| 7 | Glassmorphism (8) | Medium | High — visual transformation |
| 8 | Unexposed Config Fields (9) | Medium | High — completeness |
| 9 | Digest Dedup Map (7) | Medium | High — practical insight |
| 10 | Particle Background (15) | Small | Medium — ambiance |
| 11 | Tag Comparison (11) | Medium | High — power user feature |
| 12 | Platform Constellation (10) | Medium | Medium — visual wow |
| 13 | Dashboard (12) | Large | High — differentiator |
| 14 | Layer Heatmap (13) | Large | Medium — niche but impressive |
| 15 | OCI Referrers (14) | Large | High — future-proofing |
