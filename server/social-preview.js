import fs from 'node:fs';
import path from 'node:path';

const pages = JSON.parse(fs.readFileSync(new URL('../shared/page-meta.json', import.meta.url), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderSocialPreview(template, { origin, pathname, post }) {
  const page = pages[pathname.replace(/^\/|\/$/g, '')] || pages.home;
  const title = post ? post.seoTitle || post.title : page.title;
  const description = post ? post.seoDescription || post.excerpt || 'Mission post from Project Antara.' : page.description;
  const url = new URL(pathname, origin).href;
  let image = new URL('/social-preview.png', origin).href;
  try {
    const cover = new URL(post?.coverImage || image, origin);
    if (['https:', 'http:'].includes(cover.protocol)) image = cover.href;
  } catch { /* Invalid cover URLs use the branded fallback. */ }
  const meta = (key, value, property = false) => `<meta ${property ? 'property' : 'name'}="${key}" content="${escape(value)}" />`;
  const tags = [
    `<title>${escape(title)}</title>`, meta('description', description),
    meta('og:site_name', 'Project Antara', true), meta('og:type', post ? 'article' : 'website', true),
    meta('og:title', title, true), meta('og:description', description, true),
    meta('og:url', url, true), meta('og:image', image, true),
    meta('og:image:alt', post ? title : 'Project Antara — BITS Goa CubeSat mission', true),
    meta('twitter:card', 'summary_large_image'), meta('twitter:title', title),
    meta('twitter:description', description), meta('twitter:image', image),
    meta('twitter:image:alt', post ? title : 'Project Antara — BITS Goa CubeSat mission'),
    `<link rel="canonical" href="${escape(url)}" />`,
  ];
  if (post?.publishedAt) tags.push(meta('article:published_time', new Date(post.publishedAt).toISOString(), true));
  return template.replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:[^"']*|twitter:[^"']*|article:[^"']*)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace('</head>', `${tags.join('\n    ')}\n  </head>`);
}

export function installSocialPreviewRoutes(app, { distDir, siteUrl, findPost }) {
  const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  app.get(/.*/, async (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') ||
        (path.extname(req.path) && req.path !== '/index.html')) return next();
    try {
      const pathname = req.path === '/index.html' ? '/' : req.path;
      let post;
      if (pathname.startsWith('/posts/')) {
        const slug = decodeURIComponent(pathname.slice(7)).replace(/\/$/, '').toLowerCase();
        post = await findPost(slug);
        if (!post) res.status(404);
      }
      const origin = siteUrl || `${req.protocol}://${req.get('host')}`;
      res.type('html').send(renderSocialPreview(template, { origin, pathname, post }));
    } catch (error) { next(error); }
  });
}
