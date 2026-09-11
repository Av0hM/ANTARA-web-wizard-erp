import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { installMediaRoutes } from "../server/media-routes.js";

test("media URLs serve the source asset and support browser range requests", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "antara-media-"));
  await mkdir(path.join(root, "src/assets"), { recursive: true });
  await mkdir(path.join(root, "dist"));
  await writeFile(path.join(root, "src/assets/journey.mp4"), "0123456789");
  await writeFile(path.join(root, "dist/journey.mp4"), "STALE BUILD");
  const app = express();
  installMediaRoutes(app, root);
  app.use((error, _req, res, _next) => res.status(error.status || 500).end());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true }); });
  const url = `http://127.0.0.1:${server.address().port}/journey.mp4`;
  const full = await fetch(url);
  assert.equal(await full.text(), "0123456789");
  assert.match(full.headers.get("content-type"), /video\/mp4/);
  assert.doesNotMatch(full.headers.get("cache-control"), /immutable/);
  for (const [range, expected, contentRange] of [
    ["bytes=2-5", "2345", "bytes 2-5/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=8-", "89", "bytes 8-9/10"],
    ["bytes=8-999", "89", "bytes 8-9/10"],
  ]) {
    const response = await fetch(url, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), contentRange);
    assert.equal(await response.text(), expected);
  }
  const invalid = await fetch(url, { headers: { Range: "bytes=100-200" } });
  assert.equal(invalid.status, 416);
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.headers.get("content-length"), "10");
  assert.equal(await head.text(), "");
  const missing = await fetch(url.replace("journey.mp4", "journey-poster.webp"));
  assert.equal(missing.status, 404);
});
