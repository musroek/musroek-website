#!/usr/bin/env node
/**
 * Musroek — zero-dependency static site generator.
 * content/ (JSON) + static/ → dist/
 *   Home  : The Walk — one painted line, works found along it (the chain grows)
 *   Shop  : Migration — a horizontal route you travel along
 *   Mus   : a scattered field, white
 *   Roek  : one work per screen, dark
 *   &     : a secret thank you
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const STATIC = path.join(ROOT, 'static');
const DIST = path.join(ROOT, 'dist');

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = (t = '') => t.trim().split(/\n\s*\n/).map(b =>
  '<p>' + esc(b.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>') + '</p>').join('\n');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
function write(rel, html) {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rnd = (s, salt) => ((hash(s + salt) % 1000) / 1000);
const has = (rel) => fs.existsSync(path.join(STATIC, rel.replace(/^\//, '')));

// ---------- content ----------
const settings = readJSON(path.join(CONTENT, 'settings.json'));
const works = fs.readdirSync(path.join(CONTENT, 'works')).filter(f => f.endsWith('.json'))
  .map(f => readJSON(path.join(CONTENT, 'works', f)))
  .sort((a, b) => (b.year || 0) - (a.year || 0) || String(a.title).localeCompare(b.title));
const pages = {};
for (const f of fs.readdirSync(path.join(CONTENT, 'pages'))) {
  if (f.endsWith('.json')) pages[f.replace('.json', '')] = readJSON(path.join(CONTENT, 'pages', f));
}
const darkImage = (w) => {
  const alt = w.image.replace('/works/', '/works_dark/');
  return has(alt) ? alt : w.image;
};

// ---------- layout ----------
function layout({ title, active, body, description, image, dark, bodyClass }) {
  const nav = [
    ['shop', 'Shop', '/shop/'], ['mus', 'Mus', '/mus/'], ['and', '&amp;', '/and/'],
    ['roek', 'Roek', '/roek/'], ['manifesto', 'Manifesto', '/manifesto/'],
  ].map(([k, l, h]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('\n        ');
  const t = title ? title + ' — ' + settings.title : settings.title;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(description || settings.description)}">
<meta property="og:site_name" content="${esc(settings.title)}">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(description || settings.description)}">
<meta property="og:image" content="${esc((settings.site_url || '') + (image || '/images/works/' + settings.featured_work + '.jpg'))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/main.css">
<link rel="icon" href="/images/favicon.png" type="image/png">
</head>
<body class="${[dark ? 'theme-dark' : '', bodyClass || ''].filter(Boolean).join(' ')}">
  <header class="site-header">
    <a class="wordmark" href="/"><img src="/images/musroek-logo${dark ? '-white' : ''}.gif" alt="${esc(settings.title)}"></a>
    <nav>
        ${nav}
        <a class="ig" href="${esc(settings.instagram_url)}" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        </a>
    </nav>
  </header>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <p>${esc(settings.artist)} — ${esc(settings.location)}</p>
    <p><a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a>
      <span aria-hidden="true">·</span>
      <a href="${esc(settings.instagram_url)}" rel="noopener">Instagram</a></p>
  </footer>
<script>
(function(){
  var r=document.getElementById('route');
  if(r) window.addEventListener('wheel',function(e){
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){ r.scrollLeft+=e.deltaY*1.1; e.preventDefault(); }
  },{passive:false});
})();
(function(){
  var els=[].slice.call(document.querySelectorAll('.drift,.stage,.work-card,.find,.perch'));
  if(!('IntersectionObserver' in window)||!els.length) return;
  function show(el){ el.classList.add('is-in'); }
  // anything already on screen is shown at once — the top of the page is never blank
  var fold=window.innerHeight*1.2;
  els.forEach(function(el){
    if(el.getBoundingClientRect().top < fold) { el.classList.add('reveal','is-in'); }
    else el.classList.add('reveal');
  });
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){ show(e.target); io.unobserve(e.target); }})},
    {rootMargin:'200px 0px 200px 0px',threshold:0});
  els.forEach(function(el){ if(!el.classList.contains('is-in')) io.observe(el); });
  // failsafe: whatever happens — slow images, odd browser — nothing stays hidden
  setTimeout(function(){ els.forEach(show); }, 2500);
  window.addEventListener('load',function(){ setTimeout(function(){ els.forEach(show); },400); });
})();
</script>
</body>
</html>`;
}

function inquireHref(w) {
  const s = encodeURIComponent(`Inquiry — ${w.title}`);
  const b = encodeURIComponent(`Hello,\n\nI would like to inquire about "${w.title}"${w.year ? ` (${w.year})` : ''}.\n\n`);
  return `mailto:${settings.email}?subject=${s}&body=${b}`;
}
function collectionHead(title, intro) {
  return `    <div class="collection-head">
      <h1 class="collection-title">${esc(title)}</h1>
${intro ? '      <div class="collection-intro">' + md(intro) + '</div>' : ''}
    </div>`;
}

/* one hand-painted line per walk — all leaving the same point, each
   running the whole height, swinging to the centre where its works are */
