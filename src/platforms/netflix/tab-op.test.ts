import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import tabOpSource from './tab-op.ts?raw';
import { netflixTabOp } from './tab-op';
import { NETFLIX_VIEWED_ROWS, netflixViewedPageHtml } from '../../shared/__fixtures__/netflix-history';

describe('netflixTabOp (fichier autonome)', () => {
  it('ne contient aucun import ni export de module externe : seule la fonction est sérialisée vers l’onglet', () => {
    const code = tabOpSource.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
    expect(code).not.toMatch(/^\s*import\b/m);
    expect(code).not.toMatch(/\bimport\(/);
    expect(code).not.toMatch(/\brequire\(/);
  });
});

// ─── Fonction injectée dans l'onglet (faux DOM) ───────────────────────────

interface FakeButton {
  textContent: string;
  disabled: boolean;
  inRow: boolean;
  clicks: number;
  closest(selector: string): object | null;
  click(): void;
}

function fakeNetflixPage(path = '/viewingactivity', more = '  Voir plus '): { buttons: FakeButton[]; rows: { href: string; text: string }[] } {
  const rows = [
    { href: '/title/81301838', text: 'Ranma ½ : Saison 1 : "Épisode 5"' },
    { href: '/title/60023642', text: 'Le Voyage de Chihiro' },
  ];
  const button = (textContent: string, inRow = false): FakeButton => {
    const b: FakeButton = { textContent, disabled: false, inRow, clicks: 0, closest: (selector) => (b.inRow && selector.includes('li.retableRow') ? {} : null), click: () => void b.clicks++ };
    return b;
  };
  const buttons = [button('Masquer dans l’historique', true), button('Signaler un problème', true), button('Masquer tout'), button(more)];
  vi.stubGlobal('location', { pathname: path });
  vi.stubGlobal('document', {
    querySelectorAll: (selector: string) =>
      selector === 'button'
        ? buttons
        : selector.includes('li.retableRow')
          ? rows.map((row) => ({ querySelector: () => ({ getAttribute: () => row.href, textContent: row.text }) }))
          : [],
    // Ancienne page : ni conteneur ni bouton data-uia de /settings/viewed
    querySelector: (selector: string) => (selector.includes('.retable') ? {} : null),
  });
  return { buttons, rows };
}

describe('netflixTabOp (exécutée dans l’onglet Netflix)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, Symbol.for('synckai.test.hook'));
  });

  it('état de la page, puis un clic sur « Voir plus » et sur RIEN d’autre', () => {
    const page = fakeNetflixPage();
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toEqual({ path: '/viewingactivity', rows: 2, more: true, gate: false, list: true });
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(true);
    expect(page.buttons.map((b) => [b.textContent.trim(), b.clicks])).toEqual([
      ['Masquer dans l’historique', 0],
      ['Signaler un problème', 0],
      ['Masquer tout', 0],
      ['Voir plus', 1],
    ]);
  });

  it('« Voir plus » dans la langue du profil Netflix (libellés de l’aide Netflix), casse et normalisation ignorées', () => {
    const labels = [
      'Show more',
      'Mehr anzeigen',
      'Mostra altri',
      'Mostrar más',
      'Mostrar mais',
      'Meer weergeven',
      'Visa mer',
      'Pokaż więcej',
      'Zobrazit více',
      'Mai multe',
      'Показать еще',
      'Показать ещё',
      'Показати більше',
      'Daha Fazla Göster',
      'Tampilkan lainnya',
      'Hiển thị thêm',
      // Vietnamien décomposé (NFD) : comparé après normalisation
      'Hiển thị thêm'.normalize('NFD'),
      'その他を表示',
      '顯示更多',
      '显示更多',
      '더 보기',
    ];
    for (const label of labels) {
      const page = fakeNetflixPage('/viewingactivity', label);
      expect(netflixTabOp('state', 'synckai.test.hook', ''), label).toMatchObject({ more: true });
      expect(netflixTabOp('click', 'synckai.test.hook', ''), label).toBe(true);
      expect(page.buttons.map((b) => b.clicks), label).toEqual([0, 0, 0, 1]);
    }
  });

  it('libellé inconnu (langue de profil non vérifiée) : bouton jamais cliqué', () => {
    // Thaï : langue de profil dont le libellé n'est pas vérifié
    const page = fakeNetflixPage('/viewingactivity', 'ดูเพิ่มเติม');
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toMatchObject({ more: false });
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(false);
    expect(page.buttons.every((b) => b.clicks === 0)).toBe(true);
  });

  it('bouton absent ou désactivé : aucun clic', () => {
    const page = fakeNetflixPage();
    const more = page.buttons[3];
    if (more) more.disabled = true;
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toMatchObject({ more: false });
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(false);
    expect(page.buttons.every((b) => b.clicks === 0)).toBe(true);
  });

  it('lignes : lien et texte ; métadonnées demandées au script de contenu, « absent » sans lui', async () => {
    fakeNetflixPage();
    expect(netflixTabOp('rows', 'synckai.test.hook', '')).toEqual([
      { href: '/title/81301838', text: 'Ranma ½ : Saison 1 : "Épisode 5"' },
      { href: '/title/60023642', text: 'Le Voyage de Chihiro' },
    ]);
    expect(netflixTabOp('show', 'synckai.test.hook', '81301838')).toBe('absent');
    Reflect.set(globalThis, Symbol.for('synckai.test.hook'), (id: string) => Promise.resolve({ asked: id }));
    await expect(netflixTabOp('show', 'synckai.test.hook', '81301838')).resolves.toEqual({ asked: '81301838' });
  });
});

