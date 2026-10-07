/**
 * Empaquette le build en archive prête pour les stores, ou les sources pour la relecture AMO.
 * - Chrome (défaut) : dist/ → release/synckai-<version>-chrome.zip (Chrome Web Store, champ `key` retiré).
 * - Firefox : dist-firefox/ → release/synckai-<version>-firefox.zip (AMO, gecko id et background.scripts vérifiés).
 * - Sources : `git archive` de HEAD → release/synckai-<version>-source.zip (avec BUILD.md et .source-date-epoch).
 * Écrivain ZIP minimal (deflate via node:zlib), sans dépendance externe.
 *
 * Usage : npm run package | npm run package:firefox | npm run package:source | npm run package:all (les trois)
 *         node scripts/package.ts [--target chrome|firefox] [--source]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { crc32, deflateRawSync } from 'node:zlib';
import { FIREFOX_GECKO_ID, parseBuildTarget, targetOutDir, type BuildTarget } from '../src/build/manifest-target.ts';

interface PackageJson {
  version: string;
}

interface Manifest {
  version: string;
  key?: string;
  background?: { service_worker?: string; scripts?: string[] };
  browser_specific_settings?: { gecko?: { id?: string } };
  [field: string]: unknown;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RELEASE = join(ROOT, 'release');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const REQUIRED_LOCALES = ['en', 'fr', 'de'] as const;

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

// ─── Écrivain ZIP (PKZIP 2.0, deflate, sans zip64) ────────────────────────

/** Date/heure DOS fixe (1980-01-01 00:00) → archive reproductible. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

function createZip(entries: readonly ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    // Stocke sans compression si deflate n'apporte rien
    const useDeflate = compressed.length < data.length;
    const payload = useDeflate ? compressed : Buffer.from(data);
    const method = useDeflate ? 8 : 0;
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flag UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    // extra, comment, disk, attributs internes/externes : 0
    central.writeUInt32LE(offset, 42);

    localParts.push(local, nameBytes, payload);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + payload.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

// ─── Validation & empaquetage ─────────────────────────────────────────────

/** Sortie de git, null en cas d'échec */
function gitOrNull(args: readonly string[]): string | null {
  try {
    return execFileSync('git', [...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function git(args: readonly string[]): string {
  return gitOrNull(args) ?? fail(`git ${args.join(' ')} a échoué.`);
}

/** Archive des sources (relecture AMO) : HEAD tel que commité, plus la date du commit pour un build reproductible */
function packageSource(version: string): void {
  if (gitOrNull(['cat-file', '-e', 'HEAD:BUILD.md']) === null) {
    fail('BUILD.md absent de HEAD : commitez-le avant de créer l’archive des sources.');
  }
  if (git(['status', '--porcelain', '--untracked-files=no']) !== '') {
    console.warn('⚠ Modifications non commitées : elles ne sont pas dans l’archive (seul HEAD est archivé).');
  }
  // Lu par vite.config.ts quand l'archive est construite hors dépôt git (même __SYNCKAI_BUILD__ que le paquet)
  const epoch = git(['log', '-1', '--format=%ct', 'HEAD']);
  mkdirSync(RELEASE, { recursive: true });
  const zipPath = join(RELEASE, `synckai-${version}-source.zip`);
  git(['archive', '--format=zip', `--add-virtual-file=.source-date-epoch:${epoch}`, '-o', zipPath, 'HEAD']);
  console.log(`✔ ${relative(ROOT, zipPath)}`);
  console.log(`  ${git(['rev-parse', '--short', 'HEAD'])} · ${(statSync(zipPath).size / 1024).toFixed(1)} Ko · SOURCE_DATE_EPOCH ${epoch}`);
}

/** Vérifications du manifest propres au store visé ; retourne le manifest à écrire dans l'archive */
function storeManifest(manifest: Manifest, target: BuildTarget): Manifest {
  if (target === 'chrome') {
    // Le Web Store refuse un manifest contenant `key` (l'ID est attribué par le store)
    const { key: _key, ...chromeManifest } = manifest;
    return chromeManifest;
  }
  if ('key' in manifest) fail('Champ `key` présent dans le manifest Firefox.');
  if (manifest.browser_specific_settings?.gecko?.id !== FIREFOX_GECKO_ID) fail(`browser_specific_settings.gecko.id ≠ ${FIREFOX_GECKO_ID}.`);
  if (!manifest.background?.scripts?.length || manifest.background.service_worker !== undefined) {
    fail('Firefox attend background.scripts (sans service_worker).');
  }
  return manifest;
}

function packageBuild(version: string, target: BuildTarget): void {
  const outDir = targetOutDir(target);
  const dist = join(ROOT, outDir);
  let manifest: Manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')) as Manifest;
  } catch {
    fail(`${outDir}/manifest.json introuvable : lancez \`npm run ${target === 'firefox' ? 'build:firefox' : 'build'}\`.`);
  }

  if (manifest.version !== version) {
    fail(`Version du manifest (${manifest.version}) ≠ package.json (${version}).`);
  }

  for (const locale of REQUIRED_LOCALES) {
    try {
      statSync(join(dist, '_locales', locale, 'messages.json'));
    } catch {
      fail(`_locales/${locale}/messages.json manquant dans ${outDir}/.`);
    }
  }

  const packed = storeManifest(manifest, target);
  const entries: ZipEntry[] = [];
  for (const file of listFiles(dist).sort()) {
    const name = relative(dist, file).split(sep).join('/');
    if (name.endsWith('.map')) fail(`Source map interdite dans le paquet : ${name}`);
    if (statSync(file).size > MAX_FILE_BYTES) fail(`Fichier > 10 Mo : ${name}`);
    entries.push({
      name,
      data: name === 'manifest.json' ? Buffer.from(`${JSON.stringify(packed, null, 2)}\n`, 'utf8') : readFileSync(file),
    });
  }

  const packedManifest = entries.find((entry) => entry.name === 'manifest.json');
  if (packedManifest && 'key' in (JSON.parse(Buffer.from(packedManifest.data).toString('utf8')) as Manifest)) {
    fail('Le champ `key` est toujours présent dans le manifest empaqueté.');
  }

  const zip = createZip(entries);
  mkdirSync(RELEASE, { recursive: true });
  // Noms attendus par .github/workflows/release.yml
  const zipPath = join(RELEASE, `synckai-${version}-${target}.zip`);
  writeFileSync(zipPath, zip);

  console.log(`✔ ${relative(ROOT, zipPath)}`);
  console.log(`  ${entries.length} fichiers · ${(zip.length / 1024).toFixed(1)} Ko`);
  console.log(
    target === 'chrome'
      ? `  manifest : version ${manifest.version}, key ${manifest.key ? 'retirée' : 'absente'}`
      : `  manifest : version ${manifest.version}, gecko ${FIREFOX_GECKO_ID}`,
  );
}

const { values: args } = parseArgs({
  options: { target: { type: 'string' }, source: { type: 'boolean', default: false } },
  strict: true,
});
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as PackageJson;

if (args.source) {
  packageSource(pkg.version);
} else {
  let target: BuildTarget;
  try {
    target = parseBuildTarget(args.target);
  } catch (error: unknown) {
    fail(error instanceof Error ? error.message : String(error));
  }
  packageBuild(pkg.version, target);
}
