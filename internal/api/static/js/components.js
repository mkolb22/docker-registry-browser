/* Registry Browser UI Components */
var Components = (function() {
    'use strict';

    var layerColors = ['#8bcf69', '#e6d450', '#f28f68', '#6fb3d2', '#c678dd', '#e06c75', '#56b6c2', '#d19a66'];

    function esc(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(str));
        return d.innerHTML;
    }

    function formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        var units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        var i = 0;
        var size = bytes;
        while (size >= 1000 && i < units.length - 1) {
            size /= 1000;
            i++;
        }
        return (i === 0 ? size : size.toFixed(i > 1 ? 2 : 1)) + ' ' + units[i];
    }

    function formatTime(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr);
            return d.getUTCFullYear() + '-' +
                   String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
                   String(d.getUTCDate()).padStart(2, '0') + ' ' +
                   String(d.getUTCHours()).padStart(2, '0') + ':' +
                   String(d.getUTCMinutes()).padStart(2, '0') + ':' +
                   String(d.getUTCSeconds()).padStart(2, '0') + ' UTC';
        } catch (e) {
            return dateStr;
        }
    }

    function relativeTime(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr);
            var now = new Date();
            var diff = now - d;
            var secs = Math.floor(diff / 1000);
            if (secs < 60) return secs + 's ago';
            var mins = Math.floor(secs / 60);
            if (mins < 60) return mins + 'm ago';
            var hours = Math.floor(mins / 60);
            if (hours < 24) return hours + 'h ago';
            var days = Math.floor(hours / 24);
            if (days < 30) return days + 'd ago';
            var months = Math.floor(days / 30);
            if (months < 12) return months + 'mo ago';
            return Math.floor(months / 12) + 'y ago';
        } catch (e) {
            return '';
        }
    }

    // Returns a freshness class based on age in days
    function freshnessClass(dateStr) {
        if (!dateStr) return 'stale-unknown';
        try {
            var d = new Date(dateStr);
            var days = Math.floor((new Date() - d) / 86400000);
            if (days < 7) return 'stale-fresh';
            if (days < 30) return 'stale-recent';
            if (days < 90) return 'stale-aging';
            return 'stale-old';
        } catch (e) {
            return 'stale-unknown';
        }
    }

    function breadcrumb(items) {
        return '<nav class="breadcrumb">' +
            items.map(function(item, i) {
                if (i === items.length - 1) {
                    return '<span>' + esc(item.label) + '</span>';
                }
                return '<a href="' + esc(item.href) + '">' + esc(item.label) + '</a>' +
                       '<span class="breadcrumb-sep">/</span>';
            }).join('') +
            '</nav>';
    }

    function loading() {
        return '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';
    }

    function emptyState(icon, text) {
        return '<div class="empty-state">' +
               '<div class="empty-state-icon">' + icon + '</div>' +
               '<div class="empty-state-text">' + esc(text) + '</div>' +
               '</div>';
    }

    // === Skeleton Loading (Proposal 1) ===

    function catalogSkeleton() {
        var html = '<div class="skeleton-page page-enter">';
        for (var i = 0; i < 3; i++) {
            html += '<div class="card skeleton-card"><div class="card-header-structured">' +
                    '<div class="skeleton-line skeleton-sm"></div>' +
                    '<div class="skeleton-line skeleton-lg"></div></div>' +
                    '<div class="card-body">';
            for (var j = 0; j < 4; j++) {
                html += '<div class="skeleton-row"><div class="skeleton-badge"></div><div class="skeleton-line skeleton-md"></div></div>';
            }
            html += '</div></div>';
        }
        html += '</div>';
        return html;
    }

    function repoDetailSkeleton() {
        var html = '<div class="skeleton-page page-enter">' +
                   '<div class="skeleton-line skeleton-md" style="margin-bottom:20px"></div>' +
                   '<div class="card skeleton-card"><div class="card-header-structured">' +
                   '<div class="skeleton-line skeleton-sm"></div>' +
                   '<div class="skeleton-line skeleton-lg"></div></div>' +
                   '<div class="card-body">';
        for (var i = 0; i < 8; i++) {
            html += '<div class="skeleton-row"><div class="skeleton-badge"></div><div class="skeleton-line skeleton-md"></div></div>';
        }
        html += '</div></div></div>';
        return html;
    }

    function tagDetailSkeleton() {
        return '<div class="skeleton-page page-enter">' +
               '<div class="skeleton-line skeleton-md" style="margin-bottom:20px"></div>' +
               '<div class="card skeleton-card"><div class="card-header-structured">' +
               '<div class="skeleton-line skeleton-sm"></div>' +
               '<div class="skeleton-line skeleton-lg"></div>' +
               '<div class="skeleton-line skeleton-md"></div></div>' +
               '<div class="card-body" style="padding:20px">' +
               '<div class="skeleton-line skeleton-sm"></div>' +
               '<div class="skeleton-line skeleton-full"></div>' +
               '<div class="skeleton-line skeleton-sm" style="margin-top:20px"></div>' +
               '<div class="skeleton-line skeleton-full"></div>' +
               '<div class="skeleton-line skeleton-full"></div>' +
               '<div class="skeleton-line skeleton-full"></div>' +
               '</div></div></div>';
    }

    function dashboardSkeleton() {
        var html = '<div class="skeleton-page page-enter">' +
                   '<div class="skeleton-line skeleton-lg" style="margin-bottom:24px"></div>' +
                   '<div class="stats-grid">';
        for (var i = 0; i < 3; i++) {
            html += '<div class="stat-card skeleton-card"><div class="skeleton-line skeleton-sm"></div>' +
                    '<div class="skeleton-line skeleton-lg" style="margin-top:12px"></div></div>';
        }
        html += '</div><div class="card skeleton-card" style="margin-top:24px">' +
                '<div class="card-header-structured"><div class="skeleton-line skeleton-sm"></div>' +
                '<div class="skeleton-line skeleton-lg"></div></div><div class="card-body">';
        for (var j = 0; j < 5; j++) {
            html += '<div class="skeleton-row"><div class="skeleton-line skeleton-md"></div>' +
                    '<div class="skeleton-line skeleton-sm"></div></div>';
        }
        html += '</div></div></div>';
        return html;
    }

    // === Search/Filter (Proposal 4) ===

    function searchInput(placeholder) {
        return '<div class="search-container">' +
               '<input type="text" class="search-input" placeholder="' + esc(placeholder) + '" autocomplete="off">' +
               '<span class="search-icon">&#x1F50D;</span>' +
               '</div>';
    }

    // === Catalog Page ===

    function catalogPage(data, config) {
        var namespaces = data.namespaces || {};
        var keys = Object.keys(namespaces).sort();

        if (keys.length === 0) {
            return emptyState('\uD83D\uDCE6', 'No repositories found');
        }

        var html = '<div class="page-enter">';

        // Search bar
        html += searchInput('Filter repositories...');

        if (config && config.collapseNamespaces) {
            var allRepos = [];
            keys.forEach(function(ns) {
                allRepos = allRepos.concat(namespaces[ns]);
            });
            html += namespaceCard('All Repositories', '/', allRepos);
        } else {
            keys.forEach(function(ns) {
                var displayName = ns === '_' ? '/' : ns;
                html += namespaceCard('Namespace', displayName, namespaces[ns]);
            });
        }

        if (data.hasMore) {
            html += '<button class="btn-load-more" data-last="' + esc(data.lastEntry) + '">Load more repositories...</button>';
        }

        html += '</div>';
        return html;
    }

    function namespaceCard(label, name, repos) {
        return '<div class="card stagger-item">' +
               '<div class="card-header-structured">' +
               '<div class="card-label">' + esc(label) + '</div>' +
               '<div class="card-title">' + esc(name) + '</div>' +
               '</div>' +
               '<div class="card-body"><ul class="repo-list">' +
               repos.map(function(r, i) { return repoRow(r, i); }).join('') +
               '</ul></div></div>';
    }

    function repoRow(repo, index) {
        return '<li class="repo-item filterable stagger-item" style="--i:' + index + '" data-name="' + esc(repo.name) + '">' +
               '<a href="#/repo/' + encodeURIComponent(repo.name) + '">' +
               '<span class="badge-img">IMG</span>' +
               '<span class="repo-name">' + esc(repo.name) + '</span>' +
               '<span class="repo-arrow">\u{203A}</span>' +
               '</a></li>';
    }

    // === Repo Detail Page ===

    function repoDetailPage(repo, tagData, config, digestMap) {
        var html = '<div class="page-enter">';
        html += breadcrumb([
            { label: 'Repositories', href: '#/' },
            { label: repo }
        ]);

        html += '<div class="card">' +
                '<div class="card-header-structured">' +
                '<div class="card-label">Repository</div>' +
                '<div class="card-title">' + esc(repo) + '</div>' +
                sortControls(tagData.sort, tagData.order) +
                '</div>';

        if (!tagData.tags || tagData.tags.length === 0) {
            html += '<div class="card-body">' + emptyState('\uD83C\uDFF7\uFE0F', 'No tags found') + '</div>';
        } else {
            html += '<div class="card-body">';
            html += searchInput('Filter tags...');
            html += '<ul class="tag-list">';
            tagData.tags.forEach(function(tag, i) {
                html += tagRow(repo, tag, i, digestMap);
            });
            html += '</ul></div>';
        }

        html += '</div>';

        // Tag comparison selector
        if (tagData.tags && tagData.tags.length >= 2) {
            html += compareSelector(repo, tagData.tags);
        }

        html += '</div>';
        return html;
    }

    function sortControls(currentSort, currentOrder) {
        function opt(value, label, current) {
            return '<option value="' + value + '"' + (value === current ? ' selected' : '') + '>' + label + '</option>';
        }
        return '<div class="sort-controls">' +
               '<label>Sort:</label>' +
               '<select id="sort-by">' +
               opt('name', 'Name', currentSort) +
               opt('version', 'Version', currentSort) +
               opt('api', 'API order', currentSort) +
               '</select>' +
               '<select id="sort-order">' +
               opt('desc', 'Desc', currentOrder) +
               opt('asc', 'Asc', currentOrder) +
               '</select></div>';
    }

    function tagRow(repo, tag, index, digestMap) {
        var digestGroup = '';
        var digestColor = '';
        if (digestMap) {
            var digest = digestMap[tag];
            if (digest) {
                // Assign color by digest group
                var digests = Object.values(digestMap);
                var uniqueDigests = [];
                digests.forEach(function(d) { if (uniqueDigests.indexOf(d) === -1) uniqueDigests.push(d); });
                var digestIdx = uniqueDigests.indexOf(digest);
                // Only show dedup indicator if more than one tag shares this digest
                var count = 0;
                Object.keys(digestMap).forEach(function(t) { if (digestMap[t] === digest) count++; });
                if (count > 1) {
                    digestColor = layerColors[digestIdx % layerColors.length];
                    var others = [];
                    Object.keys(digestMap).forEach(function(t) {
                        if (t !== tag && digestMap[t] === digest) others.push(t);
                    });
                    digestGroup = '<span class="digest-dedup" style="background:' + digestColor + '" title="Same image as: ' + esc(others.join(', ')) + '">' +
                                  '=' + count + '</span>';
                }
            }
        }

        return '<li class="tag-item filterable stagger-item" style="--i:' + index + ';' +
               (digestColor ? 'border-left:3px solid ' + digestColor : '') + '" data-name="' + esc(tag) + '">' +
               '<a href="#/repo/' + encodeURIComponent(repo) + '/tag/' + encodeURIComponent(tag) + '">' +
               '<span class="badge-tag-icon">TAG</span>' +
               '<span class="tag-name">' + esc(tag) + '</span>' +
               digestGroup +
               '<span class="freshness-dot stale-unknown" data-tag="' + esc(tag) + '"></span>' +
               '<span class="tag-arrow">\u{203A}</span>' +
               '</a></li>';
    }

    // === Tag Comparison (Proposal 11) ===

    function compareSelector(repo, tags) {
        var opts = tags.map(function(t) {
            return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
        }).join('');
        return '<div class="card compare-card stagger-item" style="margin-top:16px">' +
               '<div class="card-header-structured"><div class="card-label">Compare</div>' +
               '<div class="card-title">Tag Comparison</div></div>' +
               '<div class="card-body" style="padding:16px">' +
               '<div class="compare-selectors">' +
               '<select id="compare-a" class="compare-select">' + opts + '</select>' +
               '<span class="compare-vs">vs</span>' +
               '<select id="compare-b" class="compare-select">' +
               tags.map(function(t, i) {
                   return '<option value="' + esc(t) + '"' + (i === 1 ? ' selected' : '') + '>' + esc(t) + '</option>';
               }).join('') +
               '</select>' +
               '<button class="btn btn-primary" id="compare-btn">Compare</button>' +
               '</div>' +
               '<div id="compare-result"></div>' +
               '</div></div>';
    }

    function compareResult(tagA, detailA, tagB, detailB) {
        var mA = detailA.manifests && detailA.manifests[0];
        var mB = detailB.manifests && detailB.manifests[0];
        if (!mA || !mB) return '<p class="text-muted">No manifest data for comparison.</p>';

        var layersA = new Set((mA.layers || []).map(function(l) { return l.digest; }));
        var layersB = new Set((mB.layers || []).map(function(l) { return l.digest; }));

        var shared = 0, onlyA = 0, onlyB = 0;
        var sizeA = mA.size || 0, sizeB = mB.size || 0;
        layersA.forEach(function(d) { if (layersB.has(d)) shared++; else onlyA++; });
        layersB.forEach(function(d) { if (!layersA.has(d)) onlyB++; });

        var delta = sizeB - sizeA;
        var deltaStr = (delta >= 0 ? '+' : '') + formatSize(Math.abs(delta));
        if (delta < 0) deltaStr = '-' + formatSize(Math.abs(delta));

        var html = '<div class="compare-summary">';
        html += '<div class="compare-stat"><span class="compare-stat-num">' + shared + '</span><span class="compare-stat-label">Shared Layers</span></div>';
        html += '<div class="compare-stat"><span class="compare-stat-num compare-added">+' + onlyB + '</span><span class="compare-stat-label">Added in ' + esc(tagB) + '</span></div>';
        html += '<div class="compare-stat"><span class="compare-stat-num compare-removed">-' + onlyA + '</span><span class="compare-stat-label">Removed from ' + esc(tagA) + '</span></div>';
        html += '<div class="compare-stat"><span class="compare-stat-num">' + deltaStr + '</span><span class="compare-stat-label">Size Delta</span></div>';
        html += '</div>';

        // Visual diff bar
        var total = shared + onlyA + onlyB;
        if (total > 0) {
            var pctShared = (shared / total * 100).toFixed(1);
            var pctA = (onlyA / total * 100).toFixed(1);
            var pctB = (onlyB / total * 100).toFixed(1);
            html += '<div class="compare-bar">' +
                    '<div class="compare-bar-seg compare-bar-shared" style="width:' + pctShared + '%" title="Shared"></div>' +
                    '<div class="compare-bar-seg compare-bar-removed" style="width:' + pctA + '%" title="Removed"></div>' +
                    '<div class="compare-bar-seg compare-bar-added" style="width:' + pctB + '%" title="Added"></div>' +
                    '</div>' +
                    '<div class="compare-bar-legend">' +
                    '<span><i style="background:var(--color-accent)"></i>Shared</span>' +
                    '<span><i style="background:var(--color-danger)"></i>Removed</span>' +
                    '<span><i style="background:var(--color-success)"></i>Added</span>' +
                    '</div>';
        }

        html += '<div class="compare-sizes">' +
                '<span>' + esc(tagA) + ': ' + formatSize(sizeA) + '</span>' +
                '<span>' + esc(tagB) + ': ' + formatSize(sizeB) + '</span>' +
                '</div>';

        return html;
    }

    // === Tag Detail Page ===

    function tagDetailPage(detail, config, referrers) {
        var repo = detail.repository;
        var tag = detail.tag;
        var manifests = detail.manifests || [];

        var html = '<div class="page-enter">';
        html += breadcrumb([
            { label: 'Repositories', href: '#/' },
            { label: repo, href: '#/repo/' + encodeURIComponent(repo) },
            { label: tag }
        ]);

        // Tag card header
        html += '<div class="card">' +
                '<div class="card-header-structured">' +
                '<div class="card-label">Tag</div>' +
                '<div class="card-title">' + esc(repo) + ':' + esc(tag) + '</div>';
        if (detail.contentDigest) {
            html += '<div class="card-digest">Content Digest: ' + esc(detail.contentDigest) + '</div>';
        }

        // Referrer badges (Proposal 14)
        if (referrers && referrers.length > 0) {
            html += referrerBadges(referrers);
        }

        html += '</div>';

        // Card body with details
        html += '<div class="card-body tag-detail-body">';

        // Details heading + pull command
        html += '<h5>Details</h5>';
        html += pullCommand(repo, tag, config);
        html += '<hr />';

        if (manifests.length === 0) {
            html += emptyState('\uD83D\uDCCB', 'No manifest data available');
            html += '</div></div>';
            html += '</div>';
            return html;
        }

        // Platform section
        html += '<h5>Manifests</h5>';

        // Platform constellation (Proposal 10) for multi-arch, tabs for <= 3
        if (manifests.length > 1) {
            html += constellationMap(repo, tag, manifests);
            html += archTabs(manifests);
        }

        manifests.forEach(function(m, i) {
            html += manifestPanel(m, i, manifests.length > 1);
        });

        html += '</div></div>'; // close card-body + card

        // Danger zone
        if (config && config.deleteEnabled) {
            html += dangerZone(repo, tag);
        }

        html += '</div>';
        return html;
    }

    // === Referrer Badges (Proposal 14) ===

    function referrerBadges(refs) {
        var hasSig = false, hasSBOM = false, hasAttest = false;
        refs.forEach(function(r) {
            var at = (r.artifactType || '').toLowerCase();
            if (at.indexOf('signature') >= 0 || at.indexOf('cosign') >= 0 || at.indexOf('notation') >= 0) hasSig = true;
            else if (at.indexOf('sbom') >= 0 || at.indexOf('spdx') >= 0 || at.indexOf('cyclonedx') >= 0) hasSBOM = true;
            else hasAttest = true;
        });

        var html = '<div class="referrer-badges">';
        if (hasSig) html += '<span class="ref-badge ref-badge-sig" title="Signed">Signed</span>';
        if (hasSBOM) html += '<span class="ref-badge ref-badge-sbom" title="SBOM Available">SBOM</span>';
        if (hasAttest) html += '<span class="ref-badge ref-badge-attest" title="Attestation">Attested</span>';
        if (!hasSig && !hasSBOM && !hasAttest && refs.length > 0) {
            html += '<span class="ref-badge" title="' + refs.length + ' referrer(s)">' + refs.length + ' Referrer(s)</span>';
        }
        html += '</div>';
        return html;
    }

    // === Platform Constellation (Proposal 10) ===

    function constellationMap(repo, tag, manifests) {
        var cx = 150, cy = 100, radius = 75;
        var nodeR = 28;

        var html = '<div class="constellation-container">';
        html += '<svg class="constellation" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">';

        // Lines from center to each platform
        manifests.forEach(function(m, i) {
            var angle = (2 * Math.PI * i / manifests.length) - Math.PI / 2;
            var nx = cx + radius * Math.cos(angle);
            var ny = cy + radius * Math.sin(angle);
            html += '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx + '" y2="' + ny + '" class="constellation-line" style="animation-delay:' + (i * 100) + 'ms"/>';
        });

        // Center node
        html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (nodeR + 4) + '" class="constellation-center"/>';
        html += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" class="constellation-center-text">' + esc(tag) + '</text>';

        // Platform nodes
        manifests.forEach(function(m, i) {
            var angle = (2 * Math.PI * i / manifests.length) - Math.PI / 2;
            var nx = cx + radius * Math.cos(angle);
            var ny = cy + radius * Math.sin(angle);
            var label = m.architecture || 'unknown';
            if (m.variant) label += '/' + m.variant;

            html += '<g class="constellation-node" data-tab="' + i + '" style="animation-delay:' + (i * 100 + 200) + 'ms">';
            html += '<circle cx="' + nx + '" cy="' + ny + '" r="' + nodeR + '" class="constellation-orbit"/>';
            html += '<text x="' + nx + '" y="' + (ny - 5) + '" text-anchor="middle" class="constellation-label">' + esc(label) + '</text>';
            html += '<text x="' + nx + '" y="' + (ny + 10) + '" text-anchor="middle" class="constellation-size">' + formatSize(m.size) + '</text>';
            html += '</g>';
        });

        html += '</svg></div>';
        return html;
    }

    function pullCommand(repo, tag, config) {
        var registry = (config && config.publicRegistryURL) || '';
        var cmd = 'docker pull ';
        if (registry) {
            cmd += registry + '/' + repo + ':' + tag;
        } else {
            cmd += repo + ':' + tag;
        }
        return '<div class="pull-command">' +
               '<span class="pull-label">Pull Command</span>' +
               '<code>' + esc(cmd) + '</code>' +
               '<button class="copy-btn" data-copy="' + esc(cmd) + '" title="Copy to clipboard">Copy</button>' +
               '</div>';
    }

    function archTabs(manifests) {
        return '<div class="tabs" role="tablist">' +
               manifests.map(function(m, i) {
                   var name = (m.os || 'unknown') + ' / ' + (m.architecture || 'unknown');
                   if (m.variant) name += '/' + m.variant;
                   return '<button class="tab' + (i === 0 ? ' active' : '') + '" ' +
                          'data-tab="' + i + '" role="tab">' + esc(name) + '</button>';
               }).join('') +
               '</div>';
    }

    function manifestPanel(m, index, multiArch) {
        var hidden = multiArch && index > 0 ? ' style="display:none"' : '';
        var html = '<div class="manifest-panel" data-panel="' + index + '"' + hidden + '>';

        html += detailsSection(m);

        // Runtime config (Proposal 9)
        html += runtimeConfigSection(m);

        if (m.env && m.env.length > 0) {
            html += envSection(m.env);
        }

        if (m.labels && Object.keys(m.labels).length > 0) {
            html += labelsSection(m.labels);
        }

        if (m.layers && m.layers.length > 0) {
            html += layersSection(m.layers);
        }

        if (m.history && m.history.length > 0) {
            html += historySection(m.history, m.layers);
        }

        html += '</div>';
        return html;
    }

    function detailsSection(m) {
        var html = '<h5 class="mt-4">Details</h5>';

        if (m.contentDigest) {
            html += '<span class="detail-label">Content Digest</span>' +
                    '<p class="detail-value mono">' + esc(m.contentDigest) + '</p>';
        }

        html += '<div class="detail-row">';
        if (m.created) {
            html += '<div class="detail-col">' +
                    '<span class="detail-label">Created</span>' +
                    '<p class="detail-value">' + formatTime(m.created) + ' <span class="text-muted small">(' + relativeTime(m.created) + ')</span></p>' +
                    '</div>';
        }
        if (m.size) {
            html += '<div class="detail-col">' +
                    '<span class="detail-label">Size</span>' +
                    '<p class="detail-value">' + formatSize(m.size) + '</p>' +
                    '</div>';
        }
        html += '</div>';

        html += '<hr />';
        return html;
    }

    // === Runtime Config Section (Proposal 9) ===

    function runtimeConfigSection(m) {
        var hasConfig = m.entrypoint || m.cmd || m.workingDir || m.user || m.stopSignal ||
                       (m.exposedPorts && m.exposedPorts.length > 0) ||
                       (m.volumes && m.volumes.length > 0) ||
                       m.healthcheck;
        if (!hasConfig) return '';

        var html = '<h5 class="mt-4">Runtime Configuration</h5>';
        html += '<div class="runtime-config">';

        if (m.entrypoint && m.entrypoint.length > 0) {
            html += '<span class="detail-label">Entrypoint</span>' +
                    '<p class="detail-value mono">' + esc(m.entrypoint.join(' ')) + '</p>';
        }
        if (m.cmd && m.cmd.length > 0) {
            html += '<span class="detail-label">Cmd</span>' +
                    '<p class="detail-value mono">' + esc(m.cmd.join(' ')) + '</p>';
        }

        var cols = '';
        if (m.workingDir) {
            cols += '<div class="detail-col"><span class="detail-label">Working Dir</span>' +
                    '<p class="detail-value mono">' + esc(m.workingDir) + '</p></div>';
        }
        if (m.user) {
            cols += '<div class="detail-col"><span class="detail-label">User</span>' +
                    '<p class="detail-value mono">' + esc(m.user) + '</p></div>';
        }
        if (m.stopSignal) {
            cols += '<div class="detail-col"><span class="detail-label">Stop Signal</span>' +
                    '<p class="detail-value mono">' + esc(m.stopSignal) + '</p></div>';
        }
        if (cols) html += '<div class="detail-row">' + cols + '</div>';

        if (m.exposedPorts && m.exposedPorts.length > 0) {
            html += '<span class="detail-label">Exposed Ports</span>' +
                    '<div class="port-badges">' +
                    m.exposedPorts.map(function(p) {
                        return '<span class="port-badge">' + esc(p) + '</span>';
                    }).join('') + '</div>';
        }
        if (m.volumes && m.volumes.length > 0) {
            html += '<span class="detail-label">Volumes</span>' +
                    '<div class="volume-list">' +
                    m.volumes.map(function(v) {
                        return '<span class="detail-value mono">' + esc(v) + '</span>';
                    }).join('') + '</div>';
        }
        if (m.healthcheck) {
            html += '<span class="detail-label">Health Check</span>';
            html += '<p class="detail-value mono">' + esc((m.healthcheck.test || []).join(' ')) + '</p>';
            var hcParts = [];
            if (m.healthcheck.interval) hcParts.push('interval=' + formatNs(m.healthcheck.interval));
            if (m.healthcheck.timeout) hcParts.push('timeout=' + formatNs(m.healthcheck.timeout));
            if (m.healthcheck.retries) hcParts.push('retries=' + m.healthcheck.retries);
            if (m.healthcheck.startPeriod) hcParts.push('start=' + formatNs(m.healthcheck.startPeriod));
            if (hcParts.length) html += '<p class="detail-value small text-muted">' + esc(hcParts.join(', ')) + '</p>';
        }

        html += '</div><hr />';
        return html;
    }

    function formatNs(ns) {
        if (!ns) return '0s';
        var s = ns / 1e9;
        if (s >= 60) return Math.round(s / 60) + 'm';
        return Math.round(s) + 's';
    }

    function labelsSection(labels) {
        var keys = Object.keys(labels).sort();
        var html = '<h5 class="mt-4">Labels</h5>';
        keys.forEach(function(k) {
            html += '<span class="detail-label">' + esc(k) + '</span>' +
                    '<p class="detail-value mono">' + esc(labels[k]) + '</p>';
        });
        html += '<hr />';
        return html;
    }

    function envSection(env) {
        var html = '<h5 class="mt-4">Environment</h5>';
        env.forEach(function(e) {
            var idx = e.indexOf('=');
            var key = idx >= 0 ? e.substring(0, idx) : e;
            var val = idx >= 0 ? e.substring(idx + 1) : '';
            html += '<span class="detail-label">' + esc(key) + '</span>' +
                    '<p class="detail-value mono">' + esc(val) + '</p>';
        });
        html += '<hr />';
        return html;
    }

    function layersSection(layers) {
        var totalSize = 0;
        layers.forEach(function(l) { totalSize += l.size || 0; });

        var pcts = layers.map(function(l) {
            return totalSize > 0 ? ((l.size || 0) / totalSize) * 100 : 0;
        });

        var html = '<h5 class="mt-4">Layers</h5>';

        // Consolidated stacked bar (Proposal in style update)
        html += '<div class="layer-bar-consolidated">';
        layers.forEach(function(l, i) {
            var pct = pcts[i];
            var color = layerColors[i % layerColors.length];
            html += '<div class="layer-bar-seg" data-layer="' + i + '" style="width:' + pct.toFixed(2) + '%;background:' + color + '" title="#' + i + ' ' + formatSize(l.size) + ' (' + pct.toFixed(1) + '%)"></div>';
        });
        html += '</div>';

        layers.forEach(function(l, i) {
            var pct = pcts[i];
            var color = layerColors[i % layerColors.length];

            html += '<p class="layer-info mono">' +
                    '<small><span class="layer-color-dot" style="background:' + color + '"></span>' +
                    '[#' + String(i).padStart(3, '0') + '] ' +
                    esc(l.digest || '') + ' - ' +
                    pct.toFixed(2) + '% (' + formatSize(l.size) + ')</small></p>';

            // Stacked progress bar
            html += '<div class="layer-progress">';
            for (var j = 0; j < layers.length; j++) {
                var segPct = pcts[j];
                var segColor = (j === i) ? color : 'transparent';
                html += '<div class="layer-progress-seg" style="width:' + segPct.toFixed(2) + '%;background:' + segColor + '"></div>';
            }
            html += '</div>';
        });

        html += '<hr />';
        return html;
    }

    // === Dockerfile Reconstruction (Proposal 5) ===

    function historySection(history, layers) {
        var html = '<h5 class="mt-4">History</h5>' +
                   '<div class="history-scroll">';

        // Build a map from layer index to size for annotation
        var layerIdx = 0;
        history.forEach(function(h) {
            if (h.created) {
                var comment = h.comment ? ' (' + h.comment + ')' : '';
                html += '<span class="detail-label">' + formatTime(h.created) + esc(comment) + '</span>';
            }

            var cmd = h.createdBy || '(empty layer)';
            var parsed = parseDockerfileCmd(cmd);
            var sizeLabel = '';
            if (!h.emptyLayer && layers && layerIdx < layers.length) {
                sizeLabel = '<span class="history-size">' + formatSize(layers[layerIdx].size) + '</span>';
                layerIdx++;
            }

            html += '<div class="history-line' + (h.emptyLayer ? ' history-empty-layer' : '') + '">' +
                    '<p class="detail-value mono small dockerfile-cmd">' + parsed + '</p>' +
                    sizeLabel +
                    '</div>';
        });
        html += '</div>';
        return html;
    }

    function parseDockerfileCmd(cmd) {
        if (!cmd) return esc('(empty layer)');

        // Strip /bin/sh -c #(nop) prefix
        var cleaned = cmd;
        if (cleaned.indexOf('/bin/sh -c #(nop)') === 0) {
            cleaned = cleaned.substring(18).trim();
        } else if (cleaned.indexOf('/bin/sh -c ') === 0) {
            cleaned = 'RUN ' + cleaned.substring(11);
        } else if (cleaned.indexOf('|') === 0) {
            // Build arg prefix: |1 VAR=val /bin/sh -c ...
            var shIdx = cleaned.indexOf('/bin/sh -c ');
            if (shIdx >= 0) {
                cleaned = 'RUN ' + cleaned.substring(shIdx + 11);
            }
        }

        // Highlight Dockerfile keywords
        var keywords = ['FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY',
                       'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL',
                       'HEALTHCHECK', 'SHELL'];
        var escaped = esc(cleaned);
        keywords.forEach(function(kw) {
            var re = new RegExp('^(' + kw + ')(\\s)', 'i');
            escaped = escaped.replace(re, '<span class="dockerfile-keyword">' + kw + '</span>$2');
        });

        return escaped;
    }

    function dangerZone(repo, tag) {
        return '<div class="danger-zone">' +
               '<div class="danger-zone-header">Danger Zone</div>' +
               '<div class="danger-zone-body">' +
               '<div class="danger-zone-content">' +
               '<h5>Delete Tag</h5>' +
               '<p>Please be careful as this will not just delete the reference but also the actual content!</p>' +
               '<p>For example when you have <strong>latest</strong> and <strong>v1.2.3</strong> both pointing to the same image, ' +
               'the deletion of <strong>latest</strong> will also permanently remove <strong>v1.2.3</strong>.</p>' +
               '<button class="btn btn-danger" id="delete-btn" data-repo="' + esc(repo) + '" data-tag="' + esc(tag) + '">Delete</button>' +
               '</div></div></div>';
    }

    function deleteModal(repo, tag) {
        return '<div class="modal-header">' +
               '<h3 class="text-danger">Are you sure?</h3>' +
               '<button class="modal-close" id="modal-close-btn">&times;</button>' +
               '</div>' +
               '<div class="modal-body">' +
               '<p>Do you really want to delete the following tag?</p>' +
               '<p class="mono">' + esc(tag) + '</p>' +
               '<p>Please enter the tag name below to confirm:</p>' +
               '<input type="text" id="delete-confirm-input" placeholder="Enter tag name here" autocomplete="off">' +
               '<p class="small text-muted">This will enable the <strong>Delete</strong> button.</p>' +
               '</div>' +
               '<div class="modal-footer">' +
               '<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>' +
               '<button class="btn btn-danger" id="modal-delete-btn" disabled>Delete</button>' +
               '</div>';
    }

    // === Dashboard (Proposal 12) ===

    function dashboardPage(stats) {
        var html = '<div class="page-enter">';
        html += '<h2 class="dashboard-title">Registry Overview</h2>';

        // Stat cards
        html += '<div class="stats-grid">';
        html += statCard('Repositories', stats.totalRepositories, 'var(--color-repo)');
        html += statCard('Tags', stats.totalTags, 'var(--color-tag)');
        var avgTags = stats.totalRepositories > 0 ? (stats.totalTags / stats.totalRepositories).toFixed(1) : '0';
        html += statCard('Avg Tags/Repo', avgTags, 'var(--color-arch)');
        html += '</div>';

        // Top repos bar chart
        if (stats.topRepositories && stats.topRepositories.length > 0) {
            var maxTags = stats.topRepositories[0].tagCount;
            html += '<div class="card" style="margin-top:24px"><div class="card-header-structured">' +
                    '<div class="card-label">Top Repositories</div>' +
                    '<div class="card-title">By Tag Count</div></div>' +
                    '<div class="card-body" style="padding:16px">';

            stats.topRepositories.forEach(function(r, i) {
                var pct = maxTags > 0 ? (r.tagCount / maxTags * 100) : 0;
                html += '<div class="bar-chart-row stagger-item" style="--i:' + i + '">' +
                        '<a href="#/repo/' + encodeURIComponent(r.name) + '" class="bar-chart-label">' + esc(r.name) + '</a>' +
                        '<div class="bar-chart-bar-container">' +
                        '<div class="bar-chart-bar" style="width:' + pct.toFixed(1) + '%"></div>' +
                        '</div>' +
                        '<span class="bar-chart-value">' + r.tagCount + '</span>' +
                        '</div>';
            });

            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }

    function statCard(label, value, color) {
        return '<div class="stat-card stagger-item">' +
               '<div class="stat-label">' + esc(label) + '</div>' +
               '<div class="stat-value" data-target="' + value + '" style="color:' + color + '">' + value + '</div>' +
               '</div>';
    }

    // === Layer Heatmap (Proposal 13) ===

    function layerHeatmap(tags, tagDetails) {
        if (!tags.length || !tagDetails.length) return '';

        // Collect all unique layer digests and count sharing
        var digestCount = {};
        var tagLayers = [];
        tagDetails.forEach(function(d) {
            var m = d.manifests && d.manifests[0];
            var layerDigests = (m && m.layers || []).map(function(l) { return l.digest; });
            tagLayers.push(layerDigests);
            layerDigests.forEach(function(dig) {
                digestCount[dig] = (digestCount[dig] || 0) + 1;
            });
        });

        var maxLayers = 0;
        tagLayers.forEach(function(l) { if (l.length > maxLayers) maxLayers = l.length; });

        var html = '<div class="heatmap-container">';
        html += '<div class="heatmap-grid" style="grid-template-columns: 150px repeat(' + maxLayers + ', 1fr)">';

        // Header row
        html += '<div class="heatmap-header">Tag / Layer</div>';
        for (var col = 0; col < maxLayers; col++) {
            html += '<div class="heatmap-header heatmap-col-header">#' + col + '</div>';
        }

        // Tag rows
        tags.forEach(function(tag, i) {
            html += '<div class="heatmap-tag">' + esc(tag) + '</div>';
            for (var j = 0; j < maxLayers; j++) {
                if (j < tagLayers[i].length) {
                    var dig = tagLayers[i][j];
                    var sharing = digestCount[dig] || 1;
                    var pct = sharing / tags.length;
                    var lightness = Math.round(25 + pct * 55);
                    html += '<div class="heatmap-cell" style="background:hsl(200,80%,' + lightness + '%)" ' +
                            'title="Shared by ' + sharing + '/' + tags.length + ' tags">' +
                            '</div>';
                } else {
                    html += '<div class="heatmap-cell heatmap-empty"></div>';
                }
            }
        });

        html += '</div>';
        html += '<div class="heatmap-legend"><span class="heatmap-legend-cold">Unique</span>' +
                '<div class="heatmap-legend-gradient"></div>' +
                '<span class="heatmap-legend-hot">Shared</span></div>';
        html += '</div>';
        return html;
    }

    return {
        esc: esc,
        formatSize: formatSize,
        formatTime: formatTime,
        relativeTime: relativeTime,
        freshnessClass: freshnessClass,
        loading: loading,
        breadcrumb: breadcrumb,
        emptyState: emptyState,
        catalogSkeleton: catalogSkeleton,
        repoDetailSkeleton: repoDetailSkeleton,
        tagDetailSkeleton: tagDetailSkeleton,
        dashboardSkeleton: dashboardSkeleton,
        catalogPage: catalogPage,
        repoDetailPage: repoDetailPage,
        tagDetailPage: tagDetailPage,
        deleteModal: deleteModal,
        sortControls: sortControls,
        compareResult: compareResult,
        dashboardPage: dashboardPage,
        layerHeatmap: layerHeatmap
    };
})();
