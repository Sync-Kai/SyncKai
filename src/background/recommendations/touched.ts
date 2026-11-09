// Suggestions ajoutées ou écartées pendant qu'un lot se calcule : le calcul les retire avant d'écrire (feuille : importée
// par batch.ts et messages.ts). Mémoire du worker seulement : un calcul interrompu par sa fin ne reprend pas.

let building = false;
const touched = new Set<number>();

export const beginBuild = (): void => {
  building = true;
  touched.clear();
};
export const endBuild = (): void => {
  building = false;
  touched.clear();
};
export const noteTouched = (id: number): void => {
  if (building) touched.add(id);
};
export const forgetTouched = (id: number): void => {
  touched.delete(id);
};
export const touchedIds = (): ReadonlySet<number> => new Set(touched);
