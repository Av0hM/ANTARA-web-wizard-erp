import compression from "compression";
import express from "express";
import helmet from "helmet";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import { Pool } from "pg";
import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createClient as createRedisClient } from "redis";
import pino from "pino";
import pinoHttp from "pino-http";
import sanitizeHtml from "sanitize-html";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const uploadsDir = path.join(rootDir, "uploads");
const distDir = path.join(rootDir, "dist");
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "change-this-secret";
console.log("ADMIN_USERNAME:", ADMIN_USERNAME);
console.log("ADMIN_PASSWORD:", ADMIN_PASSWORD);
const TOKEN_TTL_HOURS = Number(process.env.TOKEN_TTL_HOURS ?? 12);
const TOKEN_TTL_MS = Number.isFinite(TOKEN_TTL_HOURS)
  ? TOKEN_TTL_HOURS * 60 * 60 * 1000
  : 12 * 60 * 60 * 1000;
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const PGSSL = String(process.env.PGSSL ?? "false") === "true";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 100);
const UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? 5);
const UPLOAD_MAX_BYTES =
  (Number.isFinite(UPLOAD_MAX_MB) ? Math.max(1, UPLOAD_MAX_MB) : 5) *
  1024 *
  1024;
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS ?? 30_000);
const RAW_UPLOAD_PUBLIC_BASE_URL =
  process.env.UPLOAD_PUBLIC_BASE_URL ?? process.env.CDN_BASE_URL ?? "";
const REDIS_URL = process.env.REDIS_URL ?? "";
const UPLOAD_STORAGE = String(process.env.UPLOAD_STORAGE ?? "local")
  .trim()
  .toLowerCase();
const S3_BUCKET = process.env.S3_BUCKET ?? "";
const S3_REGION = process.env.S3_REGION ?? "us-east-1";
const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "";
const S3_FORCE_PATH_STYLE =
  String(process.env.S3_FORCE_PATH_STYLE ?? "false") === "true";
const S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL ?? "";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(rootDir, "backups");
const BACKUP_ENABLED = String(process.env.BACKUP_ENABLED ?? "true") !== "false";
const BACKUP_INTERVAL_MS = Number(process.env.BACKUP_INTERVAL_MS ?? 86_400_000);
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? 14);
const BACKUP_INCLUDE_UPLOADS =
  String(process.env.BACKUP_INCLUDE_UPLOADS ?? "false") === "true";

if (!DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Set DATABASE_URL to your PostgreSQL connection string.",
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: PGSSL ? { rejectUnauthorized: false } : undefined,
});

const logger = pino({
  level: LOG_LEVEL,
  base: undefined,
});

const redisClient = REDIS_URL
  ? createRedisClient({
      url: REDIS_URL,
    })
  : null;
let redisReady = false;

const s3Enabled = UPLOAD_STORAGE === "s3";
const s3Client = s3Enabled
  ? new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: S3_FORCE_PATH_STYLE,
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    })
  : null;

const initDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT DEFAULT '',
      content TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'blog',
      cover_image TEXT DEFAULT '',
      attachment_path TEXT DEFAULT '',
      attachment_thumb_path TEXT DEFAULT '',
      attachment_mime TEXT DEFAULT '',
      published_at TIMESTAMPTZ NOT NULL,
      seo_title TEXT DEFAULT '',
      seo_description TEXT DEFAULT '',
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
    CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(is_published, published_at DESC);
  `);
  await pool.query(`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS attachment_thumb_path TEXT DEFAULT '';
  `);

  const seedCountResult = await pool.query(
    "SELECT COUNT(*)::int AS total FROM posts",
  );
  const seedCount = Number(seedCountResult.rows[0]?.total ?? 0);

  if (seedCount > 0) {
    return;
  }

  const now = new Date().toISOString();
  await pool.query(
    `
      INSERT INTO posts
        (slug, title, excerpt, content, category, cover_image, attachment_path, attachment_thumb_path, attachment_mime, published_at, seo_title, seo_description, is_published, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, '', '', '', '', $6, '', '', TRUE, $7, $8),
        ($9, $10, $11, $12, $13, '', '', '', '', $14, '', '', TRUE, $15, $16)
    `,
    [
      "antara-mission-log-kickoff",
      "Antara Mission Log: Kickoff",
      "Initial milestones, subsystem ownership, and first design threads for the Antara mission.",
      "This is a seeded post from the CMS database. Replace it later with your uploaded content.",
      "blog",
      now,
      now,
      now,
      "newsletter-april-2026",
      "Newsletter: April 2026",
      "Mission direction, team updates, and upcoming technical reviews.",
      "This is a seeded newsletter entry. Replace it with your monthly issue content.",
      "newsletter",
      now,
      now,
      now,
    ],
  );
};

const normalizeOrigin = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\/+$/, "");
const UPLOAD_PUBLIC_BASE_URL = normalizeOrigin(RAW_UPLOAD_PUBLIC_BASE_URL);
const configuredOrigins = String(process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const defaultOrigins = [
  normalizeOrigin(process.env.SITE_URL ?? ""),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);
const allowedOrigins = new Set(
  configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins,
);

const requestBuckets = new Map();
const queryCache = new Map();
const nowMs = () => Date.now();
const apiRateLimit = (req, res, next) => {
  const ip = String(
    req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown",
  )
    .split(",")[0]
    .trim();
  const key = ip || "unknown";
  const current = requestBuckets.get(key);
  const now = nowMs();

  if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(key, { count: 1, windowStart: now });
    next();
    return;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    res
      .status(429)
      .json({ error: "Too many requests. Please try again shortly." });
    return;
  }

  current.count += 1;
  requestBuckets.set(key, current);
  next();
};

setInterval(
  () => {
    const now = nowMs();
    for (const [key, value] of requestBuckets.entries()) {
      if (now - value.windowStart >= RATE_LIMIT_WINDOW_MS * 2) {
        requestBuckets.delete(key);
      }
    }
  },
  Math.max(RATE_LIMIT_WINDOW_MS, 30_000),
).unref?.();

const getCached = async (key) => {
  const entry = queryCache.get(key);
  if (!entry) {
    if (redisReady && redisClient) {
      try {
        const redisValue = await redisClient.get(key);
        if (!redisValue) {
          return null;
        }
        const parsed = JSON.parse(redisValue);
        queryCache.set(key, {
          value: parsed,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return parsed;
      } catch (error) {
        logger.warn({ err: error }, "Failed reading from Redis cache.");
      }
    }
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    queryCache.delete(key);
    return null;
  }
  return entry.value;
};

const setCached = async (key, value, ttl = CACHE_TTL_MS) => {
  queryCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(ttl, 1000),
  });
  if (redisReady && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), {
        PX: Math.max(ttl, 1000),
      });
    } catch (error) {
      logger.warn({ err: error }, "Failed writing to Redis cache.");
    }
  }
};

const clearCmsCache = async () => {
  queryCache.clear();
  if (redisReady && redisClient) {
    try {
      const keys = await redisClient.keys("api-*");
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      const metaKeys = await redisClient.keys("*.xml");
      if (metaKeys.length > 0) {
        await redisClient.del(metaKeys);
      }
    } catch (error) {
      logger.warn({ err: error }, "Failed clearing Redis cache.");
    }
  }
};

const sanitizeText = (value, max = 4000) =>
  String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
const sanitizeContent = (value, max = 200_000) =>
  sanitizeHtml(String(value ?? "").replace(/\u0000/g, ""), {
    allowedTags: [
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "code",
      "pre",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "a",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
  })
    .trim()
    .slice(0, max);

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = String(value).trim().toLowerCase();
  if (parsed === "true" || parsed === "1" || parsed === "yes") {
    return true;
  }
  if (parsed === "false" || parsed === "0" || parsed === "no") {
    return false;
  }
  return fallback;
};

const parsePublishedFlag = (body, fallback) => {
  const status = String(body.status ?? "")
    .trim()
    .toLowerCase();
  if (status === "published") {
    return true;
  }
  if (status === "draft") {
    return false;
  }
  return parseBoolean(body.isPublished, fallback);
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isValidSlug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const slugExists = async (slug, ignoreId = null) => {
  if (ignoreId) {
    const result = await pool.query(
      "SELECT 1 FROM posts WHERE slug = $1 AND id <> $2 LIMIT 1",
      [slug, ignoreId],
    );
    return result.rowCount > 0;
  }
  const result = await pool.query(
    "SELECT 1 FROM posts WHERE slug = $1 LIMIT 1",
    [slug],
  );
  return result.rowCount > 0;
};

const uniqueSlug = async (raw) => {
  const base = slugify(raw) || `post-${Date.now()}`;
  let current = base;
  let index = 1;
  while (await slugExists(current)) {
    current = `${base}-${index}`;
    index += 1;
  }
  return current;
};

const normalizeIsoDate = (value, fallback = new Date()) => {
  if (!value) {
    return fallback.toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
};

const hashValue = (value) => crypto.createHash("sha256").update(value).digest();

const safeEqual = (first, second) => {
  const firstHash = hashValue(first);
  const secondHash = hashValue(second);
  return crypto.timingSafeEqual(firstHash, secondHash);
};

const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
};

const verifyToken = (token) => {
  const [body, signature] = String(token ?? "").split(".");
  if (!body || !signature) {
    return null;
  }
  const expectedSignature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(body)
    .digest("base64url");
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || Date.now() > Number(payload.exp)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const getBearerToken = (req) => {
  const auth = String(req.headers.authorization ?? "");
  if (!auth.startsWith("Bearer ")) {
    return "";
  }
  return auth.slice(7).trim();
};

const isAdminPayload = (payload) =>
  Boolean(
    payload && payload.role === "admin" && payload.username === ADMIN_USERNAME,
  );

const requireAdmin = (req, res, next) => {
  const payload = verifyToken(getBearerToken(req));
  if (!isAdminPayload(payload)) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  req.admin = { username: payload.username };
  next();
};

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toAttachmentPath = (filePath) => {
  const relative = path
    .relative(uploadsDir, filePath)
    .split(path.sep)
    .join("/");
  return relative ? `/uploads/${relative}` : "";
};

const toPublicAssetUrl = (assetPath) => {
  const clean = sanitizeText(assetPath, 2000);
  if (!clean) {
    return "";
  }
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }
  if (clean.startsWith("s3://")) {
    const withoutScheme = clean.replace(/^s3:\/\//, "");
    const firstSlash = withoutScheme.indexOf("/");
    if (firstSlash === -1) {
      return clean;
    }
    const bucket = withoutScheme.slice(0, firstSlash);
    const key = withoutScheme.slice(firstSlash + 1);
    if (UPLOAD_PUBLIC_BASE_URL) {
      return `${UPLOAD_PUBLIC_BASE_URL}/${key}`.replace(/([^:]\/)\/+/g, "$1");
    }
    const base = normalizeOrigin(
      S3_PUBLIC_BASE_URL ||
        (S3_ENDPOINT
          ? `${S3_ENDPOINT}/${bucket}`
          : `https://${bucket}.s3.${S3_REGION}.amazonaws.com`),
    );
    return `${base}/${key}`.replace(/([^:]\/)\/+/g, "$1");
  }
  if (!clean.startsWith("/uploads/")) {
    return clean;
  }
  if (!UPLOAD_PUBLIC_BASE_URL) {
    return clean;
  }
  return `${UPLOAD_PUBLIC_BASE_URL}${clean}`;
};

