// Traductions complètes : pages de l'extension et service worker. Les scripts de contenu passent par `./content`,
// qui n'embarque que leurs clés (PERF-01).
import { registerCatalogs } from './core';
import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

registerCatalogs({ en, fr, de });

export * from './core';
