// Sections du popup affichées par le rail (popup-app.tsx) : « En cours », « Activité », « Pour toi », Agenda et Stats. L'ancien en-tête (« SyncKai
// シンカイ », boutons) et les onglets du haut ont laissé place au rail de navigation (ui/components/nav-rail.tsx).
import type { Screen } from '../state';

export type PopupTab = Exclude<Screen, 'settings'>;