// ─── Nouvelle page /settings/viewed (relevée le 2026-11-13), vrai DOM (happy-dom) ───

describe('netflixTabOp sur la page /settings/viewed', () => {
  let page: Window | null = null;

  /** Page chargée dans l'onglet ; chaque clic sur un bouton est compté par son data-uia (ou son texte) */
  function viewedPage(more: string | null = 'Voir plus'): string[] {
    page = new Window({ url: 'https://www.netflix.com/settings/viewed' });
    page.document.body.innerHTML = netflixViewedPageHtml(more);
    const clicked: string[] = [];
    for (const button of page.document.querySelectorAll('button')) {
      button.addEventListener('click', () => clicked.push(button.getAttribute('data-uia') ?? button.textContent));
    }
    vi.stubGlobal('document', page.document);
    vi.stubGlobal('location', page.location);
    return clicked;
  }

  afterEach(async () => {
    vi.unstubAllGlobals();
    await page?.happyDOM.close();
    page = null;
  });

  it('état : 6 lignes, « Voir plus » présent, liste présente', () => {
    viewedPage();
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toEqual({ path: '/settings/viewed', rows: 6, more: true, gate: false, list: true });
  });

  it('lignes : { href, text } du lien du titre (href absolu)', () => {
    viewedPage();
    expect(netflixTabOp('rows', 'synckai.test.hook', '')).toEqual(NETFLIX_VIEWED_ROWS);
  });

  it('clic : « Voir plus » seulement, jamais « Signaler un problème », « Masquer » ni les onglets', () => {
    const clicked = viewedPage();
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(true);
    expect(clicked).toEqual(['viewing-activity-page+show-more-btn']);
  });

  it('bouton trouvé par son data-uia quel que soit son libellé (langue de profil non vérifiée)', () => {
    const clicked = viewedPage('ดูเพิ่มเติม');
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toMatchObject({ more: true });
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(true);
    expect(clicked).toEqual(['viewing-activity-page+show-more-btn']);
  });

  it('fin de l’historique (bouton absent) : aucun clic', () => {
    const clicked = viewedPage(null);
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toMatchObject({ rows: 6, more: false, list: true });
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(false);
    expect(clicked).toEqual([]);
  });
});
