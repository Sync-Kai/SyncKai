import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { FIREFOX_GECKO_ID, parseBuildTarget, targetManifest, targetOutDir } from './manifest-target';

describe('targetManifest', () => {
  it('chrome : manifeste inchangé', () => {
    expect(targetManifest(manifest, 'chrome')).toBe(manifest);
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
    expect(firefox.permissions).toEqual(manifest.permissions);
    expect(firefox.host_permissions).toEqual(manifest.host_permissions);
    expect(firefox.content_scripts).toEqual(manifest.content_scripts);
    expect(firefox.commands).toEqual(manifest.commands);
    expect(firefox.action).toEqual(manifest.action);
    expect(firefox.version).toBe(manifest.version);
    expect(manifest.key).toBeTypeOf('string');
    expect(manifest.background.service_worker).toBe('src/background/background.ts');
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
