import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installSocialPreviewRoutes } from '../server/social-preview.js';

test('initial HTML includes safe, route-specific previews without running React', async t => {
  const distDir = await mkdtemp(path.join(tmpdir(), 'antara-social-'));
  await writeFile(path.join(distDir, 'index.html'), await readFile('index.html'));
  await writeFile(path.join(distDir, 'asset.txt'), 'static asset');
  const app = express();
  const queried = [];
  installSocialPreviewRoutes(app, {
    distDir, siteUrl: 'https://antara.test',
    findPost: async slug => {
      queried.push(slug);
      if (slug === 'draft') return undefined;
      return { title: 'Test mission', seoTitle: 'Science " & <script>bad</script>', excerpt: 'A & B',
        coverImage: slug === 'no-cover' ? 'javascript:bad' : '/uploads/cover.jpg', publishedAt: '2026-09-14' };
    },
  });
  app.use(express.static(distDir));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(distDir, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/', '/index.html', '/partners', '/posts/science', '/posts/no-cover']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal((html.match(/property="og:image"/g) || []).length, 1);
    assert.equal((html.match(/<title>/g) || []).length, 1);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    assert.doesNotMatch(html, /bits-goa.example|<script>bad|javascript:bad/);
    if (route.includes('/posts/')) {
      assert.match(html, /Science &quot; &amp; &lt;script&gt;/);
      assert.match(html, /property="og:type" content="article"/);
      assert.match(html, /property="article:published_time"/);
    }
    if (route === '/posts/science') assert.match(html, /https:\/\/antara.test\/uploads\/cover.jpg/);
    else assert.match(html, /https:\/\/antara.test\/social-preview.png/);
    if (route === '/partners') assert.match(html, /<title>Partners - Project Antara<\/title>/);
  }
  assert.equal((await fetch(base + '/posts/draft')).status, 404);
  assert.equal(await (await fetch(base + '/asset.txt')).text(), 'static asset');
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  assert.deepEqual(queried, ['science', 'no-cover', 'draft']);
});