const toStoredAssetRef = (localPublicPath) => {
  if (!localPublicPath) {
    return "";
  }
  if (!s3Enabled) {
    return localPublicPath;
  }
  const clean = localPublicPath.replace(/^\/+/, "");
  return `s3://${S3_BUCKET}/${clean.replace(/^uploads\//, "")}`;
};

const getS3ObjectKey = (assetRef) => {
  const clean = sanitizeText(assetRef, 2000);
  if (!clean.startsWith("s3://")) {
    return "";
  }
  const withoutScheme = clean.replace(/^s3:\/\//, "");
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash === -1) {
    return "";
  }
  return withoutScheme.slice(firstSlash + 1);
};

const toLocalAbsoluteFromPublicPath = (publicPath) => {
  if (!publicPath || !publicPath.startsWith("/uploads/")) {
    return "";
  }
  const relative = publicPath.replace(/^\/uploads\//, "");
  const absolute = path.resolve(uploadsDir, relative);
  const uploadsRoot = path.resolve(uploadsDir);
  if (!absolute.startsWith(uploadsRoot)) {
    return "";
  }
  return absolute;
};

const deleteLocalFile = (absolutePath) => {
  if (!absolutePath) {
    return;
  }
  try {
    fs.unlinkSync(absolutePath);
  } catch {
    // Ignore file deletion issues.
  }
};

const uploadLocalFileToS3 = async (localPath, mimeType, targetRef) => {
  if (!s3Enabled || !s3Client || !S3_BUCKET || !targetRef) {
    return;
  }
  const key = getS3ObjectKey(targetRef);
  if (!key) {
    return;
  }
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: mimeType || "application/octet-stream",
    }),
  );
};

const deleteS3ObjectByRef = async (assetRef) => {
  if (!s3Enabled || !s3Client || !S3_BUCKET) {
    return;
  }
  const key = getS3ObjectKey(assetRef);
  if (!key) {
    return;
  }
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      }),
    );
  } catch (error) {
    logger.warn({ err: error, key }, "Failed deleting S3 object.");
  }
};

const deleteAssetRef = async (assetRef) => {
  const clean = sanitizeText(assetRef, 2000);
  if (!clean) {
    return;
  }
  if (clean.startsWith("s3://")) {
    await deleteS3ObjectByRef(clean);
    return;
  }
  if (clean.startsWith("/uploads/")) {
    deleteLocalFile(toLocalAbsoluteFromPublicPath(clean));
  }
};

const maybeCopyLocalToS3 = async (localPublicPath, mimeType) => {
  if (!s3Enabled) {
    return localPublicPath;
  }
  const absolute = toLocalAbsoluteFromPublicPath(localPublicPath);
  if (!absolute) {
    return localPublicPath;
  }
  const targetRef = toStoredAssetRef(localPublicPath);
  await uploadLocalFileToS3(absolute, mimeType, targetRef);
  deleteLocalFile(absolute);
  return targetRef;
};

const decoratePostRow = (row) => ({
  ...row,
  attachmentPath: toPublicAssetUrl(row.attachmentPath),
  attachmentThumbnailPath: toPublicAssetUrl(row.attachmentThumbnailPath),
});

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const withSafeTempFile = (absolutePath) => {
  const parsed = path.parse(absolutePath);
  return path.join(parsed.dir, `${parsed.name}.tmp${parsed.ext}`);
};

