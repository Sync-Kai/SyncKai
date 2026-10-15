// Fonction injectée dans l'onglet Netflix par chrome.scripting.executeScript (page d'import de l'historique). Fichier SANS import :
// le navigateur n'en sérialise que le texte, tout identifiant extérieur à la fonction serait introuvable dans l'onglet
// (vérifié par tab-op.test.ts). Lecture de l'onglet et réduction des lignes : history.ts.

export type NetflixTabOp = 'state' | 'click' | 'rows' | 'show';

/**
 * Exécutée DANS l'onglet Netflix par chrome.scripting.executeScript (monde isolé de l'extension, celui du script de
 * contenu ; jamais le monde de la page) : AUTONOME, le navigateur n'en transmet que le texte (aucune référence à un import
 * ni à une constante de ce module). Hypothèses sur le DOM relevées le 2026-10-12 (profil français) : lignes
 * `li.retableRow`, lien du titre `a[href="/title/{id}"]`, bouton « Voir plus » (« Show more », « Mehr anzeigen ») hors des
 * lignes. Ne clique JAMAIS sur autre chose que ce bouton (ni « Masquer dans l'historique », ni « Signaler un problème »).
 * Libellé du bouton dans la langue du PROFIL Netflix (pas celle de SyncKai) : FR / EN / DE relevés sur le site, les autres
 * d'après l'article d'aide officiel de Netflix (help.netflix.com/<langue>/node/101917) ; langue absente (chinois
 * simplifié, coréen : libellé non vérifié) → bouton jamais trouvé, seules les premières lignes sont lues.
 * - state : chemin, lignes affichées, bouton présent, choix du profil affiché, liste présente ;
 * - click : un clic sur « Voir plus » (true s'il existait) ;
 * - rows  : { href, text } du lien de chaque ligne ;
 * - show  : métadonnées réduites de la série de `movieId`, AVEC les points de lecture, demandées par le script de contenu
 *           Netflix (fonction exposée sous Symbol.for(`hook`)) au pont du monde MAIN ; 'absent' sans script de contenu.
 */
export function netflixTabOp(op: NetflixTabOp, hook: string, movieId: string): unknown {
  const row = 'li.retableRow';
  // « Voir plus » en minuscules (NFC) : FR / EN / DE (site), puis it, es / es-419, pt-BR, nl, sv, pl, cs, ro, ru, uk, tr,
  // id, vi, ja, zh-TW, zh-CN, ko (help.netflix.com/<langue>/node/101917)
  const labels = [
    'voir plus',
    'afficher plus',
    'show more',
    'see more',
    'load more',
    'mehr anzeigen',
    'weitere anzeigen',
    'mehr laden',
    'mostra altri',
    'mostrar más',
    'mostrar mais',
    'meer weergeven',
    'visa mer',
    'pokaż więcej',
    'zobrazit více',
    'mai multe',
    'показать еще',
    'показать ещё',
    'показати більше',
    'daha fazla göster',
    'tampilkan lainnya',
    'hiển thị thêm',
    'その他を表示',
    '顯示更多',
    '显示更多',
    '더 보기',
  ].map((label) => label.normalize('NFC'));
  const text = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();
  const more = (): HTMLButtonElement | undefined =>
    [...document.querySelectorAll('button')].find(
      (button) => !button.disabled && !button.closest(row) && labels.includes(text(button.textContent).normalize('NFC').toLowerCase()),
    );
  if (op === 'state') {
    return {
      path: location.pathname,
      rows: document.querySelectorAll(row).length,
      more: more() !== undefined,
      gate: document.querySelector('.profile-gate-container, .list-profiles') !== null,
      list: document.querySelector('.retable') !== null,
    };
  }
  if (op === 'click') {
    const button = more();
    button?.click();
    return button !== undefined;
  }
  if (op === 'rows') {
    return [...document.querySelectorAll(row)].map((item) => {
      const link = item.querySelector('a[href*="/title/"]');
      return { href: link?.getAttribute('href') ?? '', text: text(link?.textContent).slice(0, 300) };
    });
  }
  const load: unknown = Reflect.get(globalThis, Symbol.for(hook));
  return typeof load === 'function' ? (Reflect.apply(load, undefined, [movieId]) as unknown) : 'absent';
}
