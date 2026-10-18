// Fiches AniList des données de démo (demo-data.ts, demo-panel.ts) : module feuille, sans import, lu aussi par Node
// (anilist-covers.ts) pour demander leurs vraies jaquettes. Titre = celui de la fiche AniList (anglais), vérifié sur
// l'API le 2026-10-18.

export const DEMO_MEDIA = {
  21: 'ONE PIECE',
  108465: 'Mushoku Tensei: Jobless Reincarnation',
  127230: 'Chainsaw Man',
  127720: 'Mushoku Tensei: Jobless Reincarnation Cour 2',
  136430: 'Vinland Saga Season 2',
  137822: 'BLUE LOCK',
  146065: 'Mushoku Tensei: Jobless Reincarnation Season 2',
  150672: 'OSHI NO KO',
  153288: 'Kaiju No. 8',
  153518: 'Delicious in Dungeon',
  154587: 'Frieren: Beyond Journey’s End',
  163146: 'BLUE LOCK Season 2',
  166873: 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2',
  170068: 'Sousou no Frieren: ●● no Mahou',
  172019: 'Dr. STONE SCIENCE FUTURE',
  176496: 'Solo Leveling Season 2 -Arise from the Shadow-',
  177709: 'SAKAMOTO DAYS',
  177937: 'SPY x FAMILY Season 3',
  178754: 'Kaiju No. 8 Season 2',
  182255: 'Frieren: Beyond Journey’s End Season 2',
  185660: 'DAN DA DAN Season 2',
} as const satisfies Record<number, string>;

export type DemoMediaId = keyof typeof DEMO_MEDIA;

export function isDemoMediaId(id: number): id is DemoMediaId {
  return Object.hasOwn(DEMO_MEDIA, id);
}

export const DEMO_MEDIA_IDS: readonly DemoMediaId[] = Object.keys(DEMO_MEDIA).map(Number).filter(isDemoMediaId);

/** Images réelles d'une fiche (URL https de s4.anilist.co) ; null = absente, la jaquette de remplacement prend le relais */
export interface DemoCover {
  cover: string | null;
  banner: string | null;
  /** Couleur dominante de la jaquette (#rrggbb), dégradé derrière la bannière */
  color: string | null;
}

/** Jaquettes réelles par id AniList (clé = id en texte, valeur injectée dans les pages par le serveur du harnais) */
export type DemoCovers = Record<string, DemoCover>;
