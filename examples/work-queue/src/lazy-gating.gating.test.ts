/**
 * Browser-level test for Phase 2 progressive asset streaming on the
 * client-nav code path.
 *
 * The example server is started with STEWIE_CSS_DELAY=400 so each CSS
 * response is held for 400ms — making the lazy() CSS-load gate observable
 * in real browser timing.
 *
 * SSR-side manifest emission and headHtml asset injection are covered as
 * unit tests in packages/server/src/stream.test.ts where the Vite manifest
 * is supplied directly. A Playwright equivalent isn't practical here: the
 * example's auth singleton lives in client memory, so a hard navigation to
 * /admin always redirects to /login on the unauth'd server.
 *
 * The client-nav case below is genuinely browser-only — it depends on the
 * dynamic <link> injection and load/error gating that lives in lazy().
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { GATING_TEST_URL, GATING_CSS_DELAY_MS } from '../vitest.gating.config.js';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

beforeEach(async () => {
  page = await browser.newPage();
});

describe('Client-nav CSS gating for lazy boundaries', () => {
  it('client-nav to /admin holds the boundary closed until CSS loads', async () => {
    // Authenticate. The login action runs client-side and mutates the
    // in-memory auth singleton in this page's JS context. Doing a hard
    // reload after this would reset it — so all subsequent navigations
    // must go through the router (Link clicks), not page.goto.
    await page.goto(`${GATING_TEST_URL}/login`);
    await page.getByTestId('username-input').fill('alice');
    await page.getByTestId('password-input').fill('pw');
    await page.getByTestId('login-submit').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
    await page.getByTestId('stats-grid').waitFor({ state: 'visible' });

    // Click the Admin nav link — this routes through router.navigate(),
    // which is the lazy() client-nav code path. The boundary's CSS chunk
    // is not yet on this page, so lazy() injects a fresh <link> and gates
    // the boundary's content on its load event.
    const t0 = Date.now();
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByTestId('admin-page').waitFor({ state: 'visible' });
    const elapsed = Date.now() - t0;

    // The CSS response is held for GATING_CSS_DELAY_MS by the server's
    // delay middleware. If gating is broken (the boundary flips before
    // CSS lands), the page would render in well under that window. Allow
    // a small margin below the configured delay so jitter doesn't cause
    // false positives.
    expect(elapsed).toBeGreaterThanOrEqual(GATING_CSS_DELAY_MS - 100);
  });
});
