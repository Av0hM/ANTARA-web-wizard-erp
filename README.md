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
