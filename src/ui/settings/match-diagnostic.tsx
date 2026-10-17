// Réglages › Aide & à propos › Diagnostic des correspondances (maquette AProposDev ; builds de dev seulement : monté sous
// `__SYNCKAI_DEBUG__` par page-help.tsx, absent des bundles publiés). Décisions écrites par le service worker
// (background/sync/match-diagnostic.ts) dans storage.session ; « Copier » donne une décision en JSON (cas du corpus),
// « Tout copier » toutes (tableau JSON, les plus récentes d'abord), « Effacer » vide la liste. Section repliée par
// défaut (liste longue), état ouvert gardé en mémoire pour la page. Logger créé à l'usage : rien au chargement du module,
// qui reste ainsi hors des bundles publiés.
import { useEffect, useState } from 'preact/hooks';
import { getLocale, t } from '../../i18n';
import { clearMatchDecisions, readMatchDecisions, type MatchDecision } from '../../shared/match-diagnostic';
import { MATCH_DIAGNOSTIC_KEY } from '../../protocol/storage-keys';
import { PLATFORMS } from '../../platforms/registry';
import { createLogger } from '../../browser/logger';
import { Button } from '../components/button';
import { Collapsible } from '../components/collapsible';
import { Icon } from '../components/icon';
import { useLocale } from '../preact/hooks';

const COPIED_MS = 2_000;
const CARD = 'rounded-card border border-line bg-surface';
/** Repère de « Tout copier » (jamais une clé de décision : celles-ci commencent par l'horodatage) */
const ALL = 'all';

/** Signaux reçus, en une ligne compacte (valeurs brutes : outil de développement) */
function signalsLine(decision: MatchDecision): string {
  const s = decision.signals;
  if (!s) return '—';
  const parts = [
    s.seasonYear !== undefined && `season ${s.seasonYear}`,
    s.seriesYear !== undefined && `series ${s.seriesYear}`,
    s.seasonEpisodeCount !== undefined && `${s.seasonEpisodeCount} ep${s.airing === true ? '+' : ''}`,
    s.episodeMinutes !== undefined && `${s.episodeMinutes} min`,
    s.format,
    s.country,
    s.originalTitle,
  ];
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' · ') || '—';
}

function numbersLine(decision: MatchDecision): string {
  const season = decision.seasonNumber === null ? '' : `S${decision.seasonNumber}`;
  const episode = decision.seasonEpisodeNumber === null ? '' : `E${decision.seasonEpisodeNumber}`;
  const absolute = decision.displayedEpisodeNumber !== null && decision.displayedEpisodeNumber !== decision.seasonEpisodeNumber ? ` (${decision.displayedEpisodeNumber})` : '';
  return `${season}${episode}${absolute}`;
}

const idOf = (decision: MatchDecision): string => `${decision.at}:${decision.key}`;

/** JSON d'une décision (« Copier ») */
export const decisionJson = (decision: MatchDecision): string => JSON.stringify(decision, null, 2);
/** JSON de toutes les décisions (« Tout copier ») : tableau dans l'ordre affiché, chaque élément comme `decisionJson` */
export const matchDecisionsJson = (decisions: readonly MatchDecision[]): string => JSON.stringify(decisions, null, 2);

