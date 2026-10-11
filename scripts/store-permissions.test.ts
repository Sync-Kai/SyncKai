/**
 * Garde-fou Chrome Web Store : chaque permission déclarée dans manifest.json a sa justification dans
 * docs/store/permissions.md (onglet Confidentialité du tableau de bord), et chaque bloc à copier tient dans
 * la limite de 1000 caractères des champs du Store. Sans justification, la soumission est refusée après l'envoi
 * (« does not meet the requirements », releases 2.0.0 et 2.1.0) : ce test rougit la CI dès l'ajout d'une permission.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { targetManifest } from '../src/build/manifest-target.ts';

/** Champs du manifeste qui demandent une justification au Chrome Web Store */
interface StoreManifest {
  version: string;
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
}

type HostField = 'host_permissions' | 'optional_host_permissions';

interface CodeBlock {
  /** Titre de la section qui contient le bloc (`Single purpose`, `storage`…) */
  section: string;
  text: string;
}

interface PermissionsDoc {
  /** Version citée dans l'en-tête (« manifest vX.Y.Z »), null si l'en-tête n'en cite pas */
  headerVersion: string | null;
  /** Sections `### <permission>` de « Permission justifications » */
  apiSections: Map<string, CodeBlock[]>;
  /** Motifs des tableaux « Declared in `host_permissions` » / « `optional_host_permissions` » */
  hostTables: Record<HostField, string[]>;
  /** Bloc unique du champ « Host permission justification » */
  hostBlocks: CodeBlock[];
  codeBlocks: CodeBlock[];
}

/** Limite des champs de justification du Chrome Web Store */
const CWS_FIELD_MAX = 1000;

const JUSTIFICATIONS_H2 = 'Permission justifications';
const HOST_H3 = 'Host permissions';
/** Sections de structure, qui ne sont pas des permissions d'API */
const STRUCTURAL_H3 = new Set([HOST_H3, 'Content-script matches']);

function parsePermissionsDoc(markdown: string): PermissionsDoc {
  const lines = markdown.split(/\r?\n/);
  const doc: PermissionsDoc = {
    headerVersion: null,
    apiSections: new Map(),
    hostTables: { host_permissions: [], optional_host_permissions: [] },
    hostBlocks: [],
    codeBlocks: [],
  };
  let h2 = '';
  let h3 = '';
  let hostTable: HostField | null = null;
  let fence: string[] | null = null;

  for (const line of lines) {
    if (fence) {
      if (line.startsWith('```')) {
        const block: CodeBlock = { section: h3 || h2, text: fence.join('\n').trim() };
        doc.codeBlocks.push(block);
        if (h2 === JUSTIFICATIONS_H2 && h3 === HOST_H3) doc.hostBlocks.push(block);
        else if (h2 === JUSTIFICATIONS_H2 && h3) doc.apiSections.get(h3)?.push(block);
        fence = null;
      } else fence.push(line);
      continue;
    }
    if (line.startsWith('```')) {
      fence = [];
      continue;
    }
    if (line.startsWith('## ')) {
      h2 = line.slice(3).trim();
      h3 = '';
      continue;
    }
    if (line.startsWith('### ')) {
      h3 = line.slice(4).trim();
      hostTable = null;
      if (h2 === JUSTIFICATIONS_H2 && !STRUCTURAL_H3.has(h3)) doc.apiSections.set(h3, []);
      continue;
    }
    // En-tête : texte avant la première section de niveau 2
    if (!h2) doc.headerVersion ??= /manifest v(\d+\.\d+\.\d+)/.exec(line)?.[1] ?? null;
    if (h2 !== JUSTIFICATIONS_H2 || h3 !== HOST_H3) continue;
    // « Declared in `optional_host_permissions` … » : le tableau qui suit appartient à ce champ
    const declared = /^Declared in `(host_permissions|optional_host_permissions)`/.exec(line);
    if (declared) hostTable = declared[1] === 'host_permissions' ? 'host_permissions' : 'optional_host_permissions';
    const row = /^\|\s*`([^`]+)`\s*\|/.exec(line);
    if (row && hostTable) doc.hostTables[hostTable].push(row[1]);
  }
  return doc;
}

/** `*://*.crunchyroll.com/*` → `crunchyroll.com` ; motif non reconnu (`<all_urls>`…) → tel quel */
function hostOf(pattern: string): string {
  const match = /^[^:]+:\/\/(?:\*\.)?([^/]+)\//.exec(pattern);
  return match ? match[1] : pattern;
}

