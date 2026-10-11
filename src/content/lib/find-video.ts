/**
 * <video> du lecteur : celle du sélecteur propre à la plateforme, sinon la <video> la plus longue de la page.
 * Le repli évite de retenir une bande-annonce ou un aperçu placé avant le lecteur dans le DOM ; s'il se trompe
 * au démarrage (durées encore inconnues), la session se rattache au bon lecteur à son premier événement média.
 */
export function findPlayerVideo(playerSelector: string): HTMLVideoElement | null {
  const player = document.querySelector<HTMLVideoElement>(playerSelector);
  if (player) return player;
  let best: HTMLVideoElement | null = null;
  for (const video of document.querySelectorAll<HTMLVideoElement>('video')) {
    if (!best || knownDuration(video) > knownDuration(best)) best = video;
  }
  return best;
}

/** Durée en secondes, 0 tant que les métadonnées ne sont pas chargées */
function knownDuration(video: HTMLVideoElement): number {
  return Number.isFinite(video.duration) ? video.duration : 0;
}