const time = (at: number): string => new Date(at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function DecisionRow({ decision, first, copied, onCopy }: { decision: MatchDecision; first: boolean; copied: boolean; onCopy: () => void }) {
  const { mediaId, confidence, reason, mapping, source, bySignals } = decision.decision;
  const platform = decision.platform in PLATFORMS ? PLATFORMS[decision.platform].label : decision.platform;
  const target = mediaId === null ? t('settings.matchDiag.noEntry') : `#${mediaId}`;
  const meta = [source, confidence, bySignals && 'signals', mapping && `${mapping.origin}/${mapping.verdict}`].filter((part): part is string => typeof part === 'string');
  return (
    <li class={`flex min-w-0 flex-col gap-0.5 px-3 py-2.5 ${first ? '' : 'border-t border-line'}`}>
      <div class="flex min-w-0 items-center gap-2">
        <span class="min-w-0 flex-1 truncate font-bold" title={`${decision.seriesTitle} · ${decision.key}`}>
          {`${platform} · ${decision.seriesTitle} ${numbersLine(decision)}`}
        </span>
        <span class="shrink-0 text-secondary text-muted tabular-nums">{time(decision.at)}</span>
        <Button size="sm" icon={copied ? 'check' : undefined} title={t('settings.matchDiag.copyTitle')} focusKey={`match-diag-copy-${idOf(decision)}`} onClick={onCopy}>
          {copied ? t('settings.matchDiag.copied') : t('settings.matchDiag.copy')}
        </Button>
      </div>
      <span class="min-w-0 font-mono text-secondary break-all text-muted">{decision.key}</span>
      {/* Raison et signaux en entier (repliés sur plusieurs lignes) : c'est ce que le propriétaire vient lire */}
      <span class="min-w-0 text-secondary break-words text-muted">{`→ ${target} · ${meta.join(' · ')} · ${reason}`}</span>
      <span class="min-w-0 text-secondary break-words text-muted">{`${signalsLine(decision)} · ${t('settings.matchDiag.candidates', { count: String(decision.candidates.length) })}`}</span>
    </li>
  );
}

export function MatchDiagnosticSection() {
  useLocale();
  const [decisions, setDecisions] = useState<MatchDecision[] | null>(null);
  /** Décision copiée (horodatage et clé) ou `ALL`, retour « Copiée » pendant 2 s */
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const load = (): void => {
      readMatchDecisions().then(
        (read) => live && setDecisions(read),
        (error: unknown) => {
          createLogger('settings').warn('Diagnostic des correspondances illisible :', error);
          if (live) setDecisions([]);
        },
      );
    };
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area === 'session' && changes[MATCH_DIAGNOSTIC_KEY]) load();
    };
    chrome.storage.onChanged.addListener(onChanged);
    load();
    return () => {
      live = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  useEffect(() => {
    if (copiedId === null) return undefined;
    const timer = setTimeout(() => setCopiedId(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copiedId]);

  async function copy(id: string, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setCopyFailed(false);
    } catch (error: unknown) {
      createLogger('settings').warn('Copie de la décision impossible :', error);
      setCopyFailed(true);
    }
  }

  const empty = decisions === null || decisions.length === 0;
  return (
    <Collapsible title={t('settings.matchDiag.title')} count={decisions?.length} variant="section" focusKey="match-diag-toggle">
      <div class={`${CARD} flex flex-col`}>
        <div class="flex items-start gap-2 px-3 py-2.5">
          <p class="m-0 min-w-0 flex-1 text-secondary text-muted">{t('settings.matchDiag.text')}</p>
          <div class="flex shrink-0 flex-col items-stretch gap-1.5">
            <Button
              size="sm"
              icon={copiedId === ALL ? 'check' : undefined}
              disabled={empty}
              title={t('settings.matchDiag.copyAllTitle')}
              focusKey="match-diag-copy-all"
              onClick={() => void copy(ALL, matchDecisionsJson(decisions ?? []))}
            >
              {copiedId === ALL ? t('settings.matchDiag.copied') : t('settings.matchDiag.copyAll')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={empty}
              focusKey="match-diag-clear"
              onClick={() => void clearMatchDecisions().then(() => setDecisions([]), () => undefined)}
            >
              {t('settings.matchDiag.clear')}
            </Button>
          </div>
        </div>
        {copyFailed && (
          <p class="m-0 px-3 pb-2 text-secondary font-bold text-danger" role="status">
            {t('settings.matchDiag.copyFailed')}
          </p>
        )}
        <div class="border-t border-line">
          {decisions === null && (
            <span class="flex px-3 py-2.5 text-muted">
              <Icon name="spinner" class="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth="2.6" />
            </span>
          )}
          {decisions !== null && decisions.length === 0 && (
            <p class="m-0 px-3 py-2.5 text-secondary text-muted" role="status">
              {t('settings.matchDiag.empty')}
            </p>
          )}
          {decisions !== null && decisions.length > 0 && (
            <ul class="m-0 flex list-none flex-col p-0">
              {decisions.map((decision, index) => (
                <DecisionRow
                  key={idOf(decision)}
                  decision={decision}
                  first={index === 0}
                  copied={copiedId === idOf(decision)}
                  onCopy={() => void copy(idOf(decision), decisionJson(decision))}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
