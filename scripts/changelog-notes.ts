/**
 * Extrait les notes de version d'une entrée du CHANGELOG.md (format Keep a Changelog).
 * Affiche le corps de la section `## [<version>]`, suivi du lien de comparaison avec la version précédente.
 *
 * Usage : node scripts/changelog-notes.ts <version>   (ex. 1.7.2, sans le « v »)
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_URL = 'https://github.com/Sync-Kai/SyncKai';

export interface ReleaseNotes {
  /** Corps de la section, sans le titre, sans espaces superflus. */
  body: string;
  /** Version de la section suivante (plus ancienne), ou null s'il n'y en a pas. */
  previousVersion: string | null;
}

/** Titre de section versionnée : `## [1.7.2] - 2026-10-01` → `1.7.2`. `[Unreleased]` est ignoré. */
const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/;
/** Toute section de niveau 2 termine la précédente. */
const ANY_HEADING = /^## /;
/** Définitions de liens en fin de fichier : `[1.7.2]: https://…`. */
const LINK_REFERENCE = /^\[[^\]]+\]:\s/;

/**
 * Analyse le contenu du changelog et renvoie les notes de `version`.
 * Lève une erreur si la section est absente ou vide.
 */
export function extractReleaseNotes(changelog: string, version: string): ReleaseNotes {
  const lines = changelog.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) => VERSION_HEADING.exec(line)?.[1] === version);
  if (start === -1) {
    throw new Error(`Section "## [${version}]" not found in CHANGELOG.md.`);
  }

  const bodyLines: string[] = [];
  let previousVersion: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (ANY_HEADING.test(line)) {
      previousVersion = VERSION_HEADING.exec(line)?.[1] ?? null;
      break;
    }
    // La dernière section est suivie des définitions de liens : elles ne font pas partie des notes
    if (LINK_REFERENCE.test(line)) break;
    bodyLines.push(line);
  }

  const body = bodyLines.join('\n').trim();
  if (body === '') {
    throw new Error(`Section "## [${version}]" is empty in CHANGELOG.md.`);
  }
  return { body, previousVersion };
}

/** Notes prêtes pour une release GitHub : corps + lien « Full changelog ». */
export function formatReleaseNotes(notes: ReleaseNotes, version: string): string {
  if (notes.previousVersion === null) return `${notes.body}\n`;
  const compare = `${REPO_URL}/compare/v${notes.previousVersion}...v${version}`;
  return `${notes.body}\n\n**Full changelog**: ${compare}\n`;
}

function main(): void {
  const version = process.argv[2]?.replace(/^v/, '');
  if (!version) {
    console.error('✖ Usage: node scripts/changelog-notes.ts <version>');
    process.exit(1);
  }

  const root = fileURLToPath(new URL('..', import.meta.url));
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  try {
    process.stdout.write(formatReleaseNotes(extractReleaseNotes(changelog, version), version));
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Exécuté seulement en ligne de commande (pas lors de l'import par les tests)
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
