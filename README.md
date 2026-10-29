# Kadjoe website

The public website of PT Kadjoe Kreasi Indonesia and the dashboard that runs it: projects, photographs,
design partners, the home page hero, Instagram import and the company profile PDF.

Design notes and the reasoning behind the look are in [DESIGN.md](DESIGN.md).

## Stack

Next.js 16 (App Router, TypeScript), SQLite (better-sqlite3 + Drizzle), sharp for photographs,
@react-pdf/renderer for the company profile, GSAP + Lenis for motion. One Node process, one data
folder; it runs next to the finance app on the same server.

## Pages

| Public | |
|---|---|
| `/` | Hero photographs chosen in the dashboard, selected projects, categories, design partners |
| `/projects` | Every published project, filter by Residential, F&B, Commercial; photographs or register view |
| `/projects/<slug>` | Title block (category, location, year, service, design, photography), gallery, lightbox |
| `/partners` | Design studios with the projects built together, in a new random order on every visit |
| `/about`, `/contact` | Kadjoe's own text, services, clients; the Kalideres office, email, Instagram |

| Dashboard (`/admin`) | |
|---|---|
| Home page | Hero photographs (add from any project, drag to order) and the order of selected projects |
| Projects | Edit details and credits; photographs: upload, reorder, cover, focal point, hide, delete, move, **split into a new project**, merge |
| Partners | Names, Instagram handles, merge duplicates |
| Instagram | Connect the account, check now, review posts that could not be placed with certainty |
| Company profile | Pick categories and projects, preview, download the PDF (A4 landscape, no Team page) |
| Settings | Address, email, phone, Instagram handle, clients list, accounts and passwords |

## Run it locally

```bash
npm install
npm run db:migrate
npm run import:legacy -- --site ../kadjoe-website --wp-zip ~/Downloads/kadjoe-backup-website/well-known.zip
npm run admin:create -- --name "Nama" --email you@example.com
npm run dev
```

The site runs on http://localhost:3200 and the dashboard on http://localhost:3200/admin. The import
reads the previous static site and the WordPress backup (both read-only) into `data/`: 112 projects,
1,758 photographs, 27 design studios. It splits the two M House projects the old scraper had merged.

`npm run media:warm` cuts the common image sizes ahead of time (add `--all` for every gallery).
`npm test` runs the Instagram caption and matching tests.

## Instagram

New posts become projects by themselves when their caption has Kadjoe's usual lines:

```
Client : M House
Type : Residential
Location : Greenlake City
Service : Build
Design : @beta.design.studio
Photography : @leowardistudio
```

- A post whose project is already on the site (same name, same place or same designer) adds its
  photographs to it. A post with the same name in another place becomes a new project; that is what
  keeps two different M Houses apart.
- A post that matches more than one project, has no recognised type, is a video, or says the work is
  still in progress waits under Dashboard > Instagram for one click.
- Posts without the caption form (greetings, team photos) are skipped.
- The server checks every 30 minutes (`IG_SYNC_MINUTES`) and renews the access token by itself.

What it needs, once:

1. **@kadjoe_id must be a professional account** (Business or Creator: Instagram app > Settings >
   Account type and tools).
2. **A Meta developer app** with the product "Instagram API with Instagram login" and the permission
   `instagram_business_basic`. Add @kadjoe_id as an Instagram tester of the app (Kadjoe accepts the
   invite in Instagram > Settings > Website permissions > Apps and websites).
3. Then either:
   - set `IG_APP_ID` and `IG_APP_SECRET` on the server, register
     `https://<site>/api/instagram/callback` as the app's redirect address, and press **Connect
     Instagram** in the dashboard; Kadjoe signs in on instagram.com, or
   - generate an access token in the Meta app dashboard (Instagram > API setup > Generate token) and
     paste it in the dashboard.

Nobody gives the site the Instagram password.

## Deploy

The image is built like the finance app's (`Dockerfile`, Node 24, runs as `node`, data in `/data`):

```bash
docker build -t kadjoe-site:$(git rev-parse --short HEAD) .
```

On the server, `deploy/compose.site.yml` adds the `site` service to the existing stack and
`deploy/Caddyfile.site` is the block for Caddy. Environment: `SITE_URL`, optionally `IG_APP_ID` and
`IG_APP_SECRET` (see `.env.example`). The first start creates the database; copy a prepared `data/`
folder (database + `media/`) into the volume to start with the imported projects, then create the
first account inside the container:

```bash
docker compose exec site node dist/create-admin.mjs --name "Nama" --email you@example.com
```

Back up `/data` (the database and `media/`); the photographs can be re-imported from Instagram, the
dashboard edits cannot.

## Data layout

```
data/site.db           projects, photographs, partners, hero, Instagram posts, settings, accounts
data/media/<id>/       master.webp (long edge 2560 px) and the sizes cut from it on first request
```
