# Kadjoe website: design plan

## Brief

- **Subject:** PT Kadjoe Kreasi Indonesia, Jakarta, est. 2017. Interior build, civil engineering and
  design. Most projects are built to the drawings of independent design studios (27 credited so far);
  some are designed in-house.
- **Audience:** home owners, F&B and retail brands, offices; and interior designers looking for a
  builder they can trust with their drawings.
- **Job:** show the built work, credit the designers, make contact easy, and produce the company
  profile from the same data.
- **Assets:** 111 projects and 1,770 photographs (Kadjoe's Instagram and WordPress site, carried over
  from the previous build), the shield logo and its monospaced wordmark, Kadjoe's own copy (WordPress
  site and company profile).
- **Language:** English, like the company profile.
- **Revisions from the 22 Sep 2026 kickoff:** hero images chosen in a dashboard; the two M House
  projects shown separately; no running text; design partners in random order on every request;
  "Studio" renamed "About Us"; the Kalideres address; categories regrouped into Residential, F&B and
  Commercial; a dashboard that generates the company profile per category or from a custom selection,
  with no Team page.
- **Copy rule from the owner:** no AI filler and no unnecessary text. Every visible string is a fact
  (a name, a place, a year, a credit) or Kadjoe's own sentence.

## Concepts

| | Idea | Anchor | Signature | O / F / Fe / P |
|---|---|---|---|---|
| **A. The title block** (material of the profession) | Every view is laid out like a sheet from a construction set: a drawing area and a title block that names the project, its designer and its builder | Kadjoe builds from designers' drawings and credits them on every project; a drawing's title block is exactly where the designer and the contractor are named. Kadjoe's own shield is drawn in double lines, like walls on a plan, and its wordmark is set in a monospaced face | The hero sheet change: a hairline rule slides down the photograph like a parallel rule on a drafting table, the next photograph appears in its wake, and every cell of the title block rolls to the next project | 4 / 5 / 5 / 3 |
| B. The shadow gap (craft detail) | The site is a panelled wall: every image is separated by one precise recessed reveal; page changes slide panels apart like a flush jib door | High-end joinery is judged by its shadow gaps | Panels part along the reveal lines on navigation | 4 / 4 / 4 / 3 |
| C. Jakarta hour (place) | The site shows day or evening photographs depending on the hour in Jakarta | Kadjoe's F&B work is shot at dusk | The hero swaps light with the clock | 3 / 3 / 3 / 4 |

**Pick A.** It fits the business (a builder that credits designers), it is honest (every cell carries
real data), it is cheap to build well, and it survives everywhere: the hero, the project index, the
case page, the partners page, the footer, the 404 and the company profile PDF. From B, keep one
detail: the gallery gap is a consistent "reveal" width.

## Concept card

```
Idea:        Kadjoe builds what designers draw; the site is a construction set whose title blocks
             name the project, the designer and the builder.
Metaphor:    a drawing sheet: drawing area, title block, drawing register, divider sheets.
Signature:   the hero sheet change (hairline rule slides down, next photograph revealed in its wake,
             title block cells roll to the next project). Recipe: custom, src/components/site/HeroSheet.
Emotion:     calm precision. Quiet luxury with a builder's exactness.
Motion verb: slide on the rule and lock: straight, single-axis moves that decelerate hard and stop
             without overshoot; hairlines draw from their origin.
Screenshot:  a full-width interior photograph inside a paper sheet, with the hairline title block
             below it reading "Manzo / Kebayoran Baru / 2025 / Gondo & Jules".
```

## Art direction system

### Palette (monochrome; the photographs bring the colour)

| Role | Hex | Note |
|---|---|---|
| ground (paper) | `#F4F4F2` | neutral drafting film, not cream |
| ink (graphite) | `#1C1B1A` | Kadjoe's charcoal from the company profile (`#231F20`), a touch deeper |
| muted | `#6A6762` | 5.1:1 on paper |
| line | `rgb(28 27 26 / 0.16)` | hairlines, title block rules |
| sheet (dark) | `#1C1B1A` | divider sheets: curtain, loader, footer (as in the company profile) |
| on-sheet | `#EDEDEA`, muted `#A09C96` | 14.7:1 and 6.3:1 |

