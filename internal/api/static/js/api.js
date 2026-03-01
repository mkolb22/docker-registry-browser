/* Registry Browser API Client */
var API = (function() {
    'use strict';

    function APIError(status, message, code) {
        this.status = status;
        this.message = message;
        this.code = code;
    }
    APIError.prototype = Object.create(Error.prototype);

    async function request(method, path, params) {
        var url = '/api/v1' + path;
        if (params) {
            var qs = Object.keys(params)
                .filter(function(k) { return params[k] !== undefined && params[k] !== ''; })
                .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
                .join('&');
            if (qs) url += '?' + qs;
        }

        var resp = await fetch(url, { method: method });
        var body;
        try {
            body = await resp.json();
        } catch (e) {
            body = null;
        }

        if (!resp.ok) {
            var msg = (body && body.error) || resp.statusText;
            var code = (body && body.code) || '';
            throw new APIError(resp.status, msg, code);
        }

        return body;
    }

    return {
        getConfig: function() {
            return request('GET', '/config');
        },

        listRepositories: function(pageSize, last) {
            return request('GET', '/repositories', { pageSize: pageSize, last: last });
        },

        listTags: function(repo, sort, order) {
            return request('GET', '/tags', { repo: repo, sort: sort, order: order });
        },

        getTagDetail: function(repo, tag) {
            return request('GET', '/tag', { repo: repo, tag: tag });
        },

        deleteTag: function(repo, tag) {
            return request('DELETE', '/tag', { repo: repo, tag: tag });
        },

        getTagDigests: function(repo) {
            return request('GET', '/tag-digests', { repo: repo });
        },

        getStats: function() {
            return request('GET', '/stats');
        },

        getReferrers: function(repo, digest) {
            return request('GET', '/referrers', { repo: repo, digest: digest });
        },

        APIError: APIError
    };
})();
