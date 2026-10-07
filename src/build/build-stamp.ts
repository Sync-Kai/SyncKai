/**
 * Horodatage du build (`__SYNCKAI_BUILD__`), reproductible pour la relecture du code source sur AMO :
 * 1. `SOURCE_DATE_EPOCH` (variable d'environnement, secondes Unix) ;
 * 2. fichier `.source-date-epoch` (ajouté par `npm run package:source` à l'archive des sources, sans dépôt git) ;
 * 3. date du dernier commit (`git log -1 --format=%cI`) ;
 * 4. à défaut, l'heure courante.
 */
export interface BuildStampSources {
  epochEnv: string | undefined;
  epochFile: string | null;
  gitCommitTime: string | null;
  now: Date;
}

function fromEpoch(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  return new Date(Number(trimmed) * 1000).toISOString();
}

function fromIso(value: string | null): string | null {
  if (!value?.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function resolveBuildStamp({ epochEnv, epochFile, gitCommitTime, now }: BuildStampSources): string {
  return fromEpoch(epochEnv) ?? fromEpoch(epochFile) ?? fromIso(gitCommitTime) ?? now.toISOString();
}
