# musroek.com

Static site for Musroek (Jorn Vlaanderen). Zero build dependencies — plain Node.

## Edit content
Everything lives in `content/`:
- `content/settings.json` — site title, contact, homepage intro, featured work.
- `content/works/*.json` — one file per artwork.
- `content/pages/*.json` — Manifesto text and Mus/Roek intros.
- Images in `static/images/works/`.

## Build
```
node scripts/build.js        # → dist/  (the deployable site)
node scripts/build-preview.js # → musroek-preview.html (single-file clickable preview)
```

## Deploy (Cloudflare Pages / Netlify)
- Build command: `node scripts/build.js`
- Output directory: `dist`
- No install step needed.

## Admin dashboard
Visual editor at `/admin` (Sveltia CMS). Configure `static/admin/config.yml`:
- set `backend.repo` to `your-github-username/musroek`
- set the auth `base_url` to your deployed sveltia-cms-auth worker.
