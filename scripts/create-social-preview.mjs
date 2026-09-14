import sharp from 'sharp';

// Compose existing brand artwork and typography; rerun when branding changes.
const artwork = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#060c1b"/><stop offset="1" stop-color="#162b51"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<g fill="none" stroke="#486b9f" opacity=".25"><circle cx="995" cy="315" r="270"/><circle cx="995" cy="315" r="310"/></g>
<path d="M72 100h64" stroke="#85bdff" stroke-width="4"/>
<g font-family="DejaVu Sans, sans-serif" fill="#f3f6ff">
<text x="72" y="163" font-size="20" letter-spacing="4" fill="#a8caff">BITS GOA · STUDENT SPACE MISSION</text>
<text x="67" y="277" font-size="88" font-weight="bold" letter-spacing="3">ANTARA</text>
<text x="72" y="345" font-size="29">Student-built. Space-bound.</text>
<text x="72" y="427" font-size="23" fill="#b9c7df">Exploring radiation in low Earth orbit.</text>
<text x="72" y="546" font-size="17" letter-spacing="3" fill="#a8caff">ONE TEAM. ONE SATELLITE.</text>
</g></svg>`);
const logo = await sharp('src/assets/ANTARA_logo_badge-modified.png').resize(350, 350).toBuffer();
await sharp(artwork).composite([{ input: logo, left: 790, top: 140 }]).png().toFile('public/social-preview.png');
