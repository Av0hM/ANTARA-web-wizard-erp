# AGENTS.md — Project Antara Web Platform

## Project Overview
- **Stack**: React 19 + Vite frontend, Node.js (ESM) + Express backend, PostgreSQL (`pg`), file uploads, SEO (sitemap, RSS, robots.txt)
- **Architecture**: Single Express server (`server/index.js`, 1698 lines) serves API under `/api` and static frontend from `dist/` (production) or via Vite proxy (dev)
- **Ports**: Frontend dev `5173`, Backend API `8787`
- **Database**: Auto-creates `posts` table + indexes on startup; seeds 2 posts if empty

## Essential Commands
```bash
npm install          # install deps
npm run dev          # concurrent dev:server + dev:client (Vite proxy to :8787)
npm run build        # tsc -b && vite build (outputs to dist/)
npm run start        # production: node server/index.js (serves dist/)
npm run lint         # eslint . (flat config)
npm run preview      # vite preview (preview built dist)
```

## Environment Variables (required for prod)
Copy `.env.example` → `.env` and **change these from defaults**:
- `DATABASE_URL` — PostgreSQL connection string (required)
- `AUTH_SECRET` — JWT signing secret (must change)
- `ADMIN_PASSWORD` — admin login password (must change)
- `SITE_URL` — canonical domain for SEO/sitemap
- `CORS_ORIGINS` — comma-separated allowed origins

Optional: `REDIS_URL` (cache), `UPLOAD_STORAGE=s3` + S3 vars (`S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_BASE_URL`), `BACKUP_*` (scheduled backups), `UPLOAD_PUBLIC_BASE_URL` (CDN base), `LOG_LEVEL`, `TOKEN_TTL_HOURS`.

## Key Architecture Notes
- **Single server file**: `server/index.js` contains all routes, auth, uploads, caching, backups
- **Auth**: HMAC-SHA256 tokens (12h TTL), Bearer in `Authorization` header, admin-only routes use `requireAdmin` middleware
- **Uploads**: `multer` disk storage → `uploads/yyyy/mm/`; Sharp optimizes images, generates WebP thumbnails; S3 support via `UPLOAD_STORAGE=s3`
- **Caching**: In-memory Map + optional Redis (`REDIS_URL`); TTL `CACHE_TTL_MS` (default 30s); invalidated on post CRUD
- **Rate limiting**: Per-IP sliding window (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`)
- **CORS**: Dynamic allowlist from `CORS_ORIGINS` + `SITE_URL` + localhost defaults; static assets bypass CORS
- **Backups**: Scheduled (`BACKUP_INTERVAL_MS`), retention (`BACKUP_RETENTION_DAYS`), manual trigger via `/api/admin/backups/run`

## API Endpoints (admin routes require Bearer token)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/health` | — | health check |
| POST | `/api/auth/login` / `/api/login` | — | returns `{token, expiresAt, user}` |
| GET | `/api/posts` | — | paginated, filter by category/search/status; `includeDrafts` needs admin |
| GET | `/api/posts/:slug` | — | public=published only; `includeDraft` needs admin |
| POST | `/api/posts` | admin | multipart/form-data; fields: title, slug?, excerpt, content, category, coverImage, publishedAt, seoTitle, seoDescription, isPublished/status, attachment (file) |
| PUT | `/api/posts/:slug` | admin | same fields + `removeAttachment=true` |
| DELETE | `/api/posts/:slug` | admin | |
| POST | `/api/admin/backups/run` | admin | manual backup |
| GET | `/sitemap.xml` | — | dynamic, cached |
| GET | `/robots.txt` | — | static |
| GET | `/rss.xml` | — | dynamic, cached |

## Frontend Structure
- Entry: `src/main.tsx` → `src/App.tsx` (3623 lines, single-file app with all pages)
- 3D Scene: `src/Scene.tsx` (Three.js + React Three Fiber + Drei)
- Routing: Client-side hash/history via `App.tsx` state (`page`, `postSlug`)
- Animations: GSAP + ScrollTrigger + Lenis (smooth scroll) + animejs
- 3D: Three.js + React Three Fiber + Drei (`@react-three/*`)
- Styling: Tailwind CSS v4 (`@tailwindcss/vite`), custom `App.css`, `index.css`

## TypeScript & Linting
- `tsconfig.json` references `tsconfig.app.json` (src) and `tsconfig.node.json` (vite.config.ts)
- Strict mode: `strict: true`, `noUnusedLocals/Parameters: true`, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`
- `noEmit: true` (type-check only; Vite handles transpilation)
- ESLint flat config: `js.configs.recommended`, `tseslint.configs.recommended`, `react-hooks`, `react-refresh` (ignores `dist/`)

## Dev Proxy (vite.config.ts)
```ts
proxy: {
  "/api": "http://localhost:8787",
  "/uploads": "http://localhost:8787",
  "/robots.txt": "http://localhost:8787",
  "/sitemap.xml": "http://localhost:8787",
}
```

## Common Gotchas
- **DATABASE_URL must be set** or server throws on startup
- **Auth secret/password defaults are insecure** — server logs warning if unchanged
- **Uploads dir ignored by git** (`uploads/` in `.gitignore`); backups dir (`backups/`) also ignored
- **Production serves `dist/`** — run `npm run build` before `npm run start`
- **CORS debugging**: server logs allowed origins and incoming origin on login attempts
- **Slug uniqueness**: auto-generated from title with `-N` suffix; custom slug validated (`^[a-z0-9-]+$`)
- **HTML sanitization**: post content sanitized server-side (`sanitize-html` allowlist)
- **No test suite** — verify manually via `npm run dev` + API calls
- **Upload limits**: 5MB default (`UPLOAD_MAX_MB`); allowed MIME: JPEG, PNG, WebP, PDF
- **Token storage**: frontend stores admin token in `localStorage` (`antara-admin-token`)