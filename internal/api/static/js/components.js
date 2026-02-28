/* Registry Browser UI Components */
var Components = (function() {
    'use strict';

    function esc(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(str));
        return d.innerHTML;
    }

    function formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        var units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
        var i = 0;
        var size = bytes;
        while (size >= 1024 && i < units.length - 1) {
            size /= 1024;
            i++;
        }
        return (i === 0 ? size : size.toFixed(1)) + ' ' + units[i];
    }

    function formatTime(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr);
            return d.toLocaleString();
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

    // === Catalog Page ===

    function catalogPage(data, config) {
        var namespaces = data.namespaces || {};
        var keys = Object.keys(namespaces).sort();

        if (keys.length === 0) {
            return emptyState('\uD83D\uDCE6', 'No repositories found');
        }

        // If collapse is enabled, merge all into flat list
        if (config && config.collapseNamespaces) {
            var allRepos = [];
            keys.forEach(function(ns) {
                allRepos = allRepos.concat(namespaces[ns]);
            });
            return namespaceCard('All Repositories', allRepos);
        }

        var html = '';
        keys.forEach(function(ns) {
            html += namespaceCard(ns === '_' ? 'Library' : ns, namespaces[ns]);
        });

        if (data.hasMore) {
            html += '<button class="btn-load-more" data-last="' + esc(data.lastEntry) + '">Load more repositories...</button>';
        }

        return html;
    }

    function namespaceCard(name, repos) {
        return '<div class="card">' +
               '<div class="card-header">' +
               '<h2><span class="ns-icon">\u{1F4C1}</span> ' + esc(name) +
               ' <span class="ns-count">(' + repos.length + ')</span></h2>' +
               '</div>' +
               '<div class="card-body"><ul class="repo-list">' +
               repos.map(repoRow).join('') +
               '</ul></div></div>';
    }

    function repoRow(repo) {
        return '<li class="repo-item"><a href="#/repo/' + encodeURIComponent(repo.name) + '">' +
               '<span class="repo-icon">\u{1F4E6}</span>' +
               '<span class="repo-name">' + esc(repo.name) + '</span>' +
               '<span class="repo-arrow">\u{203A}</span>' +
               '</a></li>';
    }

    // === Repo Detail Page ===

    function repoDetailPage(repo, tagData, config) {
        var html = breadcrumb([
            { label: 'Repositories', href: '#/' },
            { label: repo }
        ]);

        html += '<div class="page-header"><h1>' + esc(repo) + '</h1>' +
                sortControls(tagData.sort, tagData.order) + '</div>';

        if (!tagData.tags || tagData.tags.length === 0) {
            html += emptyState('\uD83C\uDFF7\uFE0F', 'No tags found');
            return html;
        }

        html += '<div class="card"><div class="card-body"><ul class="tag-list">';
        tagData.tags.forEach(function(tag) {
            html += tagRow(repo, tag);
        });
        html += '</ul></div></div>';

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

    function tagRow(repo, tag) {
        return '<li class="tag-item"><a href="#/repo/' + encodeURIComponent(repo) + '/tag/' + encodeURIComponent(tag) + '">' +
               '<span class="tag-icon">\uD83C\uDFF7\uFE0F</span>' +
               '<span class="tag-name">' + esc(tag) + '</span>' +
               '<span class="tag-arrow">\u{203A}</span>' +
               '</a></li>';
    }

    // === Tag Detail Page ===

    function tagDetailPage(detail, config) {
        var repo = detail.repository;
        var tag = detail.tag;
        var manifests = detail.manifests || [];

        var html = breadcrumb([
            { label: 'Repositories', href: '#/' },
            { label: repo, href: '#/repo/' + encodeURIComponent(repo) },
            { label: tag }
        ]);

        html += '<div class="tag-detail-header">' +
                '<h1>' + esc(tag) + '</h1>' +
                '<span class="badge badge-tag">' + esc(repo) + '</span>';
        if (detail.contentDigest) {
            html += '<span class="badge badge-digest" title="' + esc(detail.contentDigest) + '">' + esc(detail.contentDigest.substring(0, 24)) + '...</span>';
        }
        html += '</div>';

        // Pull command
        html += pullCommand(repo, tag, config);

        if (manifests.length === 0) {
            html += emptyState('\uD83D\uDCCB', 'No manifest data available');
            return html;
        }

        // Architecture tabs (only if multi-arch)
        if (manifests.length > 1) {
            html += archTabs(manifests);
        }

        // Manifest panels
        manifests.forEach(function(m, i) {
            html += manifestPanel(m, i, manifests.length > 1);
        });

        // Delete section
        if (config && config.deleteEnabled) {
            html += deleteSection(repo, tag);
        }

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
               '<code>' + esc(cmd) + '</code>' +
               '<button class="copy-btn" data-copy="' + esc(cmd) + '">Copy</button>' +
               '</div>';
    }

    function archTabs(manifests) {
        return '<div class="tabs" role="tablist">' +
               manifests.map(function(m, i) {
                   var name = (m.os || 'unknown') + '/' + (m.architecture || 'unknown');
                   if (m.variant) name += '/' + m.variant;
                   return '<button class="tab' + (i === 0 ? ' active' : '') + '" ' +
                          'data-tab="' + i + '" role="tab">' +
                          '<span class="badge badge-arch">' + esc(name) + '</span>' +
                          '</button>';
               }).join('') +
               '</div>';
    }

    function manifestPanel(m, index, multiArch) {
        var hidden = multiArch && index > 0 ? ' style="display:none"' : '';
        var html = '<div class="manifest-panel" data-panel="' + index + '"' + hidden + '>';

        html += detailsSection(m);

        if (m.labels && Object.keys(m.labels).length > 0) {
            html += labelsSection(m.labels);
        }

        if (m.env && m.env.length > 0) {
            html += envSection(m.env);
        }

        if (m.layers && m.layers.length > 0) {
            html += layersSection(m.layers);
        }

        if (m.history && m.history.length > 0) {
            html += historySection(m.history);
        }

        html += '</div>';
        return html;
    }

    function detailsSection(m) {
        var rows = '';
        if (m.architecture) rows += detailRow('Architecture', m.architecture + (m.variant ? '/' + m.variant : ''));
        if (m.os) rows += detailRow('OS', m.os);
        if (m.contentDigest) rows += detailRow('Digest', '<span class="digest-text">' + esc(m.contentDigest) + '</span>');
        if (m.created) rows += detailRow('Created', formatTime(m.created) + ' (' + relativeTime(m.created) + ')');
        if (m.size) rows += detailRow('Total Size', formatSize(m.size));
        if (m.layers) rows += detailRow('Layers', m.layers.length + '');

        return '<div class="section">' +
               '<div class="section-header" data-section="details">' +
               '<span class="toggle">\u25BC</span> Details</div>' +
               '<div class="section-body"><table class="detail-table">' + rows + '</table></div>' +
               '</div>';
    }

    function detailRow(label, value) {
        return '<tr><th>' + esc(label) + '</th><td>' + value + '</td></tr>';
    }

    function labelsSection(labels) {
        var keys = Object.keys(labels).sort();
        return '<div class="section">' +
               '<div class="section-header" data-section="labels">' +
               '<span class="toggle">\u25BC</span> Labels (' + keys.length + ')</div>' +
               '<div class="section-body"><ul class="label-list">' +
               keys.map(function(k) {
                   return '<li class="label-item"><span class="label-key">' + esc(k) + '</span> = <span class="label-val">' + esc(labels[k]) + '</span></li>';
               }).join('') +
               '</ul></div></div>';
    }

    function envSection(env) {
        return '<div class="section">' +
               '<div class="section-header" data-section="env">' +
               '<span class="toggle">\u25BC</span> Environment (' + env.length + ')</div>' +
               '<div class="section-body"><ul class="env-list">' +
               env.map(function(e) {
                   var parts = e.split('=');
                   var key = parts[0];
                   var val = parts.slice(1).join('=');
                   return '<li class="env-item"><span class="env-key">' + esc(key) + '</span>=<span class="env-val">' + esc(val) + '</span></li>';
               }).join('') +
               '</ul></div></div>';
    }

    function layersSection(layers) {
        var maxSize = 0;
        layers.forEach(function(l) { if (l.size > maxSize) maxSize = l.size; });

        return '<div class="section">' +
               '<div class="section-header" data-section="layers">' +
               '<span class="toggle">\u25BC</span> Layers (' + layers.length + ')</div>' +
               '<div class="section-body"><ul class="layer-list">' +
               layers.map(function(l) {
                   var pct = maxSize > 0 ? Math.max(2, (l.size / maxSize) * 100) : 2;
                   return '<li class="layer-item">' +
                          '<span class="layer-index">' + l.index + '</span>' +
                          '<div class="layer-bar-container"><div class="layer-bar" style="width:' + pct.toFixed(1) + '%"></div></div>' +
                          '<span class="layer-size">' + formatSize(l.size) + '</span>' +
                          '</li>';
               }).join('') +
               '</ul></div></div>';
    }

    function historySection(history) {
        return '<div class="section">' +
               '<div class="section-header collapsed" data-section="history">' +
               '<span class="toggle">\u25BC</span> Build History (' + history.length + ')</div>' +
               '<div class="section-body collapsed"><ul class="history-list">' +
               history.map(function(h) {
                   var cls = h.emptyLayer ? ' history-empty' : '';
                   return '<li class="history-item' + cls + '">' +
                          (h.created ? '<div class="history-time">' + formatTime(h.created) + '</div>' : '') +
                          '<div class="history-cmd">' + esc(h.createdBy || '(empty layer)') + '</div>' +
                          '</li>';
               }).join('') +
               '</ul></div></div>';
    }

    function deleteSection(repo, tag) {
        return '<div class="delete-section">' +
               '<p>Permanently delete this tag from the registry.</p>' +
               '<button class="btn btn-danger" id="delete-btn" data-repo="' + esc(repo) + '" data-tag="' + esc(tag) + '">' +
               'Delete Tag</button></div>';
    }

    function deleteModal(repo, tag) {
        return '<div class="modal-header">' +
               '<h3>Delete Tag</h3>' +
               '<button class="modal-close" id="modal-close-btn">&times;</button>' +
               '</div>' +
               '<div class="modal-body">' +
               '<div class="warning">This action cannot be undone. The tag <strong>' + esc(tag) + '</strong> will be permanently removed from <strong>' + esc(repo) + '</strong>.</div>' +
               '<p>Type the tag name to confirm:</p>' +
               '<input type="text" id="delete-confirm-input" placeholder="' + esc(tag) + '" autocomplete="off">' +
               '</div>' +
               '<div class="modal-footer">' +
               '<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>' +
               '<button class="btn btn-danger" id="modal-delete-btn" disabled>Delete</button>' +
               '</div>';
    }

    return {
        esc: esc,
        formatSize: formatSize,
        formatTime: formatTime,
        relativeTime: relativeTime,
        loading: loading,
        breadcrumb: breadcrumb,
        emptyState: emptyState,
        catalogPage: catalogPage,
        repoDetailPage: repoDetailPage,
        tagDetailPage: tagDetailPage,
        deleteModal: deleteModal,
        sortControls: sortControls
    };
})();