No accent colour. Focus rings are 2 px at a 3 px offset: ink on paper and paper on the dark sheet.

### Type

- **Switzer** (Fontshare, FFL): display at 300 with negative tracking, text at 400, emphasis 500.
  A neutral Swiss grotesk lets the interiors lead; at Light and large it reads quiet and expensive.
- **IBM Plex Mono** (Google, OFL): title block labels, counters, years, the footer wordmark. Chosen
  because Kadjoe's own wordmark is a light monospaced face with Plex's slab-spurred D and J. This is
  the one reason mono appears, and it appears only where a drawing would use technical lettering.
- Scale: mega `clamp(3.5rem, 1rem + 11vw, 13rem)`, xl `clamp(2.5rem, 1.2rem + 4.4vw, 5.75rem)`,
  l `clamp(1.5rem, 1.15rem + 1.4vw, 2.5rem)`, m `clamp(1.125rem, 1.05rem + 0.35vw, 1.375rem)`,
  body 16 to 18 px, labels 11 to 12 px uppercase with +0.08em tracking.
- Display tracking: -0.035em at xl, -0.045em at mega. Leading 0.92 to 1.0.

### Grid and rhythm

- 12 columns, gutter `clamp(16px, 2vw, 32px)`, outer margin = gutter. Phones: 4 columns.
- Strong lines: column 1 (titles), column 7 (second voice), column 12 (title blocks end here).
- The sheet: every page sits inside the paper margin; hairlines frame the header strip, drawing
  area and title strip.
- Section rhythm moods: tight (title strips), normal (lists), airy (statement), full viewport (hero).

### Shape

Radius 0 everywhere. Lines are 1 px; the double line (two hairlines 3 px apart, the logo's stroke)
marks the end of a sheet: above the footer and under the case-page title block.

### Motion language

- Eases: `expo.out` to lock, `expo.inOut` for sheet slides. No back or elastic.
- Durations: hover 0.35 to 0.5 s; text roll 0.7 s with a 40 ms stagger; hairline draw 0.9 s;
  image reveal 1.2 s; sheet slide 0.75 s each way.
- Page transition: the dark divider sheet slides down over the page carrying the destination's name
  in spaced mono (the company profile's divider pages), then slides on down and off the new page.
- No loader. One was built (the dark sheet lifting off the hero) and measured 5.3 s on a throttled
  phone; the first sight is the hero sheet itself instead: the rule passes once over the photograph
  and the title-block values rise into their cells.
- Hovers, one per role:
  - nav links: a hairline draws under the label (current page keeps it and nudges 4 px along it);
  - the logo: a hairline draws under the wordmark, from its first letter;
  - project images: the photograph settles 3% larger inside its frame and the caption rule draws;
  - index rows (categories, register, partners): the row slides 12 px along the rule and a preview
    photograph follows the pointer beside the row's label, never over it (desktop), or sits inline
    (touch);
  - the few calls to action: a dark fill slides up from the bottom edge and the label inverts;
  - arrows nudge 4 px along their direction.
- Idle: the hero sheet changes every 6.5 s with a progress hairline and a pause control. Every
  other page is still at rest by decision: a builder's portfolio should hold steady; its life is in
  the sheet changes, the transitions and the hovers.
- Reduced motion: no smooth scroll, no autoplay, no rolls; sheet changes and transitions become
  short fades; everything is visible.

## Composition plan

### Home
```
┌ header strip: [shield] KADJOE ........................ Projects  Design partners  About Us  Contact ┐
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│                           HERO PHOTOGRAPH (dashboard-chosen, focal point)                        │  poster
│                                                                                                  │
├────────────────────────────────┬──────────────┬────────────────┬────────┬────────────────────────┤
│ The balance of subtle luxe     │ Project      │ Location       │ Year   │ 02 / 05   ‖  →          │  title strip
│ and unmatched quality.  (h1)   │ Manzo        │ Kebayoran Baru │ 2025   │ ━━━━━━━──────            │
└────────────────────────────────┴──────────────┴────────────────┴────────┴────────────────────────┘

  [col 1-3 label: Since 2017]      [col 4-11: Kadjoe's one-sentence statement, t-l]      statement

  ┌───────────── 8 col landscape ──────────┐   ┌── 4 col portrait ──┐                 gallery wall
  └────────────────────────────────────────┘   │                    │
   Manzo | F&B | 2025                          └────────────────────┘
        ┌── 4 col portrait ──┐   ┌───────────── 7 col landscape ───────────┐
        ...                                                     All projects ->

  Residential .................................................. 42                     index list
  F&B .......................................................... 33     (hover preview)
  Commercial ................................................... 36

  Design partners                                   27                               list grid
  name   name   name   name      (random order on every request, no marquee)

┌ dark sheet footer: K A D J O E (mono, full width) / address / email / Instagram / © ┐   finale
```

### Projects
h1 + count, category filter (All, Residential, F&B, Commercial, with counts), view toggle
(Photographs / Register). Photographs: hung on the home page's six-photograph wall (the same slots,
shorter drops) on desktop, two columns on phones with the second hanging lower; captions are mini
title strips led by the sheet number. Register: a drawing register table (No., Project, Category,
Location, Year, Design) with a pointer preview; on phones a two-line row with a thumbnail.

### Project (case page)
h1 name; title block grid (Type, Location, Year, Service, Design, Photography, Build); hero
photograph; gallery hung by aspect ratio (landscape alone, alternating full and 9-column; portraits in
pairs 5+7 / 7+5); a lightbox; next project strip.

### Design partners
h1 + count; register of studios in random order (name, Instagram, projects built together with
links), pointer preview of a project photograph.

### About Us
h1; Kadjoe's statement; an image (there from the first paint: it is the phone's largest paint); three
services in Kadjoe's words; clients as a list of names.

