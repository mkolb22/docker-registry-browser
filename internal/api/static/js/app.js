/* Registry Browser SPA Router & App Logic */
(function() {
    'use strict';

    var state = {
        config: null,
        catalogs: [],
        lastEntry: '',
        hasMore: false
    };

    var appEl, headerActions;

    // === Router ===

    var routes = [
        { pattern: /^#\/repo\/(.+?)\/tag\/(.+)$/, handler: 'tagDetail' },
        { pattern: /^#\/repo\/(.+)$/, handler: 'repoDetail' },
        { pattern: /^#?\/?$/, handler: 'catalog' }
    ];

    function getRoute() {
        var hash = window.location.hash || '#/';
        for (var i = 0; i < routes.length; i++) {
            var m = hash.match(routes[i].pattern);
            if (m) {
                return { handler: routes[i].handler, params: Array.prototype.slice.call(m, 1).map(decodeURIComponent) };
            }
        }
        return { handler: 'catalog', params: [] };
    }

    function navigate() {
        var route = getRoute();
        switch (route.handler) {
            case 'catalog':
                loadCatalog();
                break;
            case 'repoDetail':
                loadRepoDetail(route.params[0]);
                break;
            case 'tagDetail':
                loadTagDetail(route.params[0], route.params[1]);
                break;
            default:
                loadCatalog();
        }
    }

    // === Pages ===

    function loadCatalog(lastEntry) {
        if (!lastEntry) {
            appEl.innerHTML = Components.loading();
            state.catalogs = [];
            state.lastEntry = '';
            state.hasMore = false;
        }

        Promise.all([
            state.config ? Promise.resolve(state.config) : API.getConfig(),
            API.listRepositories(state.config ? state.config.catalogPageSize : undefined, lastEntry)
        ]).then(function(results) {
            state.config = results[0];
            var data = results[1];

            // Merge namespaces
            var ns = data.namespaces || {};
            Object.keys(ns).forEach(function(key) {
                var existing = findNamespace(key);
                if (existing) {
                    existing.push.apply(existing, ns[key]);
                } else {
                    state.catalogs.push({ name: key, repos: ns[key] });
                }
            });

            state.hasMore = data.hasMore;
            state.lastEntry = data.lastEntry;

            // Rebuild merged namespaces for render
            var merged = {};
            state.catalogs.forEach(function(c) {
                merged[c.name] = c.repos;
            });

            appEl.innerHTML = Components.catalogPage(
                { namespaces: merged, hasMore: state.hasMore, lastEntry: state.lastEntry },
                state.config
            );

            updateHeaderVersion();
            bindCatalogEvents();
        }).catch(handleError);
    }

    function findNamespace(name) {
        for (var i = 0; i < state.catalogs.length; i++) {
            if (state.catalogs[i].name === name) return state.catalogs[i].repos;
        }
        return null;
    }

    function loadRepoDetail(repo) {
        appEl.innerHTML = Components.loading();

        var sort = localStorage.getItem('rb-sort') || (state.config && state.config.defaultSortBy) || 'name';
        var order = localStorage.getItem('rb-order') || (state.config && state.config.defaultSortOrder) || 'desc';

        Promise.all([
            state.config ? Promise.resolve(state.config) : API.getConfig(),
            API.listTags(repo, sort, order)
        ]).then(function(results) {
            state.config = results[0];
            var tagData = results[1];

            appEl.innerHTML = Components.repoDetailPage(repo, tagData, state.config);
            updateHeaderVersion();
            bindSortEvents(repo);
        }).catch(handleError);
    }

    function loadTagDetail(repo, tag) {
        appEl.innerHTML = Components.loading();

        Promise.all([
            state.config ? Promise.resolve(state.config) : API.getConfig(),
            API.getTagDetail(repo, tag)
        ]).then(function(results) {
            state.config = results[0];
            var detail = results[1];

            appEl.innerHTML = Components.tagDetailPage(detail, state.config);
            updateHeaderVersion();
            bindTagDetailEvents(repo, tag);
        }).catch(handleError);
    }

    // === Event Binding ===

    function bindCatalogEvents() {
        var loadMore = appEl.querySelector('.btn-load-more');
        if (loadMore) {
            loadMore.addEventListener('click', function() {
                loadMore.textContent = 'Loading...';
                loadMore.disabled = true;
                loadCatalog(state.lastEntry);
            });
        }
    }

    function bindSortEvents(repo) {
        var sortBy = document.getElementById('sort-by');
        var sortOrder = document.getElementById('sort-order');

        function onSortChange() {
            var s = sortBy.value;
            var o = sortOrder.value;
            localStorage.setItem('rb-sort', s);
            localStorage.setItem('rb-order', o);
            loadRepoDetailWithSort(repo, s, o);
        }

        if (sortBy) sortBy.addEventListener('change', onSortChange);
        if (sortOrder) sortOrder.addEventListener('change', onSortChange);
    }

    function loadRepoDetailWithSort(repo, sort, order) {
        appEl.innerHTML = Components.loading();

        API.listTags(repo, sort, order).then(function(tagData) {
            appEl.innerHTML = Components.repoDetailPage(repo, tagData, state.config);
            bindSortEvents(repo);
        }).catch(handleError);
    }

    function bindTagDetailEvents(repo, tag) {
        // Tab switching
        var tabs = appEl.querySelectorAll('.tab');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                var idx = tab.getAttribute('data-tab');
                tabs.forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');
                appEl.querySelectorAll('.manifest-panel').forEach(function(p) {
                    p.style.display = p.getAttribute('data-panel') === idx ? '' : 'none';
                });
            });
        });

        // Section collapsing
        appEl.querySelectorAll('.section-header').forEach(function(header) {
            header.addEventListener('click', function() {
                header.classList.toggle('collapsed');
                var body = header.nextElementSibling;
                if (body) body.classList.toggle('collapsed');
            });
        });

        // Copy button
        appEl.querySelectorAll('.copy-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var text = btn.getAttribute('data-copy');
                navigator.clipboard.writeText(text).then(function() {
                    toast('Copied to clipboard', 'success');
                });
            });
        });

        // Delete button
        var deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                showDeleteModal(repo, tag);
            });
        }
    }

    // === Delete Modal ===

    function showDeleteModal(repo, tag) {
        var backdrop = document.getElementById('modal-backdrop');
        var content = document.getElementById('modal-content');
        content.innerHTML = Components.deleteModal(repo, tag);
        backdrop.classList.remove('hidden');

        var input = document.getElementById('delete-confirm-input');
        var deleteBtn = document.getElementById('modal-delete-btn');
        var cancelBtn = document.getElementById('modal-cancel-btn');
        var closeBtn = document.getElementById('modal-close-btn');

        input.addEventListener('input', function() {
            deleteBtn.disabled = input.value !== tag;
        });

        deleteBtn.addEventListener('click', function() {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';

            API.deleteTag(repo, tag).then(function() {
                hideModal();
                toast('Tag ' + tag + ' deleted successfully', 'success');
                window.location.hash = '#/repo/' + encodeURIComponent(repo);
            }).catch(function(err) {
                hideModal();
                toast('Failed to delete: ' + err.message, 'error');
            });
        });

        cancelBtn.addEventListener('click', hideModal);
        closeBtn.addEventListener('click', hideModal);
        backdrop.addEventListener('click', function(e) {
            if (e.target === backdrop) hideModal();
        });
    }

    function hideModal() {
        document.getElementById('modal-backdrop').classList.add('hidden');
    }

    // === Toast ===

    function toast(message, type) {
        var container = document.getElementById('toast-container');
        var el = document.createElement('div');
        el.className = 'toast toast-' + (type || 'info');
        el.textContent = message;
        container.appendChild(el);
        setTimeout(function() {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.3s';
            setTimeout(function() { el.remove(); }, 300);
        }, 3000);
    }

    // === Helpers ===

    function updateHeaderVersion() {
        if (state.config && state.config.version) {
            headerActions.innerHTML = '<span class="header-version">v' + Components.esc(state.config.version) + '</span>';
        }
    }

    function handleError(err) {
        console.error(err);
        appEl.innerHTML = Components.emptyState('\u26A0\uFE0F',
            'Error: ' + (err.message || 'Unknown error'));
        toast(err.message || 'An error occurred', 'error');
    }

    // === Init ===

    function init() {
        appEl = document.getElementById('app');
        headerActions = document.getElementById('header-actions');
        window.addEventListener('hashchange', navigate);
        navigate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
