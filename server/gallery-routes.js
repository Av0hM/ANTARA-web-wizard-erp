import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';

export async function initGallery(pool) {
  await pool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS gallery_revision INTEGER NOT NULL DEFAULT 1");
  await pool.query(`CREATE TABLE IF NOT EXISTS gallery_media (
    id UUID PRIMARY KEY, album_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'video')), src TEXT NOT NULL,
    thumbnail TEXT NOT NULL DEFAULT '', caption TEXT NOT NULL DEFAULT '', alt TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ); CREATE INDEX IF NOT EXISTS idx_gallery_album ON gallery_media(album_id, position, created_at);`);
}
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value, max) => String(value ?? '').replaceAll('\0', '').trim().slice(0, max);
const types = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm' };

export function installGalleryRoutes(app, { pool, requireAdmin, uploadsDir, storeAsset, publicUrl, deleteAsset, clearCache, videoMaxMB = 100, imageMaxMB = 5 }) {
  const directory = path.join(uploadsDir, 'gallery');
  const upload = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => { try { await fs.mkdir(directory, { recursive: true }); cb(null, directory); } catch (e) { cb(e); } },
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${types[file.mimetype] || '.invalid'}`),
    }),
    limits: { fileSize: Math.max(videoMaxMB, imageMaxMB) * 1024 * 1024, files: 1, fields: 3 },
    fileFilter: (_req, file, cb) => cb(types[file.mimetype] ? null : fail(400, 'Use JPEG, PNG, WebP, MP4, or WebM.'), Boolean(types[file.mimetype])),
  });
  const wrap = handler => async (req, res, next) => {
    try { await handler(req, res); } catch (error) {
      if (error.status) res.status(error.status).json({ error: error.message }); else next(error);
    }
  };
  const album = async (slug, admin = false) => {
    const result = await pool.query(`SELECT id, gallery_revision, slug, title, excerpt, cover_image AS "coverImage",
      attachment_path AS "attachmentPath", attachment_thumb_path AS "attachmentThumbnailPath", attachment_mime AS "attachmentMime"
      FROM posts WHERE slug = $1 AND category = 'gallery' ${admin ? '' : 'AND is_published = TRUE'} LIMIT 1`, [slug]);
    if (!result.rows[0]) throw fail(404, 'Album not found.');
    return result.rows[0];
  };
  const details = async (req, res, admin) => {
    const item = await album(req.params.slug, admin);
    const result = await pool.query('SELECT * FROM gallery_media WHERE album_id = $1 ORDER BY position, created_at, id', [item.id]);
    const items = result.rows.map(row => ({ id: row.id, kind: row.kind, src: publicUrl(row.src), thumbnail: publicUrl(row.thumbnail), caption: row.caption, alt: row.alt }));
    // Keep the original single-image albums visible after upgrading.
    if (item.attachmentPath && item.attachmentMime?.startsWith('image/')) items.unshift({ id: 'legacy', kind: 'image', src: publicUrl(item.attachmentPath), thumbnail: publicUrl(item.attachmentThumbnailPath), caption: item.excerpt, alt: item.title });
    res.set('Cache-Control', 'no-store').json({ item: { slug: item.slug, title: item.title, excerpt: item.excerpt, revision: item.gallery_revision, items }, limits: admin ? { videoMaxMB, imageMaxMB } : undefined });
  };
  app.get('/api/albums', wrap(async (req, res) => {
    const rawPage = Number(req.query.page);
    const page = Number.isFinite(rawPage) ? Math.min(100000, Math.max(1, Math.floor(rawPage))) : 1;
    const limit = 12;
    const count = await pool.query("SELECT COUNT(*)::int AS total FROM posts WHERE category = 'gallery' AND is_published = TRUE");
    const result = await pool.query(`SELECT p.slug, p.title, p.excerpt,
      COALESCE(NULLIF(p.cover_image, ''), NULLIF(p.attachment_thumb_path, ''),
        (SELECT NULLIF(m.thumbnail, '') FROM gallery_media m WHERE m.album_id = p.id AND m.kind = 'image' ORDER BY m.position, m.created_at, m.id LIMIT 1), '') AS "coverImage",
      ((SELECT COUNT(*) FROM gallery_media m WHERE m.album_id = p.id) + CASE WHEN p.attachment_mime LIKE 'image/%' AND p.attachment_path <> '' THEN 1 ELSE 0 END)::int AS "mediaCount"
      FROM posts p WHERE p.category = 'gallery' AND p.is_published = TRUE ORDER BY p.published_at DESC, p.id DESC LIMIT $1 OFFSET $2`, [limit, (page - 1) * limit]);
    res.set('Cache-Control', 'no-store').json({ items: result.rows.map(row => ({ ...row, coverImage: publicUrl(row.coverImage) })), hasMore: page * limit < count.rows[0].total });
  }));
  app.get('/api/albums/:slug', wrap((req, res) => details(req, res, false)));
  app.get('/api/admin/albums/:slug', requireAdmin, wrap((req, res) => details(req, res, true)));
  app.post('/api/admin/albums/:slug/media', requireAdmin, (req, res, next) => {
    upload.single('media')(req, res, error => {
      if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? `File exceeds the ${Math.max(videoMaxMB, imageMaxMB)} MB upload limit.` : error.message });
      next();
    });
  }, wrap(async (req, res) => {
    const file = req.file;
    let main = '', thumb = '';
    let committed = false;
    try {
      const item = await album(req.params.slug, true);
      if (!file) throw fail(400, 'Choose a media file.');
      const kind = file.mimetype.startsWith('image/') ? 'image' : 'video';
      if (file.size > (kind === 'image' ? imageMaxMB : videoMaxMB) * 1024 * 1024) throw fail(400, `${kind === 'image' ? 'Photo' : 'Video'} exceeds its upload limit.`);
      if (kind === 'image') {
        try {
          const metadata = await sharp(file.path).metadata();
          if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Invalid image');
          await sharp(file.path).rotate().resize({ width: 640, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${file.path}.thumb.webp`);
        } catch { throw fail(400, 'The image could not be decoded. Use a valid JPEG, PNG, or WebP.'); }
      } else {
        const handle = await fs.open(file.path, 'r');
        const header = Buffer.alloc(12);
        try { await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
        const valid = file.mimetype === 'video/mp4' ? header.toString('ascii', 4, 8) === 'ftyp' : header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
        if (!valid) throw fail(400, 'The video does not match the selected format.');
      }
      main = await storeAsset(`/uploads/gallery/${file.filename}`, file.mimetype);
      if (kind === 'image') thumb = await storeAsset(`/uploads/gallery/${file.filename}.thumb.webp`, 'image/webp');
      await pool.query(`INSERT INTO gallery_media (id, album_id, kind, src, thumbnail, caption, alt, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE((SELECT MAX(position) + 1 FROM gallery_media WHERE album_id = $2), 0))`,
      [crypto.randomUUID(), item.id, kind, main, thumb, text(req.body.caption, 2000), text(req.body.alt, 500)]);
      committed = true;
      await pool.query("UPDATE posts SET gallery_revision = gallery_revision + 1 WHERE id = $1", [item.id]);
      await clearCache();
      res.status(201).json({ ok: true });
    } finally {
      if (!committed) { await deleteAsset(main); await deleteAsset(thumb); }
      if (file && !committed) {
        await fs.rm(file.path, { force: true });
        await fs.rm(`${file.path}.thumb.webp`, { force: true });
      }
    }
  }));
  app.put('/api/admin/albums/:slug/media', requireAdmin, wrap(async (req, res) => {
    const item = await album(req.params.slug, true);
    if (!Array.isArray(req.body?.items) || req.body.items.length > 1000) throw fail(400, 'Invalid media list.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lock = await client.query("UPDATE posts SET gallery_revision = gallery_revision + 1 WHERE id = $1 AND gallery_revision = $2 RETURNING id", [item.id, Number(req.body.expectedRevision) || 0]);
      if (!lock.rowCount) throw fail(409, 'Album changed. Copy your captions, then reload before saving.');
      const existing = await client.query('SELECT id FROM gallery_media WHERE album_id = $1 FOR UPDATE', [item.id]);
      const ids = req.body.items.map(row => row?.id);
      if (new Set(ids).size !== ids.length || existing.rows.length !== ids.length || existing.rows.some(row => !ids.includes(row.id))) throw fail(409, 'Album changed. Reload it before saving the order.');
      for (const [position, row] of req.body.items.entries()) {
        await client.query('UPDATE gallery_media SET caption = $1, alt = $2, position = $3 WHERE id = $4 AND album_id = $5', [text(row.caption, 2000), text(row.alt, 500), position, row.id, item.id]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await clearCache();
    res.json({ ok: true });
  }));
  app.delete('/api/admin/albums/:slug/media/:id', requireAdmin, wrap(async (req, res) => {
    const item = await album(req.params.slug, true);
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(req.params.id)) throw fail(400, 'Invalid media ID.');
    const client = await pool.connect();
    let src, thumbnail;
    try {
      await client.query('BEGIN');
      const lock = await client.query('UPDATE posts SET gallery_revision = gallery_revision + 1 WHERE id = $1 AND gallery_revision = $2 RETURNING id', [item.id, Number(req.headers['if-match']) || 0]);
      if (!lock.rowCount) throw fail(409, 'Album changed. Reload media before deleting a file.');
      const result = await client.query('DELETE FROM gallery_media WHERE album_id = $1 AND id = $2 RETURNING src, thumbnail', [item.id, req.params.id]);
      if (!result.rows[0]) throw fail(404, 'Media not found.');
      ({ src, thumbnail } = result.rows[0]);
      await client.query("UPDATE posts SET cover_image = '', updated_at = NOW(), version = version + 1 WHERE id = $1 AND cover_image = ANY($2::text[])", [item.id, [src, thumbnail, publicUrl(src), publicUrl(thumbnail)]]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await deleteAsset(src); await deleteAsset(thumbnail);
    await clearCache();
    res.json({ ok: true });
  }));
}
