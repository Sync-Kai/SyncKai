// Actions à lancer après le prochain rendu Preact (focus, défilement vers un élément qui n'existe qu'ensuite) : vidées
// par l'écran « En cours » à la fin de son rendu (useLayoutEffect, même microtâche que le changement de store), sinon
// à la tâche suivante quand aucun rendu n'a lieu.

const pending: (() => void)[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** Lance les actions en attente, dans l'ordre */
export function flushAfterRender(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  for (const run of pending.splice(0)) run();
}

export function afterRender(run: () => void): void {
  pending.push(run);
  timer ??= setTimeout(flushAfterRender, 0);
}
