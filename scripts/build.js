#!/usr/bin/env node
/**
 * Musroek — zero-dependency static site generator.
 * Reads content/ (JSON + markdown-ish text), writes dist/.
 * Run: node scripts/build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const STATIC = path.join(ROOT, 'static');
const DIST = path.join(ROOT, 'dist');

// ---------- helpers ----------
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// minimal markdown: paragraphs, *em*, **strong**, line breaks
function md(text = '') {
  return text.trim().split(/\n\s*\n/).map(block =>
    '<p>' + esc(block.trim())
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>') + '</p>'
  ).join('\n');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function write(rel, html) {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
  console.log('  wrote', rel);
}

// ---------- load content ----------
const settings = readJSON(path.join(CONTENT, 'settings.json'));
const works = fs.readdirSync(path.join(CONTENT, 'works'))
  .filter(f => f.endsWith('.json'))
  .map(f => readJSON(path.join(CONTENT, 'works', f)))
  .sort((a, b) => (b.year || 0) - (a.year || 0) || String(a.title).localeCompare(b.title));

const pages = {};
for (const f of fs.readdirSync(path.join(CONTENT, 'pages'))) {
  if (f.endsWith('.json')) pages[f.replace('.json', '')] = readJSON(path.join(CONTENT, 'pages', f));
}

// ---------- layout ----------
function layout({ title, active, body, description }) {
  const nav = [
    ['work', 'Work', '/work/'],
    ['mus', 'Mus', '/mus/'],
    ['roek', 'Roek', '/roek/'],
    ['manifesto', 'Manifesto', '/manifesto/'],
  ].map(([key, label, href]) =>
    `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('\n        ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? title + ' — ' + settings.title : settings.title)}</title>
<meta name="description" content="${esc(description || settings.description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/main.css">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
</head>
<body>
  <header class="site-header">
    <a class="wordmark" href="/"><img src="/images/musroek-logo.png" alt="${esc(settings.title)}"></a>
    <nav>
        ${nav}
    </nav>
  </header>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <p>${esc(settings.artist)} — ${esc(settings.location)}</p>
    <p>
      <a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a>
      <span aria-hidden="true">·</span>
      <a href="${esc(settings.instagram_url)}" rel="noopener">Instagram</a>
    </p>
  </footer>
</body>
</html>`;
}

// ---------- components ----------
function inquireHref(work) {
  const subject = encodeURIComponent(`Inquiry — ${work.title}`);
  const body = encodeURIComponent(
    `Hello,\n\nI would like to inquire about "${work.title}"${work.year ? ` (${work.year})` : ''}.\n\n`);
  return `mailto:${settings.email}?subject=${subject}&body=${body}`;
}

function workCard(w) {
  return `      <a class="work-card" href="/work/${esc(w.slug)}/">
        <figure>
          <img src="${esc(w.image)}" alt="${esc(w.title)}" loading="lazy">
          <figcaption>
            <span class="work-title">${esc(w.title)}</span>
            <span class="work-meta">${[w.year, w.availability === 'sold' ? 'Sold' : (w.price || '')].filter(Boolean).map(esc).join(' — ')}</span>
          </figcaption>
        </figure>
      </a>`;
}

function workGrid(list) {
  return `    <div class="work-grid">\n${list.map(workCard).join('\n')}\n    </div>`;
}

// ---------- pages ----------
// Home
{
  const featured = works.find(w => w.slug === settings.featured_work) || works[0];
  const body = `    <section class="hero">
      <a href="/work/${esc(featured.slug)}/">
        <img src="${esc(featured.image)}" alt="${esc(featured.title)}">
      </a>
      <p class="hero-caption"><em>${esc(featured.title)}</em>${featured.year ? ', ' + esc(featured.year) : ''}</p>
    </section>
    <section class="intro">
${md(settings.intro)}
    </section>`;
  write('index.html', layout({ active: null, body }));
}

// Work index + collection pages
const collections = [
  { key: 'work', title: 'Work', filter: () => true, intro: pages.work?.intro },
  { key: 'mus', title: 'Mus', filter: w => w.collection === 'mus', intro: pages.mus?.intro },
  { key: 'roek', title: 'Roek', filter: w => w.collection === 'roek', intro: pages.roek?.intro },
];
for (const c of collections) {
  const list = works.filter(c.filter);
  const body = `    <h1>${esc(c.title)}</h1>
${c.intro ? '    <div class="collection-intro">' + md(c.intro) + '</div>' : ''}
${workGrid(list)}`;
  write(`${c.key}/index.html`, layout({ title: c.title, active: c.key, body }));
}

// Individual work pages
for (const w of works) {
  const details = [
    w.year, w.materials, w.dimensions,
    w.availability === 'sold' ? 'Sold' : w.price,
  ].filter(Boolean);
  const body = `    <article class="work-detail">
      <figure>
        <img src="${esc(w.image)}" alt="${esc(w.title)}">
      </figure>
      <div class="work-info">
        <h1>${esc(w.title)}</h1>
        <ul class="work-details">
${details.map(d => `          <li>${esc(d)}</li>`).join('\n')}
        </ul>
${w.description ? md(w.description) : ''}
${w.availability !== 'sold'
      ? `        <a class="inquire" href="${inquireHref(w)}">Inquire about this work</a>`
      : ''}
      </div>
    </article>`;
  write(`work/${w.slug}/index.html`, layout({ title: w.title, active: 'work', body, description: w.description }));
}

// Manifesto
{
  const m = pages.manifesto || { title: 'Manifesto', body: '' };
  const body = `    <article class="prose">
      <h1>${esc(m.title)}</h1>
${md(m.body)}
    </article>`;
  write('manifesto/index.html', layout({ title: m.title, active: 'manifesto', body }));
}

// 404
write('404.html', layout({
  title: 'Not found', active: null,
  body: `    <article class="prose"><h1>Page not found</h1><p><a href="/">Back to the front page</a></p></article>`,
}));

// static assets
copyDir(STATIC, DIST);
console.log('\nBuild complete →', DIST);