function difference(a: readonly string[], b: readonly string[]): string[] {
  return a.filter((item) => !b.includes(item));
}

/** Écarts entre le manifeste et docs/store/permissions.md ; tableau vide si tout est justifié */
function checkStorePermissions(manifest: StoreManifest, markdown: string): string[] {
  const doc = parsePermissionsDoc(markdown);
  const problems: string[] = [];

  if (doc.headerVersion !== null && doc.headerVersion !== manifest.version) {
    problems.push(`En-tête « manifest v${doc.headerVersion} » ≠ version du manifeste (${manifest.version}).`);
  }

  // Permissions d'API : une section `### <permission>` avec son bloc à copier, ni plus ni moins
  const apiPermissions = [...(manifest.permissions ?? []), ...(manifest.optional_permissions ?? [])];
  const documented = [...doc.apiSections.keys()];
  for (const permission of difference(apiPermissions, documented)) {
    problems.push(`Permission « ${permission} » sans section « ### ${permission} » (Permission justifications).`);
  }
  for (const section of difference(documented, apiPermissions)) {
    problems.push(`Section « ### ${section} » sans permission correspondante dans le manifeste.`);
  }
  for (const [permission, blocks] of doc.apiSections) {
    if (blocks.length !== 1 || !blocks[0].text) problems.push(`Section « ### ${permission} » : un bloc de justification attendu (${blocks.length}).`);
  }

  // Hôtes : une ligne de tableau par motif, dans le tableau du bon champ
  const hostFields: readonly HostField[] = ['host_permissions', 'optional_host_permissions'];
  for (const field of hostFields) {
    const declared = manifest[field] ?? [];
    for (const pattern of difference(declared, doc.hostTables[field])) {
      problems.push(`${field} « ${pattern} » absent du tableau « Declared in \`${field}\` ».`);
    }
    for (const pattern of difference(doc.hostTables[field], declared)) {
      problems.push(`Tableau « Declared in \`${field}\` » : « ${pattern} » absent du manifeste.`);
    }
  }

  // Le champ unique « Host permission justification » doit citer chaque hôte
  const hosts = hostFields.flatMap((field) => manifest[field] ?? []);
  if (hosts.length > 0 && doc.hostBlocks.length !== 1) {
    problems.push(`Section « ### ${HOST_H3} » : un bloc « Host permission justification » attendu (${doc.hostBlocks.length}).`);
  }
  const hostJustification = doc.hostBlocks[0]?.text ?? '';
  for (const pattern of hosts) {
    if (!hostJustification.includes(hostOf(pattern))) {
      problems.push(`Bloc « Host permission justification » : « ${hostOf(pattern)} » (${pattern}) n'est pas cité.`);
    }
  }

  // Limite des champs du Store, en caractères (points de code)
  for (const block of doc.codeBlocks) {
    const length = [...block.text].length;
    if (length > CWS_FIELD_MAX) problems.push(`Bloc « ${block.section} » : ${length} caractères (max ${CWS_FIELD_MAX}).`);
  }
  return problems;
}

const MANIFEST = JSON.parse(readFileSync('manifest.json', 'utf8')) as StoreManifest;
const DOC = readFileSync('docs/store/permissions.md', 'utf8');

/** Copie du manifeste avec un champ modifié (manifest.json n'est jamais touché) */
function withField<K extends keyof StoreManifest>(field: K, value: StoreManifest[K]): StoreManifest {
  return { ...structuredClone(MANIFEST), [field]: value };
}

