// Pilotage du détecteur de débordements (layout-probe.ts) depuis Node : chargement dans une page du harnais, relevé,
// capture annotée. Utilisé par layout-probe.e2e.ts (page témoin) et i18n-layout.e2e.ts (toutes les langues).
import type { Page } from 'puppeteer';
import type { LayoutIssue } from './layout-probe';
import type { CatalogEntries } from './layout-text';

/**
 * Charge le détecteur dans la page (module servi et transpilé par le serveur Vite du harnais) et lui donne le
 * catalogue de la langue affichée et les données de démo
 */
export async function attachProbe(page: Page, catalog: CatalogEntries, data: readonly string[]): Promise<void> {
  if (!(await page.evaluate(() => window.__skLayout !== undefined))) {
    await page.addScriptTag({ type: 'module', content: "import { install } from '/scripts/e2e/layout-probe.ts'; install();" });
    await page.waitForFunction(() => window.__skLayout !== undefined);
  }
  await page.evaluate((entries: CatalogEntries, strings: readonly string[]) => window.__skLayout?.configure({ catalog: entries, data: strings }), catalog, data);
}

/** Rendu stable : polices chargées, images décodées, deux images d'animation (dernières mises en page appliquées) */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

/** Relevé de la page, ou de la zone `scope` seulement (sélecteur CSS) */
export async function scanLayout(page: Page, scope?: string): Promise<LayoutIssue[]> {
  await settle(page);
  const issues = await page.evaluate((zone: string | null) => window.__skLayout?.scan(zone ?? undefined), scope ?? null);
  if (!issues) throw new Error('Détecteur de mise en page absent (attachProbe non appelé ?)');
  return issues;
}

/**
 * Capture PNG de tout le contenu (zones défilantes dépliées, largeurs inchangées), anomalies `ids` du dernier relevé
 * encadrées et numérotées ; la page revient ensuite à son état
 */
export async function captureLayout(page: Page, file: string, ids: readonly number[]): Promise<void> {
  await page.evaluate((highlighted: readonly number[]) => {
    window.__skLayout?.expand(true);
    window.__skLayout?.highlight(highlighted);
  }, ids);
  try {
    await settle(page);
    await page.screenshot({ path: file as `${string}.png`, fullPage: true });
  } finally {
    await page.evaluate(() => window.__skLayout?.expand(false));
  }
}
