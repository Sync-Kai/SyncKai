import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { COMPLETE_EPISODE_COMMAND, FIREFOX_SIDEBAR_COMMAND, OPEN_SIDE_PANEL_COMMAND, panelCommandName } from '../shared/commands';
import {
  FIREFOX_GECKO_ID,
  FIREFOX_PANEL_COMMAND,
  firefoxCommands,
  parseBuildTarget,
  SOURCE_PANEL_COMMAND,
  targetManifest,
  targetOutDir,
} from './manifest-target';

describe('targetManifest', () => {
  it('chrome : manifeste inchangé', () => {
    expect(targetManifest(manifest, 'chrome')).toBe(manifest);
  });

  it('chrome : panneau latéral déclaré avec sa permission', () => {
    const chrome = targetManifest(manifest, 'chrome');
    expect(chrome.permissions).toContain('sidePanel');
    expect(chrome.side_panel).toEqual({ default_path: 'src/sidepanel/sidepanel.html' });
  });

  it('firefox : sidebar_action à la place de side_panel / sidePanel, jamais ouverte à l’installation', () => {
    const firefox = targetManifest(manifest, 'firefox');
    expect('side_panel' in firefox).toBe(false);
    expect(firefox.permissions).not.toContain('sidePanel');
    expect(firefox.sidebar_action).toEqual({
      default_panel: manifest.side_panel.default_path,
      default_title: '__MSG_extName__',
      default_icon: manifest.action.default_icon,
      open_at_install: false,
    });
  });

  it('firefox : retire key et minimum_chrome_version', () => {
    const firefox = targetManifest(manifest, 'firefox');
    expect('key' in firefox).toBe(false);
    expect('minimum_chrome_version' in firefox).toBe(false);
  });

  it('firefox : background.scripts à la place du service worker', () => {
    const firefox = targetManifest(manifest, 'firefox');
    expect(firefox.background).toEqual({ scripts: [manifest.background.service_worker], type: 'module' });
  });

  it('firefox : gecko id, version minimale et consentement de collecte', () => {
    const { gecko } = targetManifest(manifest, 'firefox').browser_specific_settings;
    expect(gecko.id).toBe(FIREFOX_GECKO_ID);
    expect(gecko.strict_min_version).toBe('142.0');
    expect(gecko.data_collection_permissions.required).toEqual(['websiteContent', 'websiteActivity']);
  });

  it('firefox : recopie les autres champs sans modifier la source', () => {
    const firefox = targetManifest(manifest, 'firefox');
    expect(firefox.permissions).toEqual(manifest.permissions.filter((permission) => permission !== 'sidePanel'));
    expect(firefox.host_permissions).toEqual(manifest.host_permissions);
    expect(firefox.content_scripts).toEqual(manifest.content_scripts);
    expect(firefox.commands?.['complete-episode']).toEqual(manifest.commands['complete-episode']);
    expect(firefox.action).toEqual(manifest.action);
    expect(firefox.version).toBe(manifest.version);
    expect(manifest.key).toBeTypeOf('string');
    expect(manifest.background.service_worker).toBe('src/background/background.ts');
    expect(manifest.permissions).toContain('sidePanel');
  });
});

describe('raccourcis clavier (commands)', () => {
  it('noms partagés avec le service worker et les réglages (src/shared/commands.ts)', () => {
    expect(SOURCE_PANEL_COMMAND).toBe(OPEN_SIDE_PANEL_COMMAND);
    expect(FIREFOX_PANEL_COMMAND).toBe(FIREFOX_SIDEBAR_COMMAND);
    expect(panelCommandName('chrome')).toBe(OPEN_SIDE_PANEL_COMMAND);
    expect(panelCommandName('firefox')).toBe(FIREFOX_SIDEBAR_COMMAND);
    expect(Object.keys(manifest.commands)).toEqual([COMPLETE_EPISODE_COMMAND, OPEN_SIDE_PANEL_COMMAND]);
  });

  it('manifeste source : Alt+Shift+S et Alt+Shift+P, au plus 4 touches suggérées (limite de Chrome), sans doublon', () => {
    const keys = Object.values(manifest.commands).map((command) => command.suggested_key.default);
    expect(keys).toEqual(['Alt+Shift+S', 'Alt+Shift+P']);
    expect(keys.length).toBeLessThanOrEqual(4);
    expect(new Set(keys).size).toBe(keys.length);
    expect(manifest.commands['open-side-panel'].description).toBe('__MSG_cmdOpenSidePanel__');
  });

  it('chrome : commande du panneau traitée par le service worker', () => {
    expect(targetManifest(manifest, 'chrome').commands).toBe(manifest.commands);
  });

  it('firefox : _execute_sidebar_action (bascule native de la barre latérale), même touche et description, même ordre', () => {
    const { commands } = targetManifest(manifest, 'firefox');
    expect(Object.keys(commands ?? {})).toEqual([COMPLETE_EPISODE_COMMAND, FIREFOX_SIDEBAR_COMMAND]);
    expect(commands?.[FIREFOX_SIDEBAR_COMMAND]).toEqual(manifest.commands['open-side-panel']);
    expect(commands?.[OPEN_SIDE_PANEL_COMMAND]).toBeUndefined();
    // Source intacte
    expect(OPEN_SIDE_PANEL_COMMAND in manifest.commands).toBe(true);
  });

  it('firefoxCommands : autres commandes recopiées telles quelles', () => {
    expect(firefoxCommands({ a: { description: 'x' } })).toEqual({ a: { description: 'x' } });
  });
});

describe('CSP des pages de l’extension (SEC-02)', () => {
  // Aussi sous `npm run dev` : le service worker de crxjs charge ses modules depuis Vite (localhost) malgré `script-src 'self'`
  it('recopiée telle quelle pour Chrome et Firefox', () => {
    expect(targetManifest(manifest, 'chrome').content_security_policy).toEqual(manifest.content_security_policy);
    expect(targetManifest(manifest, 'firefox').content_security_policy).toEqual(manifest.content_security_policy);
  });
});

describe('parseBuildTarget', () => {
  it('chrome par défaut', () => {
    expect(parseBuildTarget(undefined)).toBe('chrome');
    expect(parseBuildTarget('')).toBe('chrome');
  });

  it('cibles connues', () => {
    expect(parseBuildTarget('chrome')).toBe('chrome');
    expect(parseBuildTarget('firefox')).toBe('firefox');
  });

  it('cible inconnue → erreur', () => {
    expect(() => parseBuildTarget('safari')).toThrow(/SYNCKAI_TARGET/);
  });

  it('dossier de sortie', () => {
    expect(targetOutDir('chrome')).toBe('dist');
    expect(targetOutDir('firefox')).toBe('dist-firefox');
  });
});
