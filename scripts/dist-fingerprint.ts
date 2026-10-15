/**
 * Empreinte des paquets construits (`dist/` et `dist-firefox/`), pour prouver qu'un déplacement de fichiers sources
 * ne change pas le code livré. À lancer après `npm run build` et `npm run build:firefox`.
 *
 * Normalisation, la seule tolérance (le code exécutable, lui, doit rester identique à l'octet près) :
 * - les noms de chunks `assets/<nom>-<hash>.js|css|woff|woff2` portent le nom du module source et un hash de contenu
 *   qui dépend des noms des chunks importés : chaque nom de ce type (dans les noms de fichiers comme dans les
 *   références) est remplacé par `CHUNK` ; les fichiers sont donc comparés par contenu normalisé, sans leur nom ;
 * - l'horodatage du build (`__SYNCKAI_BUILD__`, date ISO avec millisecondes) est remplacé par `STAMP`
 *   (sans cela, une empreinte exigerait `SOURCE_DATE_EPOCH` fixe) ;
 * - les fichiers binaires (polices, icônes) sont hachés tels quels.
 * Les fichiers qui ne sont pas des chunks gardent leur chemin (manifest.json, pages HTML, _locales/…, assets/locales/…,
 * assets/background.js) : un fichier ajouté, supprimé ou renommé est signalé.
 *
 * Usage : node scripts/dist-fingerprint.ts                    (affiche l'empreinte de chaque cible)
 *         node scripts/dist-fingerprint.ts --write <fichier>   (enregistre l'empreinte détaillée en JSON)
 *         node scripts/dist-fingerprint.ts --compare <fichier> (compare à une empreinte enregistrée ; code 1 si différente)
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { BUILD_TARGETS, targetOutDir, type BuildTarget } from '../src/build/manifest-target.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Nom de chunk émis par Rolldown : `<module>-<hash de 8 caractères>.<extension>` */
const CHUNK_NAME = /[\w.-]+?-[A-Za-z0-9_-]{8}(\.(?:js|css|woff2?))\b/g;
const BUILD_STAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
const TEXT_FILE = /\.(?:js|css|html|json|svg|txt)$/;

export interface FingerprintEntry {
  /** Chemin dans le paquet ; `CHUNK<ext>` pour un chunk (le nom varie avec les modules et leurs hashs) */
  path: string;
  sha: string;
  size: number;
}

export interface TargetFingerprint {
  target: BuildTarget;
  entries: FingerprintEntry[];
  /** Hash de la liste triée des entrées : une seule valeur à comparer */
  digest: string;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');

/** Contenu d'un fichier texte débarrassé de ce qui varie sans changer le code (voir l'en-tête) */
export function normalizeText(content: string): string {
  return content.replace(CHUNK_NAME, 'CHUNK$1').replace(BUILD_STAMP, 'STAMP');
}

export function fingerprintTarget(target: BuildTarget): TargetFingerprint {
  const dist = join(ROOT, targetOutDir(target));
  const entries = listFiles(dist).map((file): FingerprintEntry => {
    const rel = relative(dist, file).split(sep).join('/');
    const raw = readFileSync(file);
    const path = normalizeText(rel);
    if (!TEXT_FILE.test(rel)) return { path, sha: sha256(raw), size: raw.length };
    const text = normalizeText(raw.toString('utf8'));
    return { path, sha: sha256(text), size: Buffer.byteLength(text) };
  });
  entries.sort((a, b) => (a.path + a.sha).localeCompare(b.path + b.sha));
  return { target, entries, digest: sha256(entries.map((entry) => `${entry.path}\0${entry.sha}`).join('\n')) };
}

/** Écarts entre deux empreintes d'une même cible, une ligne par entrée absente d'un côté */
export function diffFingerprints(before: TargetFingerprint, after: TargetFingerprint): string[] {
  const key = (entry: FingerprintEntry): string => `${entry.path} ${entry.sha.slice(0, 12)} ${entry.size} o`;
  const count = (entries: readonly FingerprintEntry[]): Map<string, number> =>
    entries.reduce((map, entry) => map.set(key(entry), (map.get(key(entry)) ?? 0) + 1), new Map<string, number>());
  const a = count(before.entries);
  const b = count(after.entries);
  const lines: string[] = [];
  for (const [entry, n] of a) if ((b.get(entry) ?? 0) < n) lines.push(`- ${entry}`);
  for (const [entry, n] of b) if ((a.get(entry) ?? 0) < n) lines.push(`+ ${entry}`);
  return lines;
}

function main(): number {
  const { values } = parseArgs({ options: { write: { type: 'string' }, compare: { type: 'string' } }, strict: true });
  const current = BUILD_TARGETS.map(fingerprintTarget);
  for (const fp of current) console.log(`${fp.target}: ${fp.entries.length} fichiers, empreinte ${fp.digest.slice(0, 16)}`);
  if (values.write !== undefined) writeFileSync(values.write, `${JSON.stringify(current, null, 1)}\n`);
  if (values.compare === undefined) return 0;
  const saved = JSON.parse(readFileSync(values.compare, 'utf8')) as TargetFingerprint[];
  let different = false;
  for (const fp of current) {
    const before = saved.find((candidate) => candidate.target === fp.target);
    const lines = before === undefined ? ['(cible absente de l’empreinte enregistrée)'] : before.digest === fp.digest ? [] : diffFingerprints(before, fp);
    if (lines.length > 0) different = true;
    console.log(lines.length === 0 ? `✔ ${fp.target} : identique` : `✖ ${fp.target} : différent\n${lines.map((line) => `  ${line}`).join('\n')}`);
  }
  return different ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
