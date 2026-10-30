# Kadjoe website

The public website of PT Kadjoe Kreasi Indonesia: projects, photographs, design partners, the home
page hero, Instagram import and the company profile PDF.

Design notes and the reasoning behind the look are in [DESIGN.md](DESIGN.md).

## Stack

Next.js 16 (App Router, TypeScript), SQLite (better-sqlite3 + Drizzle), sharp for photographs,
@react-pdf/renderer for the company profile, GSAP + Lenis for motion. One Node process, one data
folder; it runs next to the finance app on the same server.

## Pages

| Public | |
|---|---|
| `/` | Hero photographs chosen in the finance app, selected projects, categories, design partners |
| `/projects` | Every published project, filter by Residential, F&B, Commercial; photographs or register view |
| `/projects/<slug>` | Title block (category, location, year, service, design, photography), gallery, lightbox |
| `/partners` | Design studios with the projects built together, in a new random order on every visit |
| `/about`, `/contact` | Kadjoe's own text, services, clients; the Kalideres office, email, Instagram |

## Admin

Admin lives in the finance app (menu **Website**); this site has no sign-in of its own. It exposes
`/api/internal/<op>` to the finance app, guarded by a shared Bearer token, and Caddy answers 404 for
that path from the internet so only the finance app reaches it over the docker network.

| Variable | |
|---|---|
| `SITE_ADMIN_TOKEN` | Shared secret; the finance app sends the same value. Unset refuses every call. |
| `FINANCE_URL` | The finance app's address; the Instagram sign-in returns to `<FINANCE_URL>/website/instagram`. Required. |

The `users`, `sessions` and `login_attempts` tables are left over from the old dashboard and unused.

## Run it locally

```bash
npm install
npm run db:migrate
npm run import:legacy -- --site ../kadjoe-website --wp-zip ~/Downloads/kadjoe-backup-website/well-known.zip
npm run dev
```

The site runs on http://localhost:3200; set `SITE_ADMIN_TOKEN` and `FINANCE_URL` in `.env` to manage
it from a local finance app. The import
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
  still in progress waits under Website > Instagram in the finance app for one click.
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
     Instagram** in the finance app; Kadjoe signs in on instagram.com and lands back there, or
   - generate an access token in the Meta app dashboard (Instagram > API setup > Generate token) and
     paste it in the finance app.

Nobody gives the site the Instagram password.

## Deploy

The image is built like the finance app's (`Dockerfile`, Node 24, runs as `node`, data in `/data`):

```bash
docker build -t kadjoe-site:$(git rev-parse --short HEAD) .
```

On the server, `deploy/compose.site.yml` adds the `site` service to the existing stack and
`deploy/Caddyfile.site` is the block for Caddy. Environment: `SITE_URL`, `SITE_ADMIN_TOKEN`,
`FINANCE_URL`, optionally `IG_APP_ID` and `IG_APP_SECRET` (see `.env.example`). The first start
creates the database; copy a prepared `data/` folder (database + `media/`) into the volume to start
with the imported projects.

Back up `/data` (the database and `media/`); the photographs can be re-imported from Instagram, the
edits made in the finance app cannot.

## Data layout

```
data/site.db           projects, photographs, partners, hero, Instagram posts, settings
data/media/<id>/       master.webp (long edge 2560 px) and the sizes cut from it on first request
```
