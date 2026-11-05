// End to end, in a real browser against a running production build; skipped unless E2E_BASE_URL is set:
//
//   npm run build && KADJOE_SITE_DATA_DIR=<data> npx next start -p 4400
//   E2E_BASE_URL=http://127.0.0.1:4400 npx vitest run tests/history.e2e.test.ts
//
// E2E_CHROMIUM points at a Chromium binary when Playwright's own download is not installed.
//
// Back and Forward must leave every page fully drawn. Text and photographs that wait for a reveal
// (data-split, data-reveal) are hidden by CSS until the page code runs, so a history step that skips
// the page code leaves a blank page. Filters change the query string on the same page and must not
// redraw it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';

const BASE = process.env.E2E_BASE_URL?.replace(/\/$/, '');

describe.skipIf(!BASE)('history steps (e2e)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM || undefined });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  });
  afterAll(async () => { await browser?.close(); });

  /** Waits until `path` is on screen with its h1 drawn, then lists whatever still waits for a reveal. */
  async function settle(path: string) {
    await page.waitForFunction((p) => location.pathname === p, path, { timeout: 10_000 });
    await page.waitForFunction(() => {
      const h1 = document.querySelector('main h1');
      const curtain = document.getElementById('curtain');
      return !!h1 && getComputedStyle(h1).visibility === 'visible' && (!curtain || getComputedStyle(curtain).visibility === 'hidden');
    }, null, { timeout: 8_000 }).catch(() => {}); // a page that never draws is reported below
    return page.evaluate(() => {
      const h1 = document.querySelector('main h1');
      const hidden = [...document.querySelectorAll<HTMLElement>('[data-split], [data-reveal]')]
        .filter((el) => getComputedStyle(el).visibility === 'hidden')
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
      return { h1: h1 ? getComputedStyle(h1).visibility : 'missing', hidden };
    });
  }

  const nav = async (label: string, path: string) => {
    await page.locator('header nav a', { hasText: label }).first().click();
    return settle(path);
  };

  it('redraws every page on Back and Forward', async () => {
    await page.goto(`${BASE}/`);
    await settle('/');
    await nav('Projects', '/projects');
    const card = page.locator('.pgrid a').first();
    const casePath = new URL((await card.getAttribute('href'))!, BASE).pathname;
    await card.click();
    await settle(casePath);
    await nav('Design partners', '/partners');
    await nav('About Us', '/about');
    await nav('Contact', '/contact');

    const trail = ['/', '/projects', casePath, '/partners', '/about', '/contact'];
    for (const path of trail.slice(0, -1).reverse()) {
      await page.goBack();
      expect({ path, ...(await settle(path)) }).toEqual({ path, h1: 'visible', hidden: [] });
    }
    for (const path of trail.slice(1)) {
      await page.goForward();
      expect({ path, ...(await settle(path)) }).toEqual({ path, h1: 'visible', hidden: [] });
    }
  }, 120_000);

  it('keeps the projects page in place when a filter changes the query', async () => {
    await page.goto(`${BASE}/projects`);
    await settle('/projects');
    // Marks this page: a redraw (new page code) would replace the split title and drop the mark.
    await page.evaluate(() => { document.querySelector('main h1')!.setAttribute('data-kept', ''); });
    await page.locator('.filters .chip', { hasText: 'F&B' }).click();
    await page.waitForFunction(() => location.search === '?category=fnb');
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.querySelector('main h1')?.hasAttribute('data-kept'))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('main h1')!).visibility)).toBe('visible');
  }, 60_000);
});
