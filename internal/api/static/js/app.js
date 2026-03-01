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
        { pattern: /^#\/dashboard$/, handler: 'dashboard' },
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
            case 'dashboard':
                loadDashboard();
                break;
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

    // === Page Transition (Proposal 2) ===

    function renderPage(html) {
        appEl.innerHTML = html;
        // Trigger stagger animations
        requestAnimationFrame(function() {
            var items = appEl.querySelectorAll('.stagger-item');
            items.forEach(function(el, i) {
                el.style.animationDelay = (i * 30) + 'ms';
                el.classList.add('stagger-animate');
            });
            var page = appEl.querySelector('.page-enter');
            if (page) page.classList.add('page-enter-active');
        });
    }

    // === Pages ===

    function loadCatalog(lastEntry) {
        if (!lastEntry) {
            appEl.innerHTML = Components.catalogSkeleton();
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

            var merged = {};
            state.catalogs.forEach(function(c) {
                merged[c.name] = c.repos;
            });

            renderPage(Components.catalogPage(
                { namespaces: merged, hasMore: state.hasMore, lastEntry: state.lastEntry },
                state.config
            ));

            updateHeader();
            bindCatalogEvents();
            bindSearchEvents();
        }).catch(handleError);
    }

    function findNamespace(name) {
        for (var i = 0; i < state.catalogs.length; i++) {
            if (state.catalogs[i].name === name) return state.catalogs[i].repos;
        }
        return null;
    }

    function loadRepoDetail(repo) {
        appEl.innerHTML = Components.repoDetailSkeleton();

        var sort = localStorage.getItem('rb-sort') || (state.config && state.config.defaultSortBy) || 'name';
        var order = localStorage.getItem('rb-order') || (state.config && state.config.defaultSortOrder) || 'desc';

        Promise.all([
            state.config ? Promise.resolve(state.config) : API.getConfig(),
            API.listTags(repo, sort, order),
            API.getTagDigests(repo).catch(function() { return { digests: {} }; })
        ]).then(function(results) {
            state.config = results[0];
            var tagData = results[1];
            var digestData = results[2];

            renderPage(Components.repoDetailPage(repo, tagData, state.config, digestData.digests));
            updateHeader();
            bindSortEvents(repo);
            bindSearchEvents();
            bindCompareEvents(repo);

            // Progressive freshness loading (Proposal 3)
            loadFreshnessIndicators(repo, tagData.tags);
        }).catch(handleError);
    }

    function loadRepoDetailWithSort(repo, sort, order) {
        appEl.innerHTML = Components.repoDetailSkeleton();

        Promise.all([
            API.listTags(repo, sort, order),
            API.getTagDigests(repo).catch(function() { return { digests: {} }; })
        ]).then(function(results) {
            var tagData = results[0];
            var digestData = results[1];
            renderPage(Components.repoDetailPage(repo, tagData, state.config, digestData.digests));
            bindSortEvents(repo);
            bindSearchEvents();
            bindCompareEvents(repo);
            loadFreshnessIndicators(repo, tagData.tags);
        }).catch(handleError);
    }

    function loadTagDetail(repo, tag) {
        appEl.innerHTML = Components.tagDetailSkeleton();

        Promise.all([
            state.config ? Promise.resolve(state.config) : API.getConfig(),
            API.getTagDetail(repo, tag)
        ]).then(function(results) {
            state.config = results[0];
            var detail = results[1];

            // Try to fetch referrers (Proposal 14) — non-blocking
            var referrersPromise = Promise.resolve(null);
            if (detail.contentDigest) {
                referrersPromise = API.getReferrers(repo, detail.contentDigest).catch(function() { return null; });
            }

            return referrersPromise.then(function(refData) {
                var refs = (refData && refData.referrers) || null;
                renderPage(Components.tagDetailPage(detail, state.config, refs));
                updateHeader();
                bindTagDetailEvents(repo, tag);
            });
        }).catch(handleError);
    }

    // === Dashboard (Proposal 12) ===

    function loadDashboard() {
        appEl.innerHTML = Components.dashboardSkeleton();

        Promise.all([
            state.config ? Promise.resolve(state.config) : API.getConfig(),
            API.getStats()
        ]).then(function(results) {
            state.config = results[0];
            var stats = results[1];
            renderPage(Components.dashboardPage(stats));
            updateHeader();
            animateCounters();
        }).catch(handleError);
    }

    function animateCounters() {
        var counters = appEl.querySelectorAll('.stat-value[data-target]');
        counters.forEach(function(el) {
            var target = parseFloat(el.getAttribute('data-target'));
            if (isNaN(target)) return;
            var start = 0;
            var duration = 800;
            var startTime = null;
            var isFloat = String(target).indexOf('.') >= 0;

            function step(ts) {
                if (!startTime) startTime = ts;
                var progress = Math.min((ts - startTime) / duration, 1);
                var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                var current = start + (target - start) * eased;
                el.textContent = isFloat ? current.toFixed(1) : Math.round(current);
                if (progress < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });
    }

    // === Freshness Indicators (Proposal 3) ===

    function loadFreshnessIndicators(repo, tags) {
        if (!tags || tags.length === 0) return;

        // Batch fetch — load first 20 tag details progressively
        var batchSize = 5;
        var queue = tags.slice(0, 30);

        function processBatch(batch) {
            var promises = batch.map(function(tag) {
                return API.getTagDetail(repo, tag).then(function(detail) {
                    var dot = appEl.querySelector('.freshness-dot[data-tag="' + CSS.escape(tag) + '"]');
                    if (dot && detail.manifests && detail.manifests[0] && detail.manifests[0].created) {
                        var cls = Components.freshnessClass(detail.manifests[0].created);
                        dot.className = 'freshness-dot ' + cls;
                        dot.title = Components.relativeTime(detail.manifests[0].created);
                    }
                }).catch(function() {});
            });
            return Promise.all(promises);
        }

        function processQueue() {
            if (queue.length === 0) return;
            var batch = queue.splice(0, batchSize);
            processBatch(batch).then(processQueue);
        }

        processQueue();
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

    // === Search/Filter (Proposal 4) ===

    function bindSearchEvents() {
        var input = appEl.querySelector('.search-input');
        if (!input) return;

        input.addEventListener('input', function() {
            var query = input.value.toLowerCase().trim();
            var items = appEl.querySelectorAll('.filterable');
            items.forEach(function(el) {
                var name = (el.getAttribute('data-name') || '').toLowerCase();
                if (!query || name.indexOf(query) >= 0) {
                    el.classList.remove('filtered-out');
                    // Highlight matching text
                    var nameEl = el.querySelector('.repo-name, .tag-name');
                    if (nameEl && query) {
                        var original = el.getAttribute('data-name');
                        var idx = original.toLowerCase().indexOf(query);
                        if (idx >= 0) {
                            nameEl.innerHTML = Components.esc(original.substring(0, idx)) +
                                '<mark>' + Components.esc(original.substring(idx, idx + query.length)) + '</mark>' +
                                Components.esc(original.substring(idx + query.length));
                        }
                    } else if (nameEl) {
                        nameEl.textContent = el.getAttribute('data-name');
                    }
                } else {
                    el.classList.add('filtered-out');
                }
            });
        });
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

    // === Compare Events (Proposal 11) ===

    function bindCompareEvents(repo) {
        var btn = document.getElementById('compare-btn');
        if (!btn) return;

        btn.addEventListener('click', function() {
            var tagA = document.getElementById('compare-a').value;
            var tagB = document.getElementById('compare-b').value;
            if (tagA === tagB) {
                toast('Select two different tags', 'error');
                return;
            }

            var resultEl = document.getElementById('compare-result');
            resultEl.innerHTML = '<div class="loading-container" style="padding:20px"><div class="spinner"></div></div>';

            Promise.all([
                API.getTagDetail(repo, tagA),
                API.getTagDetail(repo, tagB)
            ]).then(function(results) {
                resultEl.innerHTML = Components.compareResult(tagA, results[0], tagB, results[1]);
            }).catch(function(err) {
                resultEl.innerHTML = '<p class="text-danger">Comparison failed: ' + Components.esc(err.message) + '</p>';
            });
        });
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
                // Update constellation active state
                appEl.querySelectorAll('.constellation-node').forEach(function(n) {
                    n.classList.toggle('active', n.getAttribute('data-tab') === idx);
                });
            });
        });

        // Constellation node clicks (Proposal 10)
        appEl.querySelectorAll('.constellation-node').forEach(function(node) {
            node.addEventListener('click', function() {
                var idx = node.getAttribute('data-tab');
                // Trigger corresponding tab
                var tab = appEl.querySelector('.tab[data-tab="' + idx + '"]');
                if (tab) tab.click();
            });
            node.style.cursor = 'pointer';
        });

        // Copy button with animation (Proposal 6)
        appEl.querySelectorAll('.copy-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var text = btn.getAttribute('data-copy');
                navigator.clipboard.writeText(text).then(function() {
                    btn.classList.add('copied');
                    btn.textContent = 'Copied!';
                    setTimeout(function() {
                        btn.classList.remove('copied');
                        btn.textContent = 'Copy';
                    }, 1500);
                });
            });
        });

        // Layer bar hover highlight
        appEl.querySelectorAll('.layer-bar-seg').forEach(function(seg) {
            seg.addEventListener('mouseenter', function() {
                var idx = seg.getAttribute('data-layer');
                var info = appEl.querySelectorAll('.layer-info')[idx];
                if (info) info.classList.add('layer-highlight');
            });
            seg.addEventListener('mouseleave', function() {
                appEl.querySelectorAll('.layer-info').forEach(function(el) {
                    el.classList.remove('layer-highlight');
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

    function updateHeader() {
        if (!state.config) return;
        var html = '';
        if (state.config.version) {
            html += '<span class="header-version">v' + Components.esc(state.config.version) + '</span>';
        }
        html += '<a href="#/dashboard" class="header-dashboard-link" title="Dashboard">Dashboard</a>';
        headerActions.innerHTML = html;
    }

    function handleError(err) {
        console.error(err);
        renderPage('<div class="page-enter">' + Components.emptyState('\u26A0\uFE0F',
            'Error: ' + (err.message || 'Unknown error')) + '</div>');
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
