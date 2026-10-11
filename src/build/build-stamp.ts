/**
 * Horodatage du build (`__SYNCKAI_BUILD__`), reproductible pour la relecture du code source sur AMO :
 * 1. `SOURCE_DATE_EPOCH` (variable d'environnement, secondes Unix) ;
 * 2. fichier `.source-date-epoch` (ajouté par `npm run package:source` à l'archive des sources, sans dépôt git) ;
 * 3. date du dernier commit (`git log -1 --format=%ct HEAD`) ;
 * 4. à défaut, l'heure courante.
 */
export interface BuildStampSources {
  epochEnv: string | undefined;
  epochFile: string | null;
  gitCommitEpoch: string | null;
  now: Date;
}

/**
 * Seule source de l'horodatage tiré de git : lue par vite.config.ts (build dans le dépôt, CI comprise) et écrite
 * telle quelle dans `.source-date-epoch` par scripts/package.ts (build du relecteur depuis l'archive des sources).
 * Mêmes arguments des deux côtés → même `__SYNCKAI_BUILD__`, vérifié en CI par le build depuis l'archive.
 */
export const GIT_COMMIT_EPOCH_ARGS: readonly string[] = ['log', '-1', '--format=%ct', 'HEAD'];

function fromEpoch(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  return new Date(Number(trimmed) * 1000).toISOString();
}

export function resolveBuildStamp({ epochEnv, epochFile, gitCommitEpoch, now }: BuildStampSources): string {
  return fromEpoch(epochEnv) ?? fromEpoch(epochFile) ?? fromEpoch(gitCommitEpoch) ?? now.toISOString();
}
