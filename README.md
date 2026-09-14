# Project Antara Web Platform

This project is now a dynamic full-stack app:

- `React + Vite` frontend
- `Node.js + Express` backend
- `PostgreSQL` database (using `pg`)
- File uploads for post attachments
- SEO baseline (`meta tags`, `robots.txt`, `sitemap.xml`)

## Run locally

```bash
npm install
npm run dev
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8787`

## Production

```bash
npm run build
npm run start
```

The backend serves the built frontend from `dist/` when available.

## Environment variables

Set these before public deployment:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/antara
PGSSL=false
CORS_ORIGINS=http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
UPLOAD_MAX_MB=5
CACHE_TTL_MS=30000
UPLOAD_PUBLIC_BASE_URL=
REDIS_URL=
UPLOAD_STORAGE=local
S3_BUCKET=
S3_REGION=us-east-1
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_BASE_URL=
LOG_LEVEL=info
BACKUP_ENABLED=true
BACKUP_INTERVAL_MS=86400000
BACKUP_RETENTION_DAYS=14
BACKUP_DIR=./backups
BACKUP_INCLUDE_UPLOADS=false
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
AUTH_SECRET=change-this-secret
TOKEN_TTL_HOURS=12
SITE_URL=https://your-domain.com
PORT=8787
```

`AUTH_SECRET` and `ADMIN_PASSWORD` must be changed from defaults.

## Database and uploads

- PostgreSQL is required. The server auto-creates the `posts` table and indexes on startup.
- Uploaded files: `uploads/`

`uploads/` is ignored in git.

Local setup example:

```sql
CREATE DATABASE antara;
```

## API endpoints

### Health

```http
GET /api/health
```

### List posts

```http
GET /api/posts?page=1&limit=12&category=blog&search=mission
```

Query params:

- `page` (>= 1)
- `limit` (1-100)
- `category` (optional)
- `search` (optional)
- `includeDrafts=true` (optional, requires admin Bearer token)
- `status=published|draft` (optional, draft requires admin Bearer token)

Response includes:

- `items`: post summaries
- `pagination`: `{ page, limit, totalItems, totalPages, hasPrevPage, hasNextPage }`

### Get one post

```http
GET /api/posts/:slug
```

Returns only published posts for public access.

### Admin login

```http
POST /api/auth/login
Content-Type: application/json
```

Alias:

```http
POST /api/login
```

Body:

```json
{
  "username": "admin",
  "password": "your-password"
}
```

Response returns `token` (Bearer), `expiresAt`, and user details.

### Create post (supports file upload)

```http
POST /api/posts
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Form fields:

- `title` (required)
- `slug` (optional)
- `excerpt` (optional)
- `content` (optional)
- `category` (optional, default `blog`)
- `publishedAt` (optional ISO date)
- `seoTitle` (optional)
- `seoDescription` (optional)
- `coverImage` (optional URL)
- `isPublished` (`true`/`false`, optional)
- `status` (`published`/`draft`, optional)
- `attachment` (optional file)

Slug behavior:

- If `slug` is provided and already exists, API returns `409`.
- If `slug` is omitted, one is generated from the title with uniqueness suffixing when needed.

Validation notes:

- `publishedAt` must be a valid ISO date/time when provided.
- slug must use lowercase letters, numbers, and hyphens only.

### Update post

```http
PUT /api/posts/:slug
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Supports the same fields as create; also supports:

- `removeAttachment=true` to clear an existing attachment

### Delete post

```http
DELETE /api/posts/:slug
Authorization: Bearer <token>
```

### Trigger backup (admin)

```http
POST /api/admin/backups/run
Authorization: Bearer <token>
```

Upload guardrails:

- Max file size: `5MB` (configurable via `UPLOAD_MAX_MB`)
- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `application/pdf`
- Uploaded images are optimized on ingest and get an auto-generated thumbnail.
- Uploads are stored under `/uploads/yyyy/mm/` with randomized filenames.
- If `UPLOAD_STORAGE=s3`, uploads are stored in S3/R2-compatible object storage.
- `UPLOAD_PUBLIC_BASE_URL` can force returned asset URLs to your CDN base.

## Quick upload example (PowerShell)

```powershell
$login = Invoke-WebRequest -Uri "http://localhost:8787/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"change-me"}' `
  -UseBasicParsing

$token = (ConvertFrom-Json $login.Content).token

curl.exe -X POST "http://localhost:8787/api/posts" `
  -H "Authorization: Bearer $token" `
  -F "title=My first mission log" `
  -F "excerpt=Short summary here" `
  -F "content=Longer content here" `
  -F "category=blog" `
  -F "attachment=@C:\path\to\file.pdf"