const convertImageIfNeeded = async (filePath, mimeType) => {
  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    return;
  }
  const tempPath = withSafeTempFile(filePath);
  const pipeline = sharp(filePath)
    .rotate()
    .resize({ width: 1920, withoutEnlargement: true });
  if (mimeType === "image/jpeg") {
    await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(tempPath);
  } else if (mimeType === "image/png") {
    await pipeline
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(tempPath);
  } else {
    await pipeline.webp({ quality: 82 }).toFile(tempPath);
  }
  fs.renameSync(tempPath, filePath);
};

const generateThumbnail = async (filePath, mimeType) => {
  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    return "";
  }
  const parsed = path.parse(filePath);
  const thumbAbsolute = path.join(parsed.dir, `${parsed.name}-thumb.webp`);
  await sharp(filePath)
    .rotate()
    .resize({
      width: 640,
      height: 640,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 76 })
    .toFile(thumbAbsolute);
  return toAttachmentPath(thumbAbsolute);
};

const processAttachmentUpload = async (file) => {
  if (!file) {
    return {
      attachmentPath: "",
      attachmentMime: "",
      attachmentThumbnailPath: "",
    };
  }
  const localPath = toAttachmentPath(file.path);
  let thumbnailLocalPath = "";
  try {
    await convertImageIfNeeded(file.path, file.mimetype);
    thumbnailLocalPath = await generateThumbnail(file.path, file.mimetype);
  } catch (error) {
    logger.warn(
      { err: error },
      "Attachment optimization failed; using original asset.",
    );
  }

  const storedMain = await maybeCopyLocalToS3(localPath, file.mimetype);
  let storedThumb = thumbnailLocalPath;
  if (thumbnailLocalPath) {
    storedThumb = await maybeCopyLocalToS3(thumbnailLocalPath, "image/webp");
  }

  return {
    attachmentPath: storedMain,
    attachmentMime: file.mimetype,
    attachmentThumbnailPath: storedThumb,
  };
};

const safeDeleteAttachment = async (assetRef) => {
  await deleteAssetRef(assetRef);
};

fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(path.join(rootDir, "public")));
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  }),
);

// app.use((req, res, next) => {
//   const origin = normalizeOrigin(req.headers.origin ?? "");
//   const allowAll = allowedOrigins.has("*");
//   const isAllowed = !origin || allowAll || allowedOrigins.has(origin);

//   if (origin && isAllowed) {
//     res.setHeader("Access-Control-Allow-Origin", origin);
//     res.setHeader("Vary", "Origin");
//     res.setHeader(
//       "Access-Control-Allow-Headers",
//       "Content-Type, Authorization",
//     );
//     res.setHeader(
//       "Access-Control-Allow-Methods",
//       "GET,POST,PUT,DELETE,OPTIONS",
//     );
//     res.setHeader("Access-Control-Allow-Credentials", "true");
//   }

//   if (req.method === "OPTIONS") {
//     if (!isAllowed) {
//       res.status(403).json({ error: "Origin not allowed." });
//       return;
//     }
//     res.status(204).end();
//     return;
//   }

//   if (origin && !isAllowed) {
//     res.status(403).json({ error: "Origin not allowed." });
//     return;
//   }
//   next();
// });
app.use((req, res, next) => {
  // ✅ IMPORTANT: allow frontend static files
  if (
    req.path.startsWith("/assets") ||
    req.path.startsWith("/uploads") ||
    req.path === "/" ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".png") ||
    req.path.endsWith(".jpg") ||
    req.path.endsWith(".webp") ||
    req.path.endsWith(".svg")
  ) {
    return next();
  }

  const origin = normalizeOrigin(req.headers.origin ?? "");
  const allowAll = allowedOrigins.has("*");
  const isAllowed = !origin || allowAll || allowedOrigins.has(origin);

  if (origin && isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    if (!isAllowed) {
      return res.status(403).json({ error: "Origin not allowed." });
    }
    return res.status(204).end();
  }

  if (origin && !isAllowed) {
    return res.status(403).json({ error: "Origin not allowed." });
  }

  next();
});

app.use("/api", apiRateLimit);

const storage = multer.diskStorage({
  destination: (_, __, callback) => {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const destinationDir = path.join(uploadsDir, year, month);
    fs.mkdirSync(destinationDir, { recursive: true });
    callback(null, destinationDir);
  },
  filename: (_, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const suffix = crypto.randomBytes(8).toString("hex");
    callback(null, `${Date.now()}-${suffix}${ext}`);
  },
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const upload = multer({
  storage,
  limits: {
    fileSize: UPLOAD_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("File type not allowed.");
      error.code = "UPLOAD_FILE_TYPE_NOT_ALLOWED";
      callback(error, false);
      return;
    }
    callback(null, true);
  },
});

const loginHandler = (req, res) => {
  const username = sanitizeText(req.body.username, 120);
  const password = String(req.body.password ?? "");
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }
  const valid =
    safeEqual(username, ADMIN_USERNAME) && safeEqual(password, ADMIN_PASSWORD);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = signToken({
    username,
    role: "admin",
    exp: expiresAt,
  });
  res.json({
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    user: { username, role: "admin" },
  });
};

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "antara-api" });
});

