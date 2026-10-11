import { describe, expect, it } from 'vitest';
import {
  NETFLIX_PATTERN,
  checkAccessDeclarations,
  checkContentSecurityPolicy,
  checkWebAccessibleResources,
  fileReferences,
  hasDynamicImport,
  manifestReferences,
  reachableFiles,
  type BuiltManifest,
} from './build-checks.ts';

const CR = ['*://*.crunchyroll.com/*'];
const netflixEntry = { matches: [NETFLIX_PATTERN], resources: ['src/content/netflix/a.iife.js', 'src/content/netflix/b.iife.js'] };
const crEntry = { matches: CR, resources: ['assets/start-x.js'] };

const base: BuiltManifest = {
  version: '1.0.0',
  default_locale: 'en',
  icons: { '16': 'icons/icon-16.png' },
  permissions: ['storage', 'scripting'],
  host_permissions: CR,
  optional_host_permissions: [NETFLIX_PATTERN],
  background: { service_worker: 'service-worker-loader.js' },
  content_scripts: [{ matches: CR, js: ['assets/content.ts-loader-x.js'] }],
  web_accessible_resources: [crEntry, netflixEntry],
  action: { default_popup: 'src/popup/popup.html', default_icon: { '16': 'icons/icon-16.png' } },
};

describe('manifestReferences', () => {
  it('liste sans doublon les fichiers cités, sans les motifs', () => {
    const refs = manifestReferences({ ...base, web_accessible_resources: [...(base.web_accessible_resources ?? []), { matches: CR, resources: ['assets/*'] }] });
    expect(refs).toEqual([
      'icons/icon-16.png',
      'src/popup/popup.html',
      'service-worker-loader.js',
      'assets/content.ts-loader-x.js',
      'assets/start-x.js',
      'src/content/netflix/a.iife.js',
      'src/content/netflix/b.iife.js',
      '_locales/en/messages.json',
    ]);
  });

  it('Firefox : scripts d’arrière-plan et barre latérale', () => {
    const refs = manifestReferences({ background: { scripts: ['service-worker-loader.js'] }, sidebar_action: { default_panel: 'src/sidepanel/sidepanel.html' } });
    expect(refs).toEqual(['src/sidepanel/sidepanel.html', 'service-worker-loader.js']);
  });
});

describe('checkWebAccessibleResources', () => {
  it('manifeste conforme', () => {
    expect(checkWebAccessibleResources(base)).toEqual([]);
  });

  it('scripts Netflix exposés à tous les sites (exposition par défaut de crxjs)', () => {
    const errors = checkWebAccessibleResources({ web_accessible_resources: [{ ...netflixEntry, matches: ['http://*/*', 'https://*/*'] }] });
    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).toMatch(/tous les sites/);
    expect(errors.join('\n')).toMatch(/hors de/);
  });

  it('<all_urls>, repère crxjs non résolu, entrée Netflix mêlée, scripts Netflix absents', () => {
    expect(checkWebAccessibleResources({ web_accessible_resources: [{ matches: ['<all_urls>'], resources: ['assets/x.js'] }] })).toEqual([
      'web_accessible_resources ["<all_urls>"] : ressources exposées à tous les sites',
      'web_accessible_resources : scripts Netflix (*.iife.js) absents',
    ]);
    expect(checkWebAccessibleResources({ web_accessible_resources: [{ ...netflixEntry, resources: [...netflixEntry.resources, '<dynamic_resource>'] }] })).toEqual([
      'web_accessible_resources ["*://*.netflix.com/*"] : ressource non résolue « <dynamic_resource> »',
      'web_accessible_resources ["*://*.netflix.com/*"] : entrée Netflix mêlée à d\'autres ressources',
    ]);
  });
});

describe('checkAccessDeclarations', () => {
  it('identique au manifeste source', () => {
    expect(checkAccessDeclarations(base, base)).toEqual([]);
  });

  it('permission ajoutée, Netflix déplacé en accès obligatoire ou en script de contenu', () => {
    const errors = checkAccessDeclarations(
      {
        ...base,
        permissions: ['storage', 'scripting', 'tabs'],
        host_permissions: [...CR, NETFLIX_PATTERN],
        optional_host_permissions: [],
        content_scripts: [{ matches: [...CR, NETFLIX_PATTERN] }],
      },
      base,
    );
    expect(errors).toHaveLength(7);
    expect(errors[0]).toMatch(/^permissions :/);
  });
});

describe('checkContentSecurityPolicy', () => {
  const csp = { extension_pages: "script-src 'self'; object-src 'self'; img-src 'self' https://s4.anilist.co" };

  it('identique au manifeste source', () => {
    expect(checkContentSecurityPolicy({ content_security_policy: csp }, { content_security_policy: csp })).toEqual([]);
  });

  it('retirée ou élargie par le build, absente du manifeste source', () => {
    expect(checkContentSecurityPolicy({}, { content_security_policy: csp })).toHaveLength(1);
    const wider = { extension_pages: `${csp.extension_pages} https:` };
    expect(checkContentSecurityPolicy({ content_security_policy: wider }, { content_security_policy: csp })[0]).toMatch(/^content_security_policy/);
    expect(checkContentSecurityPolicy({}, {})).toEqual(['content_security_policy.extension_pages absente du manifeste source']);
  });
});

describe('fileReferences', () => {
  it('JS : imports relatifs, import() et chemins du paquet entre guillemets ou accents graves', () => {
    const code =
      'import{t as e}from"./guards-a.js";import"./side.js";const m=()=>import("./lazy.js");' +
      'chrome.runtime.getURL("assets/src-content.ts-b.js");x.getURL(`icons/icon-128.png`);' +
      "const p='src/content/netflix/page-bridge.iife.js',d=`icons/icon-${s}.png`,t='src/content/';";
    expect(fileReferences('assets/background.js', code)).toEqual([
      'assets/guards-a.js',
      'assets/lazy.js',
      'assets/side.js',
      'assets/src-content.ts-b.js',
      'icons/icon-128.png',
      'src/content/netflix/page-bridge.iife.js',
    ]);
    expect(fileReferences('service-worker-loader.js', "import './assets/background.js';\n")).toEqual(['assets/background.js']);
  });

  it('HTML (chemins absolus ou relatifs) et CSS (url), URL externes ignorées', () => {
    const html = '<script type="module" src="/assets/popup.js"></script><link href="./local.css"><a href="https://anilist.co">';
    expect(fileReferences('src/popup/popup.html', html)).toEqual(['assets/popup.js', 'src/popup/local.css']);
    const css = '@font-face{src:url(/assets/a.woff2) format("woff2"),url("./b.woff")}.x{background:url(data:image/png;base64,AA)}';
    expect(fileReferences('assets/popup.css', css)).toEqual(['assets/a.woff2', 'assets/b.woff']);
  });
});

describe('reachableFiles', () => {
  it('fermeture des références, cycles compris', () => {
    const graph: Record<string, string[]> = { a: ['b'], b: ['c', 'a'], c: [], d: ['a'] };
    expect([...reachableFiles(['a'], (file) => graph[file] ?? [])].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('hasDynamicImport', () => {
  it('chargeur crxjs détecté, textes i18n ignorés', () => {
    expect(hasDynamicImport('(async()=>{await import(\n/* @vite-ignore */\nchrome.runtime.getURL("x.js"))})()')).toBe(true);
    expect(hasDynamicImport('(function(){var t={"a":`Open the Crunchyroll import (new tab)`}})()')).toBe(false);
  });
});