```

## SEO notes

- `index.html` includes baseline title/description/Open Graph tags.
- The frontend updates page title and OG/description tags on page changes.
- Individual post routes (`/posts/:slug`) render dynamic canonical/OG/article metadata from the CMS record.
- `robots.txt` is available at `/robots.txt`.
- Dynamic sitemap is available at `/sitemap.xml` and includes published post URLs.
- RSS feed is available at `/rss.xml`.

## Admin dashboard

- Frontend route: `/admin`
- Features: login, create post, edit post, delete post, publish/draft toggle, upload attachment
- Auth token is stored in localStorage (`antara-admin-token`) for this prototype

## Security layers

- `helmet` for baseline security headers
- CORS allowlist (`CORS_ORIGINS`)
- API rate limiting (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`)
- global API error responses for validation, upload, and conflict failures
- HTML sanitization for post content before storage

## Performance layers

- In-memory API response cache for post list/detail, sitemap, and RSS (`CACHE_TTL_MS`)
- Optional Redis cache integration (`REDIS_URL`)
- Cache invalidation on post create/update/delete
- Structured JSON logging via pino (`LOG_LEVEL`)

## Backup and storage

- Scheduled backups are enabled by default (`BACKUP_ENABLED=true`)
- Backup cadence is configurable (`BACKUP_INTERVAL_MS`)
- Retention is configurable (`BACKUP_RETENTION_DAYS`)
- Backups can be triggered manually from `/admin` or `/api/admin/backups/run`
- Local upload snapshots can be included when `BACKUP_INCLUDE_UPLOADS=true`

### Shared-link previews

Production Express responses include Open Graph and Twitter card metadata before
React runs. Set `SITE_URL` to the public HTTPS origin so canonical and image URLs
use the correct domain. Published `/posts/:slug` links use the post's SEO fields
and cover image; other pages and posts without a usable cover use
`public/social-preview.png`. Draft or missing posts return 404 without exposing
post metadata. Page titles and descriptions live in `shared/page-meta.json`.

Regenerate the branded 1200 × 630 card with
`node scripts/create-social-preview.mjs`. Verify the routes with
`node --test tests/social-preview.test.js tests/media-routes.test.js`.
Deploy the rebuilt frontend together with `server/` and `shared/`; static-only
hosting does not run the Express metadata handler. Social platforms may retain
previously cached previews until the link is fetched again.

### Albums and protected admin workflows

Create an album using **New album** in `/admin`. Save the draft, then upload
multiple JPEG/PNG/WebP photos or MP4/WebM videos. Uploads are sequential and show
per-file progress and failures. Add captions and image descriptions, reorder the
files, and save captions/order separately. **Use as cover** selects a photo
thumbnail; save the album details to apply it. Publish only when ready.
Existing `gallery` posts remain albums, including their original image attachment.

The public `/api/albums?page=1` endpoint returns paginated metadata, media counts,
and cover thumbnails. `/api/albums/:slug` returns the media list only when an
album is opened. The viewer mounts one full asset at a time; videos use native
controls and `preload="none"`. Uploads use the existing local/S3 storage system.
Drafts hide album metadata from public endpoints; uploaded files, like existing
post attachments, remain accessible to anyone who already knows their URL.

Admin improvements include draft defaults, category/status/search filters,
pagination, local-time date editing, existing-attachment removal, explicit
publish/delete confirmations, and controls disabled during mutations. Publication
dates label posts; they do not schedule future publication.
Text drafts are retained in this browser tab's session storage with an explicit
restore action. Unsaved text and media captions survive session expiry/relogin.
Files cannot be restored after a page reload and must be selected again.

Post updates require `expectedVersion` from the latest post response; deletes
require that version in `If-Match`. Stale changes return 409 and preserve newer
server data. Album caption/order updates use `expectedRevision`; single-media
deletes use the album revision in `If-Match`. Reload after conflicts, preserving
any text you want to reapply first. Existing attachments are deleted only after
a successful database update.

Deployment: rebuild and deploy frontend and backend together. Startup adds the
`version` and `gallery_revision` columns to `posts` and creates `gallery_media`
with a cascading foreign key. Backups now include `gallery-media.json` alongside
`posts.json`; restore album records before their media rows. Local upload copies
still depend on `BACKUP_INCLUDE_UPLOADS`; S3 media need storage-level backups.

- `GALLERY_VIDEO_MAX_MB`: per-video limit, defaults to 100 MB. Configure the
  reverse proxy upload limit and request timeout accordingly.
- `UPLOAD_MAX_MB`: photo/attachment limit, defaults to 5 MB.
- `UPLOAD_DIR`: optional local upload root (defaults to `uploads/`).

Run the full database-backed regression suite against a **dedicated test
PostgreSQL instance** with a user that can create databases:

```bash
TEST_DATABASE_URL=postgresql://user@localhost:5432/postgres node --test tests/admin-gallery.test.js tests/social-preview.test.js tests/media-routes.test.js
```

The suite creates and removes its own temporary database and upload/backup
folders, and starts a test API on port 18879. Without `TEST_DATABASE_URL`, the
admin/gallery database suite is skipped.