function walkLine(H, restX, S, E, seed) {
  const ORIGIN_X = 50, ORIGIN_Y = 30;
  const ease = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const at = (y) => {
    // leave the shared origin over the first stretch
    const out = ease((y - ORIGIN_Y) / 620);
    let base = ORIGIN_X + (restX - ORIGIN_X) * out;
    // swing into the middle of the page while this walk is being walked
    const inArc = ease((y - (S - 520)) / 520);
    const outArc = 1 - ease((y - E) / 520);
    const active = Math.min(inArc, outArc);
    base = base + (50 - base) * active;
    const meander = Math.sin(y / 1150 + hash(seed) % 7) * 9 * (0.35 + 0.65 * active);
    const hand = (rnd(seed, 'h' + Math.round(y / 250)) - 0.5) * 1.5
               + Math.sin(y / 420) * 0.8 + Math.sin(y / 133) * 0.3;
    return base + meander + hand;
  };
  const pts = [];
  for (let y = ORIGIN_Y; y <= H; y += 85) pts.push([at(y), y]);
  pts.push([at(H), H]);
  let d = `M ${pts[0][0].toFixed(2)} ${ORIGIN_Y}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], my = (y0 + y1) / 2;
    d += ` C ${x0.toFixed(2)} ${my.toFixed(1)} ${x1.toFixed(2)} ${my.toFixed(1)} ${x1.toFixed(2)} ${y1.toFixed(1)}`;
  }
  return { d, at };
}

// ---------- HOME: the walks ----------
{
  const walkMeta = pages.walks || {};
  const ids = [...new Set(works.map(w => w.walk || 1))].sort((a, b) => a - b);
  const byWalk = ids.map(id => ({ id, list: works.filter(w => (w.walk || 1) === id) }));

  const SLOT = 460;          // room for big work
  const HEAD = 620;          // the lines leave the door before anything is found
  const GAP  = 620;          // breath between walks
  let cursor = HEAD;
  for (const w of byWalk) { w.S = cursor; w.E = cursor + w.list.length * SLOT; cursor = w.E + GAP; }
  const H = cursor + 260;

  const restLanes = [14, 86, 25, 75, 34, 66, 44, 56];
  const lines = byWalk.map((w, i) => walkLine(H, restLanes[i % restLanes.length], w.S, w.E, 'walk' + w.id));

  const paths = byWalk.map((w, i) =>
    `      <path class="trail-line" id="pathline-${w.id}" d="${lines[i].d}" vector-effect="non-scaling-stroke"/>`).join('\n');

  const marks = byWalk.map((w, i) => {
    const at = lines[i].at;
    const meta = walkMeta[String(w.id)] || {};
    const mark = meta.mark || 'I'.repeat(w.id);
    const label = `      <div class="walk-label" style="top:${(w.S - 300).toFixed(0)}px">
        <span class="walk-mark" aria-label="Walk ${w.id}">${esc(mark)}</span>
${meta.note ? `        <span class="walk-note">${esc(meta.note)}</span>` : ''}
      </div>`;
    const finds = w.list.map((k, j) => {
      const y = w.S + j * SLOT + rnd(k.slug, 'y') * 90;
      const lx = at(y);
      const side = (j % 2 === 0) ? 1 : -1;
      const size = (k.collection === 'mus' ? 26 : 30) + rnd(k.slug, 'z') * 12;
      const reach = size / 2 + 5 + rnd(k.slug, 'd') * 4;
      const x = Math.max(size / 2 + 2, Math.min(98 - size / 2, lx + side * reach));
      const tilt = (rnd(k.slug, 'r') - 0.5) * 3.6;
      const l = Math.min(lx, x), r = Math.max(lx, x);
      return `      <span class="stem" style="left:${l.toFixed(2)}%;width:${(r - l).toFixed(2)}%;top:${y.toFixed(0)}px"></span>
      <a class="find" href="/work/${esc(k.slug)}/" style="left:${x.toFixed(2)}%;top:${y.toFixed(0)}px;--w:${size.toFixed(1)}%;--r:${tilt.toFixed(1)}deg">
        <img src="${esc(k.image)}" alt="${esc(k.title)}" loading="lazy">
        <span class="found">${esc(k.title)}${k.year ? ' · ' + esc(k.year) : ''}</span>
      </a>`;
    }).join('\n');
    return label + '\n' + finds;
  }).join('\n');

  const body = `    <section class="walk" style="--trail-h:${H}px">
      <svg class="trail" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
${paths}
      </svg>
      <span class="door" title="the front door"></span>
      <p class="door-note">every walk starts at the same door</p>
${marks}
      <p class="walk-end">— and back home again</p>
    </section>`;
  write('index.html', layout({ active: null, body }));
}

// ---------- SHOP: Migration ----------
{
  const list = works.filter(w => (w.collection === 'roek' || w.collection === 'edition')
    && w.forSale !== false && w.inShop !== false);
  let x = 300;
  const perches = list.map((w) => {
    const sold = w.availability === 'sold';
    const h = 210 + rnd(w.slug, 'h') * 150;
    const top = 22 + rnd(w.slug, 't') * 38;
    const n = `        <a class="perch${sold ? ' is-sold' : ''}" href="/work/${esc(w.slug)}/" style="left:${x.toFixed(0)}px;top:${top.toFixed(0)}%;--h:${h.toFixed(0)}px">
          <img src="${esc(w.image)}" alt="${esc(w.title)}" loading="lazy">
          <span class="perch-label">
            <span class="perch-title">${esc(w.title)}${w.year ? ` <span class="work-year">${esc(w.year)}</span>` : ''}</span>
            <span class="perch-meta">${esc(sold ? 'Sold' : (w.price || 'Available'))}</span>
          </span>
        </a>`;
    x += h * 0.8 + 140 + rnd(w.slug, 'g') * 110;
    return n;
  }).join('\n');
  const total = Math.round(x + 360);
  let d = 'M 0 470';
  for (let px = 0; px <= total; px += 210) {
    const wob = (rnd('route', 'w' + px) - 0.5) * 26;
    d += ` Q ${px + 105} ${390 + Math.sin(px / 620) * 165 + wob} ${px + 210} ${450 + Math.sin(px / 390) * 130}`;
  }
  const body = `${collectionHead('Shop', pages.shop && pages.shop.intro)}
    <div class="route-scroll" id="route">
      <div class="route" style="width:${total}px">
        <svg class="route-line" viewBox="0 0 ${total} 900" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>
${perches}
      </div>
    </div>
    <p class="route-hint">scroll sideways →</p>`;
  write('shop/index.html', layout({ title: 'Shop', active: 'shop', body, bodyClass: 'shop-page' }));
}

// ---------- MUS: a scattered field ----------
{
  const list = works.filter(w => w.collection === 'mus');
  const items = list.map(w => {
    const wide = 0.55 + rnd(w.slug, 'w') * 0.45;
    const shift = rnd(w.slug, 'x') * (1 - wide);
    const drop = 1 + rnd(w.slug, 'y') * 7;
    return `      <a class="drift" href="/work/${esc(w.slug)}/" style="--w:${(wide * 100).toFixed(1)}%;--x:${(shift * 100).toFixed(1)}%;--drop:${drop.toFixed(1)}rem">
        <img src="${esc(w.image)}" alt="" loading="lazy">
      </a>`;
  }).join('\n');
  write('mus/index.html', layout({ title: 'Mus', active: 'mus',
    body: `${collectionHead('Mus', pages.mus && pages.mus.intro)}\n    <div class="field">\n${items}\n    </div>` }));
}

// ---------- ROEK: one work per screen, dark ----------
{
  const list = works.filter(w => w.collection === 'roek');
  const stages = list.map(w => `      <section class="stage">
        <a class="stage-img" href="/work/${esc(w.slug)}/"><img src="${esc(darkImage(w))}" alt="${esc(w.title)}" loading="lazy"></a>
        <div class="stage-caption"><h2>${esc(w.title)}</h2><p>${esc([w.year, w.materials].filter(Boolean).join(' · '))}</p></div>
      </section>`).join('\n');
  write('roek/index.html', layout({ title: 'Roek', active: 'roek', dark: true,
    body: `${collectionHead('Roek', pages.roek && pages.roek.intro)}\n    <div class="stages">\n${stages}\n    </div>` }));
}

// ---------- work detail ----------
for (const w of works) {
  const sold = w.availability === 'sold';
  const isDark = w.collection === 'roek';
  const det = [w.year, w.materials, w.dimensions].filter(Boolean).map(d => `          <li>${esc(d)}</li>`);
  if (w.forSale !== false) {
    if (sold) det.push(`          <li class="sold-tag">Sold</li>`);
    else if (w.price) det.push(`          <li>${esc(w.price)}</li>`);
  }
  const gallery = Array.isArray(w.gallery) && w.gallery.length
    ? `\n      <div class="work-gallery">\n${w.gallery.map((g, i) => `        <img src="${esc(isDark ? g.replace('/works/', '/works_dark/') : g)}" alt="${esc(w.title)} — ${i + 2}" loading="lazy">`).join('\n')}\n      </div>` : '';
  const body = `    <article class="work-detail">
      <figure><img src="${esc(isDark ? darkImage(w) : w.image)}" alt="${esc(w.title)}">${gallery}</figure>
      <div class="work-info">
        <h1>${esc(w.title)}</h1>
        <ul class="work-details">
${det.join('\n')}
        </ul>
${w.description ? md(w.description) : ''}
${w.forSale === false
      ? `        <p class="not-for-sale">${esc(w.notForSaleNote || 'Not for sale.')}</p>`
      : (!sold ? `        <a class="inquire" href="${inquireHref(w)}">Inquire about this work</a>` : '')}
      </div>
    </article>`;
  write(`work/${w.slug}/index.html`, layout({
    title: w.title + (w.titleNote ? ` (${w.titleNote})` : ''),
    active: w.collection === 'mus' ? 'mus' : 'roek', body, dark: isDark,
    description: w.description || `${w.title}${w.year ? ', ' + w.year : ''} — ${w.materials || 'work'} by ${settings.artist}.`,
    image: w.image,
  }));
}

// ---------- manifesto (dark, in weather) ----------
{
  const m = pages.manifesto || { title: 'Manifesto', body: '' };
  write('manifesto/index.html', layout({
    title: m.title, active: 'manifesto', dark: true, bodyClass: 'manifesto-page',
    body: `    <article class="prose prose--manifesto">
      <h1>${esc(m.heading || m.title)}</h1>
${md(m.body)}
    </article>`,
  }));
}

// ---------- the secret & ----------
write('and/index.html', layout({
  title: '&', active: 'and', description: 'A small thank you.',
  body: `    <section class="secret">
      <p class="secret-amp">&amp;</p>
      <div class="secret-note">
        <p>You wandered in between.</p>
        <p>Thank you — truly — for giving this little corner of the internet so much of your attention. For looking long enough that even the space between things became worth seeing.</p>
        <p>Much love,<br>Musroek</p>
      </div>
    </section>`,
}));

write('404.html', layout({ title: 'Not found', active: null,
  body: `    <article class="prose"><h1>Page not found</h1><p><a href="/">Back to the front page</a></p></article>` }));

const urls = ['/', '/shop/', '/mus/', '/roek/', '/manifesto/', '/and/', ...works.map(w => `/work/${w.slug}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${settings.site_url}${u}</loc></url>`).join('\n')}\n</urlset>`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${settings.site_url}/sitemap.xml\n`);

copyDir(STATIC, DIST);
console.log('Build complete →', DIST, '·', works.length, 'works');
