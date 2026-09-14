import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import sharp from 'sharp';

// Explicit opt-in: this suite creates an isolated temporary database and server.
test('admin and gallery workflows against PostgreSQL', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'antara-admin-test-'));
  const database = `antara_test_${crypto.randomBytes(6).toString('hex')}`;
  const manager = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await manager.query(`CREATE DATABASE ${database}`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.pathname = `/${database}`;
  const db = new Pool({ connectionString: url.href });
  const port = 18879;
  const child = spawn(process.execPath, ['server/index.js'], { env: {
    ...process.env, DATABASE_URL: url.href, PGSSL: 'false', PORT: String(port),
    ADMIN_USERNAME: 'test-admin', ADMIN_PASSWORD: 'test-password', AUTH_SECRET: 'test-only-secret',
    UPLOAD_DIR: path.join(root, 'uploads'), BACKUP_DIR: path.join(root, 'backups'),
    UPLOAD_STORAGE: 'local', REDIS_URL: '', UPLOAD_PUBLIC_BASE_URL: '', CDN_BASE_URL: '',
    BACKUP_ENABLED: 'false', RATE_LIMIT_MAX: '10000', SITE_URL: `http://127.0.0.1:${port}`,
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
  t.after(async () => {
    if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    await db.end(); await manager.query(`DROP DATABASE ${database} WITH (FORCE)`); await manager.end();
    await fs.rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { ready = (await fetch(base + '/api/health')).ok; } catch { /* Wait for startup. */ }
    if (ready || child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);
  const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test-admin', password: 'test-password' }) });
  const { token } = await login.json(); assert.ok(token);
  const auth = { Authorization: `Bearer ${token}` };
  const form = fields => { const body = new FormData(); for (const [key, value] of Object.entries(fields)) body.set(key, String(value)); return body; };
  const detail = async slug => (await (await fetch(base + `/api/posts/${slug}?includeDraft=true`, { headers: auth })).json()).item;
  const media = async () => (await (await fetch(base + '/api/admin/albums/test-album', { headers: auth })).json()).item;
  const change = (slug, fields) => fetch(base + `/api/posts/${slug}`, { method: 'PUT', headers: auth, body: form(fields) });
  const image = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#224488' } }).png().toBuffer();
  const upload = (bytes, mime = 'image/png') => {
    const body = new FormData(); body.set('media', new Blob([bytes], { type: mime }), mime.startsWith('image') ? 'photo.png' : 'clip.mp4');
    return fetch(base + '/api/admin/albums/test-album/media', { method: 'POST', headers: auth, body });
  };
  await t.test('drafts stay private and all mutations require authentication', async () => {
    const response = await fetch(base + '/api/posts', { method: 'POST', headers: auth, body: form({ title: 'Test album', slug: 'test-album', category: 'gallery' }) });
    assert.equal(response.status, 201);
    assert.equal((await fetch(base + '/api/albums/test-album')).status, 404);
    assert.equal((await fetch(base + '/api/albums')).status, 200);
    assert.equal((await (await fetch(base + '/api/albums')).json()).items.length, 0);
    for (const [route, method] of [['/api/admin/albums/test-album', 'GET'], ['/api/admin/albums/test-album/media', 'POST'], ['/api/admin/albums/test-album/media', 'PUT'], ['/api/admin/albums/test-album/media/anything', 'DELETE']]) {
      assert.equal((await fetch(base + route, { method })).status, 401);
    }
    assert.equal((await upload(image)).status, 201);
    assert.equal((await upload(image)).status, 201);
  });
  await t.test('uploads reject malformed media and clean temporary files', async () => {
    const before = await fs.readdir(path.join(root, 'uploads/gallery'));
    assert.equal((await upload(Buffer.from('not a png'))).status, 400);
    assert.equal((await upload(Buffer.from('not a video'), 'video/mp4')).status, 400);
    assert.deepEqual(await fs.readdir(path.join(root, 'uploads/gallery')), before);
  });
  await t.test('captions and ordering detect stale or incomplete edits', async () => {
    const first = await media(); assert.equal(first.items.length, 2);
    const save = payload => fetch(base + '/api/admin/albums/test-album/media', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const items = first.items.toReversed().map((row, index) => ({ ...row, caption: `Caption ${index}`, alt: `Description ${index}` }));
    assert.equal((await save({ items, expectedRevision: first.revision })).status, 200);
    assert.equal((await save({ items, expectedRevision: first.revision })).status, 409);
    const updated = await media(); assert.equal(updated.items[0].id, first.items[1].id);
    assert.equal(updated.items[0].caption, 'Caption 0');
    assert.equal((await save({ items: items.slice(1), expectedRevision: updated.revision })).status, 409);
  });
  await t.test('concurrent post saves cannot overwrite newer work', async () => {
    const post = await detail('test-album');
    const responses = await Promise.all([change(post.slug, { expectedVersion: post.version, title: 'Title A' }), change(post.slug, { expectedVersion: post.version, title: 'Title B' })]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    assert.equal((await change(post.slug, { expectedVersion: post.version, status: 'published' })).status, 409);
    const updated = await detail(post.slug);
    assert.equal((await change(post.slug, { expectedVersion: updated.version, status: 'published' })).status, 200);
  });
  await t.test('public album list contains summaries, not full media URLs', async () => {
    const response = await (await fetch(base + '/api/albums')).json();
    assert.equal(response.items[0].mediaCount, 2);
    assert.equal(response.items[0].items, undefined);
    const serialized = JSON.stringify(response);
    for (const item of (await media()).items) assert.ok(!serialized.includes(`"${item.src}"`));
    const opened = await (await fetch(base + '/api/albums/test-album')).json();
    assert.equal(opened.item.items.length, 2);
  });
  await t.test('single-file deletion requires a current album revision', async () => {
    const before = await media();
    assert.equal((await upload(image)).status, 201);
    const updated = await media();
    const added = updated.items.find(row => !before.items.some(old => old.id === row.id));
    const remove = revision => fetch(base + `/api/admin/albums/test-album/media/${added.id}`, { method: 'DELETE', headers: { ...auth, 'If-Match': String(revision) } });
    assert.equal((await remove(before.revision)).status, 409);
    assert.equal((await remove(updated.revision)).status, 200);
    await assert.rejects(fs.stat(path.join(root, added.src)), { code: 'ENOENT' });
  });
  await t.test('spoofed post attachments are rejected instead of served as HTML', async () => {
    const before = await detail('test-album');
    const body = form({ expectedVersion: before.version });
    body.set('attachment', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'attack.html');
    assert.equal((await fetch(base + '/api/posts/test-album', { method: 'PUT', headers: auth, body })).status, 400);
    assert.equal((await detail('test-album')).version, before.version);
  });
  await t.test('failed attachment replacement retains the old file', async () => {
    let post = await detail('test-album');
    const first = form({ expectedVersion: post.version }); first.set('attachment', new Blob([image], { type: 'image/png' }), 'original.png');
    assert.equal((await fetch(base + '/api/posts/test-album', { method: 'PUT', headers: auth, body: first })).status, 200);
    post = await detail('test-album');
    const original = path.join(root, post.attachmentPath);
    assert.ok((await fs.stat(original)).size > 0);
    const stale = form({ expectedVersion: post.version - 1 }); stale.set('attachment', new Blob([image], { type: 'image/png' }), 'replacement.png');
    assert.equal((await fetch(base + '/api/posts/test-album', { method: 'PUT', headers: auth, body: stale })).status, 409);
    assert.ok((await fs.stat(original)).size > 0);
  });
  await t.test('backup contains gallery metadata and deletion checks versions and cleans files', async () => {
    const backup = await fetch(base + '/api/admin/backups/run', { method: 'POST', headers: auth }); assert.equal(backup.status, 200);
    const { backupPath } = await backup.json();
    assert.equal(JSON.parse(await fs.readFile(path.join(backupPath, 'gallery-media.json'), 'utf8')).length, 2);
    const post = await detail('test-album');
    assert.equal((await fetch(base + '/api/posts/test-album', { method: 'DELETE', headers: { ...auth, 'If-Match': String(post.version - 1) } })).status, 409);
    const files = (await media()).items.filter(row => row.id !== 'legacy');
    assert.equal((await fetch(base + '/api/posts/test-album', { method: 'DELETE', headers: { ...auth, 'If-Match': String(post.version) } })).status, 200);
    assert.equal((await db.query('SELECT * FROM gallery_media')).rows.length, 0);
    for (const file of files) await assert.rejects(fs.stat(path.join(root, file.src)), { code: 'ENOENT' });
  });
});