describe('justifications Chrome Web Store (docs/store/permissions.md)', () => {
  it('chaque permission du manifeste est justifiée, chaque bloc tient dans le champ du Store', () => {
    expect(checkStorePermissions(MANIFEST, DOC)).toEqual([]);
  });

  it('lit toutes les sections attendues (le test ne passe pas à vide)', () => {
    const doc = parsePermissionsDoc(DOC);
    expect([...doc.apiSections.keys()].sort()).toEqual([...(MANIFEST.permissions ?? [])].sort());
    expect(doc.hostTables.host_permissions).toEqual(MANIFEST.host_permissions);
    expect(doc.hostTables.optional_host_permissions).toEqual(MANIFEST.optional_host_permissions);
    expect(doc.hostBlocks).toHaveLength(1);
    expect(doc.codeBlocks.length).toBeGreaterThan(doc.apiSections.size);
  });

  it('échoue sur une permission ajoutée sans justification', () => {
    const manifest = withField('permissions', [...(MANIFEST.permissions ?? []), 'tabs']);
    expect(checkStorePermissions(manifest, DOC)).toEqual(['Permission « tabs » sans section « ### tabs » (Permission justifications).']);
  });

  it('échoue sur une permission optionnelle sans justification', () => {
    const manifest = withField('optional_permissions', ['downloads']);
    expect(checkStorePermissions(manifest, DOC)).toEqual(['Permission « downloads » sans section « ### downloads » (Permission justifications).']);
  });

  it('échoue sur un hôte ajouté (tableau et bloc du champ unique)', () => {
    const manifest = withField('host_permissions', [...(MANIFEST.host_permissions ?? []), 'https://*.primevideo.com/*']);
    expect(checkStorePermissions(manifest, DOC)).toEqual([
      'host_permissions « https://*.primevideo.com/* » absent du tableau « Declared in `host_permissions` ».',
      'Bloc « Host permission justification » : « primevideo.com » (https://*.primevideo.com/*) n\'est pas cité.',
    ]);
  });

  it('échoue sur un hôte optionnel ajouté', () => {
    const manifest = withField('optional_host_permissions', [...(MANIFEST.optional_host_permissions ?? []), '*://*.disneyplus.com/*']);
    const problems = checkStorePermissions(manifest, DOC);
    expect(problems).toContain('optional_host_permissions « *://*.disneyplus.com/* » absent du tableau « Declared in `optional_host_permissions` ».');
    expect(problems).toHaveLength(2);
  });

  it('échoue sur un hôte passé d\'un champ à l\'autre', () => {
    const optional = MANIFEST.optional_host_permissions ?? [];
    const manifest = { ...withField('host_permissions', [...(MANIFEST.host_permissions ?? []), ...optional]), optional_host_permissions: [] };
    expect(checkStorePermissions(manifest, DOC)).toHaveLength(2 * optional.length);
  });

  it('échoue sur une justification restée après le retrait de la permission', () => {
    const manifest = withField('permissions', (MANIFEST.permissions ?? []).filter((permission) => permission !== 'scripting'));
    expect(checkStorePermissions(manifest, DOC)).toEqual(['Section « ### scripting » sans permission correspondante dans le manifeste.']);
  });

  it('échoue sur un bloc de plus de 1000 caractères', () => {
    const long = DOC.replace(/(### storage\r?\n\r?\n```\r?\n)/, `$1${'x'.repeat(CWS_FIELD_MAX)} `);
    expect(checkStorePermissions(MANIFEST, long)).toEqual([expect.stringMatching(/^Bloc « storage » : \d+ caractères \(max 1000\)\.$/)]);
  });

  it('échoue sur un en-tête qui cite une autre version que le manifeste', () => {
    const stale = DOC.replace(/^(# .*\r?\n)/, '$1\nAnswers for the Privacy practices tab (manifest v0.0.1).\n');
    expect(checkStorePermissions(MANIFEST, stale)).toEqual([`En-tête « manifest v0.0.1 » ≠ version du manifeste (${MANIFEST.version}).`]);
  });

  it('le build Firefox ne demande aucune permission absente du manifeste Chrome', () => {
    const firefox = targetManifest(MANIFEST, 'firefox');
    expect(difference(firefox.permissions ?? [], MANIFEST.permissions ?? [])).toEqual([]);
    expect(firefox.host_permissions).toEqual(MANIFEST.host_permissions);
    expect(firefox.optional_host_permissions).toEqual(MANIFEST.optional_host_permissions);
  });

  it('hostOf : domaine cité dans le bloc des hôtes', () => {
    expect(hostOf('*://*.crunchyroll.com/*')).toBe('crunchyroll.com');
    expect(hostOf('https://api.myanimelist.net/*')).toBe('api.myanimelist.net');
    expect(hostOf('<all_urls>')).toBe('<all_urls>');
  });
});