app.post("/api/auth/login", loginHandler);
app.post("/api/login", loginHandler);

app.get(
  "/api/posts",
  asyncRoute(async (req, res) => {
    const limitRaw = Number(req.query.limit ?? 12);
    const pageRaw = Number(req.query.page ?? 1);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 100)
      : 12;
    const page = Number.isFinite(pageRaw)
      ? Math.max(Math.floor(pageRaw), 1)
      : 1;
    const category = sanitizeText(req.query.category, 120);
    const search = sanitizeText(req.query.search, 220);
    const statusFilter = sanitizeText(req.query.status, 20).toLowerCase();
    const includeDraftsRequested =
      String(req.query.includeDrafts ?? "false") === "true";
    const adminPayload = verifyToken(getBearerToken(req));
    const adminView = isAdminPayload(adminPayload);
    const includeDrafts =
      includeDraftsRequested && isAdminPayload(adminPayload);

    if (includeDraftsRequested && !includeDrafts) {
      res.status(401).json({ error: "Unauthorized to include drafts." });
      return;
    }

    if (statusFilter === "draft" && !includeDrafts) {
      res.status(401).json({ error: "Unauthorized to request draft posts." });
      return;
    }

    const cacheKey = `api-posts:${req.originalUrl}:admin=${adminView ? "1" : "0"}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const clauses = [];
    const values = [];

    if (!includeDrafts) {
      clauses.push("is_published = TRUE");
    }
    if (category) {
      values.push(category);
      clauses.push(`category = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      clauses.push(
        `(title ILIKE $${values.length} OR excerpt ILIKE $${values.length} OR content ILIKE $${values.length})`,
      );
    }
    if (statusFilter === "published") {
      clauses.push("is_published = TRUE");
    }
    if (statusFilter === "draft") {
      clauses.push("is_published = FALSE");
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM posts ${where}`,
      values,
    );
    const totalItems = Number(countResult.rows[0]?.total ?? 0);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
    const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const offset = (currentPage - 1) * limit;

    const listValues = [...values, limit, offset];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const rowsResult = await pool.query(
      `
      SELECT
        id::int AS id,
        slug,
        title,
        excerpt,
        category,
        cover_image AS "coverImage",
        attachment_path AS "attachmentPath",
        attachment_thumb_path AS "attachmentThumbnailPath",
        published_at AS "publishedAt",
        seo_title AS "seoTitle",
        seo_description AS "seoDescription",
        is_published AS "isPublished"
      FROM posts
      ${where}
      ORDER BY published_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
      listValues,
    );

    const items = rowsResult.rows.map((row) => {
      const mapped = decoratePostRow(row);
      return {
        ...mapped,
        status: mapped.isPublished ? "published" : "draft",
      };
    });

    const payload = {
      items,
      pagination: {
        page: currentPage,
        limit,
        totalItems,
        totalPages,
        hasPrevPage: currentPage > 1,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
      },
    };
    await setCached(cacheKey, payload);
    res.json(payload);
  }),
);

