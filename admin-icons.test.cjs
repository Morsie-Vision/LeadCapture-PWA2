const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
test('admin uses independent manifest, touch icon and favicon', () => {
    for (const file of ['admin-manifest.json', 'icons/admin-apple-touch-icon.png', 'icons/admin-favicon-32.png', 'icons/admin-icon-192.png']) {
        assert(html.includes('./' + file));
        assert(fs.existsSync(path.join(__dirname, file)));
    }
    assert(html.includes('content="LC Admin"'));
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'admin-manifest.json')));
    assert.equal(manifest.start_url, './admin.html');
    assert.equal(manifest.id, './admin.html');
    assert.equal(manifest.theme_color, '#10151C');
    const app = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json')));
    assert.equal(app.start_url, './index.html');
    assert(app.icons.every(i => !i.src.includes('admin-')));
});
test('all admin PNGs have their declared pixel dimensions', () => {
    for (const [name, size] of [['admin-icon-192.png',192],['admin-icon-512.png',512],['admin-apple-touch-icon.png',180],['admin-favicon-32.png',32]]) {
        const data = fs.readFileSync(path.join(__dirname, 'icons', name));
        assert.equal(data.toString('hex', 0, 8), '89504e470d0a1a0a');
        assert.equal(data.readUInt32BE(16), size);
        assert.equal(data.readUInt32BE(20), size);
    }
});
test('admin scripts remain syntactically valid', () => {
    for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
});
