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
- `attachment` (optional file)

Slug behavior:

- If `slug` is provided and already exists, API returns `409`.
- If `slug` is omitted, one is generated from the title with uniqueness suffixing when needed.

Validation notes:

- `publishedAt` must be a valid ISO date/time when provided.

Upload guardrails:

- Max file size: `10MB`
- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`
  - `application/pdf`
  - `text/plain`
  - `text/markdown`

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