app.get(
  "/api/posts/:slug",
  asyncRoute(async (req, res) => {
    const slug = sanitizeText(req.params.slug, 160).toLowerCase();
    const includeDraftRequested =
      String(req.query.includeDraft ?? "false") === "true";
    const adminPayload = verifyToken(getBearerToken(req));
    const includeDraft = includeDraftRequested && isAdminPayload(adminPayload);

    if (includeDraftRequested && !includeDraft) {
      res.status(401).json({ error: "Unauthorized to include draft post." });
      return;
    }

    const cacheKey = `api-post:${slug}:draft=${includeDraft ? "1" : "0"}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const where = includeDraft
      ? "slug = $1"
      : "slug = $1 AND is_published = TRUE";
    const row = await pool.query(
      `
      SELECT
        id::int AS id,
        slug,
        title,
        excerpt,
        content,
        category,
        cover_image AS "coverImage",
        attachment_path AS "attachmentPath",
        attachment_thumb_path AS "attachmentThumbnailPath",
        attachment_mime AS "attachmentMime",
        published_at AS "publishedAt",
        seo_title AS "seoTitle",
        seo_description AS "seoDescription",
        updated_at AS "updatedAt",
        is_published AS "isPublished"
      FROM posts
      WHERE ${where}
      LIMIT 1
    `,
      [slug],
    );

    if (row.rowCount === 0) {
      res.status(404).json({ error: "Post not found." });
      return;
    }

    const item = decoratePostRow(row.rows[0]);
    const payload = {
      item: {
        ...item,
        status: item.isPublished ? "published" : "draft",
      },
    };
    await setCached(cacheKey, payload);
    res.json(payload);
  }),
);

app.post(
  "/api/posts",
  requireAdmin,
  upload.single("attachment"),
  asyncRoute(async (req, res) => {
    const title = sanitizeText(req.body.title, 280);
    const excerpt = sanitizeText(req.body.excerpt, 2000);
    const content = sanitizeContent(req.body.content, 200_000);
    const category = sanitizeText(req.body.category, 80) || "blog";
    const seoTitle = sanitizeText(req.body.seoTitle, 280);
    const seoDescription = sanitizeText(req.body.seoDescription, 320);
    const coverImage = sanitizeText(req.body.coverImage, 1200);
    const isPublished = parsePublishedFlag(req.body, true);
    const publishedAtRaw = sanitizeText(req.body.publishedAt, 80);

    if (!title) {
      res.status(400).json({ error: "Title is required." });
      return;
    }

    const publishedAt = normalizeIsoDate(publishedAtRaw, new Date());
    if (!publishedAt) {
      res
        .status(400)
        .json({ error: "publishedAt must be a valid ISO date/time." });
      return;
    }

    const requestedSlugRaw = sanitizeText(req.body.slug, 160).toLowerCase();
    if (requestedSlugRaw && !isValidSlug(requestedSlugRaw)) {
      res.status(400).json({
        error: "Slug must be lowercase letters, numbers, and hyphens only.",
      });
      return;
    }

    const slug = requestedSlugRaw || (await uniqueSlug(title));
    if (requestedSlugRaw && (await slugExists(slug))) {
      res
        .status(409)
        .json({ error: "Slug already exists. Choose a different slug." });
      return;
    }

    const now = new Date().toISOString();
    const { attachmentPath, attachmentMime, attachmentThumbnailPath } =
      await processAttachmentUpload(req.file);

    await pool.query(
      `
      INSERT INTO posts
        (slug, title, excerpt, content, category, cover_image, attachment_path, attachment_thumb_path, attachment_mime, published_at, seo_title, seo_description, is_published, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11, $12, $13, $14::timestamptz, $15::timestamptz)
    `,
      [
        slug,
        title,
        excerpt,
        content,
        category,
        coverImage,
        attachmentPath,
        attachmentThumbnailPath,
        attachmentMime,
        publishedAt,
        seoTitle,
        seoDescription,
        isPublished,
        now,
        now,
      ],
    );

    await clearCmsCache();
    res.status(201).json({ ok: true, slug });
  }),
);

app.put(
  "/api/posts/:slug",
  requireAdmin,
  upload.single("attachment"),
  asyncRoute(async (req, res) => {
    const targetSlug = sanitizeText(req.params.slug, 160).toLowerCase();
    const existingResult = await pool.query(
      `
      SELECT id, slug, title, excerpt, content, category, cover_image, attachment_path, attachment_thumb_path, attachment_mime, published_at, seo_title, seo_description, is_published
      FROM posts
      WHERE slug = $1
      LIMIT 1
    `,
      [targetSlug],
    );

    if (existingResult.rowCount === 0) {
      res.status(404).json({ error: "Post not found." });
      return;
    }

    const existing = existingResult.rows[0];
    const hasField = (name) =>
      Object.prototype.hasOwnProperty.call(req.body, name);

    const title = hasField("title")
      ? sanitizeText(req.body.title, 280)
      : existing.title;
    if (!title) {
      res.status(400).json({ error: "Title is required." });
      return;
    }

    const requestedSlugRaw = hasField("slug")
      ? sanitizeText(req.body.slug, 160).toLowerCase()
      : existing.slug;
    if (!requestedSlugRaw || !isValidSlug(requestedSlugRaw)) {
      res.status(400).json({
        error: "Slug must be lowercase letters, numbers, and hyphens only.",
      });
      return;
    }
    if (
      requestedSlugRaw !== existing.slug &&
      (await slugExists(requestedSlugRaw, existing.id))
    ) {
      res
        .status(409)
        .json({ error: "Slug already exists. Choose a different slug." });
      return;
    }

    const excerpt = hasField("excerpt")
      ? sanitizeText(req.body.excerpt, 2000)
      : existing.excerpt;
    const content = hasField("content")
      ? sanitizeContent(req.body.content, 200_000)
      : existing.content;
    const category = hasField("category")
      ? sanitizeText(req.body.category, 80) || "blog"
      : existing.category;
    const seoTitle = hasField("seoTitle")
      ? sanitizeText(req.body.seoTitle, 280)
      : existing.seo_title;
    const seoDescription = hasField("seoDescription")
      ? sanitizeText(req.body.seoDescription, 320)
      : existing.seo_description;
    const coverImage = hasField("coverImage")
      ? sanitizeText(req.body.coverImage, 1200)
      : existing.cover_image;

    const publishedAt = hasField("publishedAt")
      ? normalizeIsoDate(sanitizeText(req.body.publishedAt, 80))
      : new Date(existing.published_at).toISOString();
    if (!publishedAt) {
      res
        .status(400)
        .json({ error: "publishedAt must be a valid ISO date/time." });
      return;
    }

    const isPublished =
      hasField("status") || hasField("isPublished")
        ? parsePublishedFlag(req.body, Boolean(existing.is_published))
        : Boolean(existing.is_published);

    let attachmentPath = existing.attachment_path ?? "";
    let attachmentThumbnailPath = existing.attachment_thumb_path ?? "";
    let attachmentMime = existing.attachment_mime ?? "";
    const removeAttachment = parseBoolean(req.body.removeAttachment, false);

    if (req.file) {
      await safeDeleteAttachment(attachmentPath);
      await safeDeleteAttachment(attachmentThumbnailPath);
      const processed = await processAttachmentUpload(req.file);
      attachmentPath = processed.attachmentPath;
      attachmentThumbnailPath = processed.attachmentThumbnailPath;
      attachmentMime = processed.attachmentMime;
    } else if (removeAttachment) {
      await safeDeleteAttachment(attachmentPath);
      await safeDeleteAttachment(attachmentThumbnailPath);
      attachmentPath = "";
      attachmentThumbnailPath = "";
      attachmentMime = "";
    }

    const now = new Date().toISOString();
    await pool.query(
      `
      UPDATE posts
      SET
        slug = $1,
        title = $2,
        excerpt = $3,
        content = $4,
        category = $5,
        cover_image = $6,
        attachment_path = $7,
        attachment_thumb_path = $8,
        attachment_mime = $9,
        published_at = $10::timestamptz,
        seo_title = $11,
        seo_description = $12,
        is_published = $13,
        updated_at = $14::timestamptz
      WHERE id = $15
    `,
      [
        requestedSlugRaw,
        title,
        excerpt,
        content,
        category,
        coverImage,
        attachmentPath,
        attachmentThumbnailPath,
        attachmentMime,
        publishedAt,
        seoTitle,
        seoDescription,
        isPublished,
        now,
        existing.id,
      ],
    );

    await clearCmsCache();
    res.json({ ok: true, slug: requestedSlugRaw });
  }),
);

app.delete(
  "/api/posts/:slug",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const slug = sanitizeText(req.params.slug, 160).toLowerCase();
    const existingResult = await pool.query(
      "SELECT id, attachment_path, attachment_thumb_path FROM posts WHERE slug = $1 LIMIT 1",
      [slug],
    );
    if (existingResult.rowCount === 0) {
      res.status(404).json({ error: "Post not found." });
      return;
    }
    const existing = existingResult.rows[0];
    await pool.query("DELETE FROM posts WHERE id = $1", [existing.id]);
    await safeDeleteAttachment(existing.attachment_path ?? "");
    await safeDeleteAttachment(existing.attachment_thumb_path ?? "");
    await clearCmsCache();
    res.json({ ok: true, slug });
  }),
);

app.get(
  "/sitemap.xml",
  asyncRoute(async (_, res) => {
    const cacheKey = "sitemap.xml";
    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("Content-Type", "application/xml");
      res.send(cached);
      return;
    }

    const base = normalizeOrigin(
      process.env.SITE_URL ?? "https://antara.bits-goa.example",
    );
    const staticPaths = [
      "/",
      "/partners",
      "/events",
      "/mini-projects",
      "/ground-station",
      "/payload-development",
      "/adcs",
      "/newsletter",
      "/admin",
    ];
    const postsResult = await pool.query(
      `
      SELECT slug, published_at AS "publishedAt", updated_at AS "updatedAt"
      FROM posts
      WHERE is_published = TRUE
      ORDER BY published_at DESC
    `,
    );

    const urls = [
      ...staticPaths.map((pathName) => ({
        loc: `${base}${pathName}`,
        lastmod: new Date().toISOString(),
      })),
      ...postsResult.rows.map((post) => ({
        loc: `${base}/posts/${post.slug}`,
        lastmod: post.updatedAt || post.publishedAt || new Date().toISOString(),
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${escapeXml(url.lastmod)}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    await setCached(cacheKey, xml);
    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  }),
);

app.get("/robots.txt", (_, res) => {
  const base = normalizeOrigin(
    process.env.SITE_URL ?? "https://antara.bits-goa.example",
  );
  res
    .type("text/plain")
    .send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
});

app.get(
  "/rss.xml",
  asyncRoute(async (_, res) => {
    const cacheKey = "rss.xml";
    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.send(cached);
      return;
    }

    const base = normalizeOrigin(
      process.env.SITE_URL ?? "https://antara.bits-goa.example",
    );
    const rows = await pool.query(
      `
      SELECT slug, title, excerpt, content, published_at AS "publishedAt", updated_at AS "updatedAt"
      FROM posts
      WHERE is_published = TRUE
      ORDER BY published_at DESC
      LIMIT 50
    `,
    );

    const items = rows.rows
      .map((post) => {
        const link = `${base}/posts/${post.slug}`;
        const description =
          post.excerpt || String(post.content ?? "").slice(0, 320);
        return `<item>
  <title>${escapeXml(post.title)}</title>
  <link>${escapeXml(link)}</link>
  <guid>${escapeXml(link)}</guid>
  <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
  <description>${escapeXml(description)}</description>
</item>`;
      })
      .join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Project Antara Mission Log</title>
  <link>${escapeXml(base)}</link>
  <description>Updates from Project Antara, the student-built CubeSat mission.</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;

    await setCached(cacheKey, rss);
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(rss);
  }),
);

const runBackup = async (reason = "manual") => {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, timestamp);
  fs.mkdirSync(backupPath, { recursive: true });

  const result = await pool.query(`
    SELECT
      id::int AS id,
      slug,
      title,
      excerpt,
      content,
      category,
      cover_image AS "coverImage",
      attachment_path AS "attachmentPath",
      attachment_thumb_path AS "attachmentThumbnailPath",
      attachment_mime AS "attachmentMime",
      published_at AS "publishedAt",
      seo_title AS "seoTitle",
      seo_description AS "seoDescription",
      is_published AS "isPublished",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM posts
    ORDER BY updated_at DESC
  `);

  fs.writeFileSync(
    path.join(backupPath, "posts.json"),
    JSON.stringify(result.rows, null, 2),
    "utf8",
  );

  if (BACKUP_INCLUDE_UPLOADS && !s3Enabled && fs.existsSync(uploadsDir)) {
    fs.cpSync(uploadsDir, path.join(backupPath, "uploads"), {
      recursive: true,
    });
  }

  const metadata = {
    generatedAt: new Date().toISOString(),
    reason,
    postCount: result.rows.length,
    storage: s3Enabled ? "s3" : "local",
  };
  fs.writeFileSync(
    path.join(backupPath, "metadata.json"),
    JSON.stringify(metadata, null, 2),
    "utf8",
  );

  const retentionMs = Math.max(1, BACKUP_RETENTION_DAYS) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const entry of fs.readdirSync(BACKUP_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const fullPath = path.join(BACKUP_DIR, entry.name);
    const stats = fs.statSync(fullPath);
    if (now - stats.mtimeMs > retentionMs) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }

  logger.info(
    { backupPath, reason, postCount: result.rows.length },
    "Backup completed.",
  );
  return { backupPath, postCount: result.rows.length };
};

app.post(
  "/api/admin/backups/run",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const backup = await runBackup("api-trigger");
    res.json({ ok: true, ...backup });
  }),
);
console.log("DIST DIR:", distDir);
console.log("EXISTS:", fs.existsSync(distDir));
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

const port = Number(process.env.PORT ?? 8787);
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: `Upload exceeds maximum allowed size (${UPLOAD_MAX_MB}MB).`,
      });
      return;
    }
    res.status(400).json({ error: error.message });
    return;
  }

  if (error?.code === "UPLOAD_FILE_TYPE_NOT_ALLOWED") {
    res.status(415).json({
      error: "Unsupported file type. Allowed: jpg, png, webp, pdf.",
    });
    return;
  }

  if (error?.code === "23505") {
    res
      .status(409)
      .json({ error: "Slug already exists. Choose a different slug." });
    return;
  }

  logger.error({ err: error }, "Unhandled server error.");
  res.status(500).json({ error: "Internal server error." });
});

const initRedis = async () => {
  if (!redisClient) {
    return;
  }
  redisClient.on("error", (error) => {
    logger.warn({ err: error }, "Redis client error.");
  });
  try {
    await redisClient.connect();
    redisReady = true;
    logger.info("Redis cache connected.");
  } catch (error) {
    redisReady = false;
    logger.warn(
      { err: error },
      "Redis unavailable; continuing with in-memory cache.",
    );
  }
};

let backupIntervalHandle = null;

const startServer = async () => {
  if (s3Enabled && !S3_BUCKET) {
    throw new Error("UPLOAD_STORAGE=s3 requires S3_BUCKET.");
  }
  await initRedis();
  await initDatabase();

  app.listen(port, () => {
    if (
      AUTH_SECRET === "change-this-secret" ||
      ADMIN_PASSWORD === "change-me"
    ) {
      logger.warn(
        "Security warning: set ADMIN_USERNAME, ADMIN_PASSWORD, and AUTH_SECRET before public deployment.",
      );
    }
    logger.info({ port }, "Antara server started.");
  });

  if (BACKUP_ENABLED) {
    backupIntervalHandle = setInterval(
      () => {
        runBackup("scheduled").catch((error) => {
          logger.error({ err: error }, "Scheduled backup failed.");
        });
      },
      Math.max(BACKUP_INTERVAL_MS, 60_000),
    );
    backupIntervalHandle.unref?.();
    logger.info(
      {
        backupIntervalMs: Math.max(BACKUP_INTERVAL_MS, 60_000),
        backupDir: BACKUP_DIR,
      },
      "Automatic backups enabled.",
    );
  }
};

startServer().catch((error) => {
  logger.fatal(
    { err: error },
    "Failed to initialize dependencies or database.",
  );
  process.exit(1);
});

const shutdown = async () => {
  if (backupIntervalHandle) {
    clearInterval(backupIntervalHandle);
    backupIntervalHandle = null;
  }
  if (redisClient && redisReady) {
    await redisClient.quit();
  }
  await pool.end();
};

process.on("SIGINT", () => {
  shutdown()
    .catch(() => {})
    .finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  shutdown()
    .catch(() => {})
    .finally(() => process.exit(0));
});