### Contact
h1; the email set large; the Kalideres address with a map link; Instagram.

### 404
"Nothing was built here." in the title-block layout, with a way back to Projects.

### Company profile PDF (A4 landscape, react-pdf)
Cover (photograph + dark panel with the shield and the selection's title), contents, About Us,
services, then per category a dark divider sheet and one sheet per project (photo layout chosen from
orientation, title strip at the foot), clients, contact. No Team page.

## Genericness test

A generic model given "luxury interior design firm website" lands on: a centered serif headline over
a darkened hero, "Our services" in three cards, animated stats, a logo marquee, testimonials and
"Let's build your dream space". Changed here: the headline sits in a title strip on paper instead of
over the photo; no cards, counters, marquee or testimonials; every label is a real field; the only
sentences are Kadjoe's own.

## Decisions written down

- 404: Next 16.4 does not server-render `notFound()` inside a dynamic page (the shell is sent and the
  browser renders the 404, status stays 404). Unknown addresses therefore go to
  `src/app/global-not-found.tsx`, which is server-rendered; an unknown project slug uses the
  in-layout `not-found.tsx`.

- The site is still at rest outside the hero (quiet brief); see Motion language.
- Case pages carry facts, not essays: the owner asked for no unnecessary text, and the old site's
  generated descriptions were dropped. A project can still get a few lines in the dashboard
  (Description); the page shows them under the title block when present.
- Category counts are real (from the database), never rounded up.
- Mono is used only for title-block lettering, counters and the wordmark echo.
- Partner order is shuffled on the server for every request so no studio reads as ranked.
- Photographs are cut in steps of at most about 25% (160 to 2560 px, src/server/media/process.ts) and
  every `sizes` describes the width a photograph is drawn at, crop included (src/lib/sizes.ts), so a
  frame gets a file close to its size. Widths up to 1920 are encoded at quality 75 or more.
