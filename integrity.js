(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.LCIntegrity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function escapeAttribute(value) {
        return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function actionAttrs(action, ...args) {
        return `data-lc-action="${escapeAttribute(action)}" data-lc-args="${escapeAttribute(JSON.stringify(args))}"`;
    }
    function ownerKey(user) {
        return user?.tenant?.id && user?.id ? `${user.tenant.id}:${user.id}` : null;
    }
    function scopedKey(base, user) {
        const owner = ownerKey(user);
        if (!owner) throw new Error('Kein angemeldeter Nutzer');
        return `${base}:${owner}`;
    }
    class ApiError extends Error {
        constructor(message, status = 0, code = '') { super(message); this.status = status; this.code = code; }
    }
    return { actionAttrs, ownerKey, scopedKey, ApiError };
});
