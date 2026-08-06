#!/usr/bin/env node
/**
 * Single-file clickable preview: inlines all pages + images as data URIs,
 * with a tiny hash router so Mus can click through everything in Cowork.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const STATIC = path.join(ROOT, 'static');

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = (t = '') => t.trim().split(/\n\s*\n/).map(b => '<p>' + esc(b.trim()).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\n/g,'<br>') + '</p>').join('\n');

function dataURI(rel) {
  const p = path.join(STATIC, rel.replace(/^\//, ''));
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

const settings = readJSON(path.join(CONTENT, 'settings.json'));
const works = fs.readdirSync(path.join(CONTENT, 'works')).filter(f => f.endsWith('.json'))
  .map(f => readJSON(path.join(CONTENT, 'works', f)))
  .sort((a, b) => (b.year || 0) - (a.year || 0) || String(a.title).localeCompare(b.title));
const pages = {};
for (const f of fs.readdirSync(path.join(CONTENT, 'pages'))) if (f.endsWith('.json')) pages[f.replace('.json','')] = readJSON(path.join(CONTENT,'pages',f));

const logo = dataURI('/images/musroek-logo.png');
for (const w of works) w._img = dataURI(w.image.replace('/works/','/works_sm/'));

const css = fs.readFileSync(path.join(STATIC, 'assets/css/main.css'), 'utf8');

function card(w) {
  const meta = [w.year, w.availability === 'sold' ? 'Sold' : (w.price||'')].filter(Boolean).map(esc).join(' — ');
  return `<a class="work-card" href="#/work/${esc(w.slug)}"><figure><img src="${w._img}" alt="${esc(w.title)}"><figcaption><span class="work-title">${esc(w.title)}</span><span class="work-meta">${meta}</span></figcaption></figure></a>`;
}
function grid(list){return `<div class="work-grid">${list.map(card).join('')}</div>`;}

const routes = {};
const featured = works.find(w => w.slug === settings.featured_work) || works[0];
routes[''] = `<section class="hero"><a href="#/work/${esc(featured.slug)}"><img src="${featured._img}" alt="${esc(featured.title)}"></a><p class="hero-caption"><em>${esc(featured.title)}</em>, ${esc(featured.year)}</p></section><section class="intro">${md(settings.intro)}</section>`;
routes['work'] = `<h1>Work</h1>${grid(works)}`;
routes['mus'] = `<h1>Mus</h1><div class="collection-intro">${md(pages.mus.intro)}</div>${grid(works.filter(w=>w.collection==='mus'))}`;
routes['roek'] = `<h1>Roek</h1><div class="collection-intro">${md(pages.roek.intro)}</div>${grid(works.filter(w=>w.collection==='roek'))}`;
routes['manifesto'] = `<article class="prose"><h1>${esc(pages.manifesto.title)}</h1>${md(pages.manifesto.body)}</article>`;
for (const w of works) {
  const details = [w.year, w.materials, w.dimensions, w.availability==='sold'?'Sold':w.price].filter(Boolean);
  routes['work/'+w.slug] = `<article class="work-detail"><figure><img src="${w._img}" alt="${esc(w.title)}"></figure><div class="work-info"><h1>${esc(w.title)}</h1><ul class="work-details">${details.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>${w.description?md(w.description):''}${w.availability!=='sold'?`<a class="inquire" href="mailto:${settings.email}?subject=${encodeURIComponent('Inquiry — '+w.title)}">Inquire about this work</a>`:''}</div></article>`;
}

const nav = [['work','Work'],['mus','Mus'],['roek','Roek'],['manifesto','Manifesto']]
  .map(([k,l])=>`<a href="#/${k}" data-nav="${k}">${l}</a>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(settings.title)} — preview</title>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>${css}
.preview-banner{background:#1c1a17;color:#f4f1ec;font-family:var(--sans);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;text-align:center;padding:.5rem;}
</style></head><body>
<div class="preview-banner">Preview · musroek.com rebuild</div>
<header class="site-header"><a class="wordmark" href="#/"><img src="${logo}" alt="${esc(settings.title)}"></a><nav>${nav}</nav></header>
<main id="app"></main>
<footer class="site-footer"><p>${esc(settings.artist)} — ${esc(settings.location)}</p><p><a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a> · <a href="${esc(settings.instagram_url)}">Instagram</a></p></footer>
<script>
const routes = ${JSON.stringify(routes)};
function render(){
  let h = location.hash.replace(/^#\\//,'').replace(/\\/$/,'');
  const el = document.getElementById('app');
  el.innerHTML = routes[h] !== undefined ? routes[h] : routes[''];
  document.querySelectorAll('[data-nav]').forEach(a=>{
    const k=a.getAttribute('data-nav');
    a.setAttribute('aria-current', (h===k||h.startsWith(k+'/'))?'page':'false');
  });
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',render); render();
</script></body></html>`;

fs.writeFileSync(path.join(ROOT, 'musroek-preview.html'), html);
console.log('preview →', (Buffer.byteLength(html)/1024/1024).toFixed(2), 'MB');
