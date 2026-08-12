#!/usr/bin/env node
/**
 * Single-file clickable preview, derived from the real dist/ build so it
 * can never drift from the site. Images are swapped for small inlined copies.
 * Run after scripts/build.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const STATIC = path.join(ROOT, 'static');
const CONTENT = path.join(ROOT, 'content');

const settings = JSON.parse(fs.readFileSync(path.join(CONTENT, 'settings.json'), 'utf8'));
const works = fs.readdirSync(path.join(CONTENT, 'works')).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(CONTENT, 'works', f), 'utf8')));

const cache = new Map();
function uri(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const p = path.join(STATIC, rel.replace(/^\//, ''));
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === 'gif' ? 'image/gif' : ext === 'png' ? 'image/png' : 'image/jpeg';
  const v = `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
  cache.set(rel, v);
  return v;
}
/** prefer the small copy; fall back to the full one */
function inlineImg(src) {
  const small = src.replace('/works/', '/works_sm/').replace('/works_dark/', '/works_dark_sm/');
  return uri(small) || uri(src) || src;
}

function grab(file) {
  const p = path.join(DIST, file);
  if (!fs.existsSync(p)) return null;
  const html = fs.readFileSync(p, 'utf8');
  const m = html.match(/<main>([\s\S]*?)<\/main>/);
  if (!m) return null;
  return m[1]
    .replace(/src="(\/images\/[^"]+)"/g, (_, s) => `src="${inlineImg(s)}"`)
    .replace(/href="\/work\/([^"/]+)\/"/g, 'href="#/work/$1"')
    .replace(/href="\/(shop|mus|roek|manifesto|and)\/"/g, 'href="#/$1"')
    .replace(/href="\/"/g, 'href="#/"');
}

const routes = {};
routes[''] = grab('index.html');
for (const k of ['shop', 'mus', 'roek', 'manifesto', 'and']) routes[k] = grab(`${k}/index.html`);
for (const w of works) {
  const r = grab(`work/${w.slug}/index.html`);
  if (r) routes['work/' + w.slug] = r;
}

const css = fs.readFileSync(path.join(STATIC, 'assets/css/main.css'), 'utf8')
  .replace("url('/images/manifesto-bg.jpg')", 'url(' + uri('/images/manifesto-bg.jpg') + ')');
const logo = uri('/images/musroek-logo.gif');
const logoWhite = uri('/images/musroek-logo-white.gif');
const darks = works.filter(w => w.collection === 'roek').map(w => w.slug);

const nav = [['shop', 'Shop'], ['mus', 'Mus'], ['and', '&amp;'], ['roek', 'Roek'], ['manifesto', 'Manifesto']]
  .map(([k, l]) => `<a href="#/${k}" data-nav="${k}">${l}</a>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${settings.title} — preview</title>
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>${css}
.preview-banner{background:#1c1a17;color:#f4f1ec;font-family:var(--sans);font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;text-align:center;padding:.5rem}
</style></head><body>
<div class="preview-banner">Preview · musroek.com</div>
<header class="site-header"><a class="wordmark" href="#/"><img src="${logo}" alt="musroek"></a><nav>${nav}</nav></header>
<main id="app"></main>
<footer class="site-footer"><p>${settings.artist} — ${settings.location}</p>
<p><a href="mailto:${settings.email}">${settings.email}</a> · <a href="${settings.instagram_url}">Instagram</a></p></footer>
<script>
const routes=${JSON.stringify(routes)};
const DARKS=${JSON.stringify(darks)};
const LOGO=${JSON.stringify(logo)},LOGO_W=${JSON.stringify(logoWhite)};
function wire(el){
  var r=el.querySelector('#route');
  window.onwheel=r?function(e){if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){r.scrollLeft+=e.deltaY*1.1;e.preventDefault();}}:null;
  window.onscroll=null;
  var els=el.querySelectorAll('.drift,.stage,.find,.perch');
  if('IntersectionObserver' in window && els.length){
    els.forEach(function(x){x.classList.add('reveal');});
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}})},
      {rootMargin:'0px 0px -8% 0px',threshold:0.05});
    els.forEach(function(x){io.observe(x);});
  }
}
function render(){
  var h=location.hash.replace(/^#\\//,'').replace(/\\/$/,'');
  var el=document.getElementById('app');
  el.innerHTML=routes[h]!==undefined?routes[h]:routes[''];
  var dk=h==='roek'||h==='manifesto'||DARKS.indexOf(h.replace('work/',''))>=0;
  document.body.classList.toggle('theme-dark',dk);
  document.body.classList.toggle('manifesto-page',h==='manifesto');
  document.querySelector('.wordmark img').src=dk?LOGO_W:LOGO;
  document.querySelectorAll('[data-nav]').forEach(function(a){
    a.setAttribute('aria-current',a.getAttribute('data-nav')===h?'page':'false');});
  window.scrollTo(0,0);
  wire(el);
}
window.addEventListener('hashchange',render); render();
</script></body></html>`;

fs.writeFileSync(path.join(ROOT, 'musroek-preview.html'), html);
console.log('preview →', (Buffer.byteLength(html) / 1024 / 1024).toFixed(2), 'MB ·', Object.keys(routes).length, 'routes');
