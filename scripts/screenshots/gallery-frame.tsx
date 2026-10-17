// Galerie des composants de base (src/ui/components) dans leurs états, thème sombre, à la largeur `?width=` (400 :
// popup et Réglages, 360 : panneau latéral). Développement seulement : servie par le serveur Vite des captures, jamais
// construite dans le paquet. Mise en page de la galerie par l'objet `style` : aucune classe ici, pour que le scan
// Tailwind du paquet (qui lit aussi scripts/) n'y trouve rien de nouveau.
import './gallery.css';
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { loadLocale, setLocale } from '../../src/i18n';
import { AccountAvatar } from '../../src/ui/components/account-avatar';
import { Alert } from '../../src/ui/components/alert';
import { Button } from '../../src/ui/components/button';
import { ChoiceCards } from '../../src/ui/components/choice-cards';
import { Collapsible } from '../../src/ui/components/collapsible';
import { Cover } from '../../src/ui/components/cover';
import { FeedbackBanner } from '../../src/ui/components/feedback-banner';
import { IconButton } from '../../src/ui/components/icon-button';
import { LogoButton } from '../../src/ui/components/logo-button';
import { MediaDetails } from '../../src/ui/components/media-details';
import { MediaHeader, MediaHeaderSkeleton } from '../../src/ui/components/media-header';
import { Menu, MenuItem, MenuSeparator, SubMenu } from '../../src/ui/components/menu';
import { RatingBlock } from '../../src/ui/components/rating-block';
import { SeasonPicker } from '../../src/ui/components/season-picker';
import { Section } from '../../src/ui/components/section';
import { Segmented } from '../../src/ui/components/segmented';
import { Select } from '../../src/ui/components/select';
import { ServiceLines } from '../../src/ui/components/service-lines';
import { ServiceLogo } from '../../src/ui/components/service-logo';
import { SettingsCard, SettingsRow } from '../../src/ui/components/settings-row';
import { StarRating } from '../../src/ui/components/star-rating';
import { StatusBar, type StatusBarAccount, type StatusBarProps } from '../../src/ui/components/status-bar';
import { AddToListButtons, StatusActions } from '../../src/ui/components/status-actions';
import { StatusText } from '../../src/ui/components/status-text';
import { Stepper } from '../../src/ui/components/stepper';
import { Switch } from '../../src/ui/components/switch';
import { Tabs } from '../../src/ui/components/tabs';
import { ReviewCard, type ReviewActions } from '../../src/ui/review-card';
import type { PendingReview } from '../../src/shared/review.types';
import { coverUrl } from './covers';
import { markReady, param, waitFor } from './params';

await loadLocale('fr');
setLocale('fr');

const width = Number(param('width') ?? '400');

const DANDADAN = coverUrl({ from: '#2B6A73', to: '#16131f', accent: '#7ee0c3', motif: 'bolt' });
const APOTHICAIRE = coverUrl({ from: '#8A3B5C', to: '#211c2e', accent: '#ffd37a', motif: 'moon' });

const row = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } as const;
const column = { display: 'flex', flexDirection: 'column', gap: '8px' } as const;

/** Bloc de la galerie : titre du composant, puis ses états */
/** Carte « À vérifier » de démonstration (deux fiches proposées, la suggestion cochée) */
const REVIEW: PendingReview = {
  key: 'netflix:mushoku:s2',
  episode: { platform: 'netflix', episodeId: 'e30', seriesId: 'mushoku', seriesSlug: null, animeTitle: 'Mushoku Tensei', seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 5, displayedEpisodeNumber: 30, episodeTitle: null, url: 'https://www.netflix.com/watch/1' },
  reason: 'Trouvée par le titre seul (aucune fiche AniList liée à cette série Netflix)',
  suggestion: { mediaId: 146065, progress: 5 },
  candidates: [
    { id: 146065, title: 'Mushoku Tensei II: Jobless Reincarnation', format: 'TV', episodes: 12, year: 2023, coverUrl: null },
    { id: 166873, title: 'Mushoku Tensei II: Jobless Reincarnation Part 2', format: 'TV', episodes: 12, year: 2024, coverUrl: null },
  ],
  previous: null,
  createdAt: 1,
};

const REVIEW_ACTIONS: ReviewActions = {
  search: () => Promise.resolve({ ok: true, data: [] }),
  confirm: () => new Promise(() => undefined),
  dismiss: () => Promise.resolve(),
  exclude: () => Promise.resolve(),
};

function Block({ name, children }: { name: string; children: ComponentChildren }) {
  return (
    <div style={{ ...column, gap: '6px' }} data-block={name}>
      <div style={{ fontSize: '10px', letterSpacing: '1px', opacity: 0.6 }}>{name}</div>
      {children}
    </div>
  );
}

function Card({ children, pad = '12px' }: { children: ComponentChildren; pad?: string }) {
  return <div style={{ borderRadius: '14px', border: '1px solid var(--color-line)', background: 'var(--color-surface)', padding: pad, ...column }}>{children}</div>;
}

function Toggles() {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  return (
    <div style={row}>
      <Switch checked={on} onChange={setOn} label="Activé" />
      <Switch checked={off} onChange={setOff} label="Désactivé" />
      <Switch checked disabled onChange={() => undefined} label="Activé, inactif" />
      <Switch checked={false} disabled onChange={() => undefined} label="Désactivé, inactif" />
    </div>
  );
}

function TriggerCards() {
  const [value, setValue] = useState<'credits' | 'percentage'>('credits');
  return (
    <ChoiceCards
      legend="Épisode compté comme vu"
      options={[
        { value: 'credits', label: 'Au début du générique', description: 'Recommandé : le moment exact donné par la plateforme' },
        { value: 'percentage', label: 'À un pourcentage fixe', description: 'Utilisé aussi quand le générique est inconnu' },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

function Rating({ initial, size, readonly = false }: { initial: number; size?: 'sm' | 'md'; readonly?: boolean }) {
  const [value, setValue] = useState(initial);
  return <StarRating label="Noter Frieren" value={value} onChange={setValue} size={size} readonly={readonly} />;
}

const PANEL_TABS = [
  { value: 'last', label: 'Dernier ouvert' },
  { value: 'nowPlaying', label: 'En lecture' },
  { value: 'agenda', label: 'Agenda' },
] as const;
const ENTRY_SERVICES = [
  { value: 'anilist', label: 'AniList' },
  { value: 'mal', label: 'MAL', aria: 'MyAnimeList' },
] as const;

const ACCOUNTS: readonly StatusBarAccount[] = [
  { service: 'anilist', state: 'connected', label: 'Compte AniList', onClick: () => undefined },
  { service: 'mal', state: 'connected', label: 'Compte MyAnimeList', onClick: () => undefined },
];

const BARS: readonly (StatusBarProps & { name: string })[] = [
  { name: 'tout va bien', accounts: ACCOUNTS, message: { text: 'il y a 5 min', tone: 'ok', icon: 'checkCircle', title: 'Tout est synchronisé' } },
  { name: 'synchro en cours', accounts: ACCOUNTS, message: { text: 'Synchro…', tone: 'info', icon: 'sync' } },
  {
    name: 'synchro terminée (série)',
    accounts: ACCOUNTS,
    message: { series: 'Mushoku Tensei: Isekai Ittara Honki Dasu', text: 'Ép. 6 synchronisé', tone: 'ok', icon: 'checkCircle', onClick: () => undefined },
    trailing: <IconButton icon="xCircle" label="J’ai vu, masquer" outlined iconClass="h-3 w-3" />,
  },
  { name: 'import en cours', accounts: ACCOUNTS, message: { text: 'Import Crunchyroll · 42 / 120', tone: 'info', icon: 'sync', onClick: () => undefined }, progress: 0.35 },
  { name: 'à vérifier', accounts: ACCOUNTS, message: { text: '2 à vérifier · 1 en attente', tone: 'warn', icon: 'alert', onClick: () => undefined } },
  {
    name: 'session expirée',
    accounts: [ACCOUNTS[0] ?? { service: 'anilist', state: 'connected', label: 'Compte AniList' }, { service: 'mal', state: 'expired', label: 'Compte MyAnimeList, session expirée', onClick: () => undefined }],
    message: { text: 'Session MAL expirée', tone: 'error', icon: 'alert' },
    trailing: (
      <Button size="sm" variant="secondary">
        Reconnecter
      </Button>
    ),
  },
  { name: 'MAL jamais connecté', accounts: [ACCOUNTS[0] ?? { service: 'anilist', state: 'connected', label: 'Compte AniList' }, { service: 'mal', state: 'none', label: 'Compte MyAnimeList' }], message: { text: '1 série à noter', tone: 'info', icon: 'star', onClick: () => undefined } },
];

/** Ligne « Mes séries » assemblée pour comparer à la maquette PopupSeries (assemblage propre à la galerie) */
function SeriesRow({ title, cover, value, total, status, tone, menuOpen = false }: { title: string; cover: string | null; value: number; total: number | null; status: string; tone: 'ok' | 'info'; menuOpen?: boolean }) {
  return (
    <div style={{ height: '80px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 8px 10px 12px' }}>
      <Cover size="row" title={title} src={cover} progress={{ value, total, label: 'Progression' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: '14px', lineHeight: '18px', fontWeight: 700 }} title={title}>
          {title}
        </div>
        <StatusText tone={tone}>{status}</StatusText>
        <Stepper text={`Ép. ${value} / ${total ?? '?'}`} value={value} max={total} decrementLabel="Moins un épisode" incrementLabel="Plus un épisode" groupLabel={`Épisodes vus de ${title}`} onDecrement={() => undefined} onIncrement={() => undefined} />
      </div>
      <LogoButton platform="crunchyroll" href="https://www.crunchyroll.com/" label={`Ouvrir ${title} sur Crunchyroll`} title="Ouvrir sur Crunchyroll" />
      <RowMenu title={title} open={menuOpen} />
    </div>
  );
}

function RowMenu({ title, open }: { title: string; open: boolean }) {
  return (
    <Menu label={`Plus d’actions pour ${title}`} menuLabel={title} defaultOpen={open}>
      <MenuItem icon="pause" onSelect={() => undefined}>
        Mettre en pause
      </MenuItem>
      <MenuItem icon="ban" tone="error" onSelect={() => undefined}>
        Abandonner
      </MenuItem>
      <MenuItem icon="check" onSelect={() => undefined}>
        Marquer comme terminé
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon="pencil" tone="info" onSelect={() => undefined}>
        Commentaire
      </MenuItem>
      <SubMenu icon="external" label="Ouvrir la fiche">
        <MenuItem service="anilist" href="https://anilist.co/">
          AniList
        </MenuItem>
        <MenuItem service="mal" href="https://myanimelist.net/">
          MyAnimeList
        </MenuItem>
      </SubMenu>
      <MenuSeparator />
      <MenuItem icon="ban" onSelect={() => undefined}>
        Ne plus synchroniser
      </MenuItem>
      <MenuItem icon="trash" danger onSelect={() => undefined}>
        Retirer de la liste
      </MenuItem>
    </Menu>
  );
}

function Gallery() {
  const [tab, setTab] = useState<'watching' | 'activity'>('watching');
  const [segment, setSegment] = useState<'last' | 'nowPlaying' | 'agenda'>('last');
  return (
    <div style={{ width: `${width}px`, boxSizing: 'border-box', padding: '16px', ...column, gap: '20px', background: 'var(--color-ground)', fontSize: '13px', lineHeight: 1.4 }}>
      <Block name="Button">
        <div style={row}>
          <Button variant="primary">Enregistrer</Button>
          <Button variant="secondary">Annuler</Button>
          <Button variant="ghost" icon="retry">
            Réessayer
          </Button>
        </div>
        <div style={row}>
          <Button variant="danger" icon="trash">
            Retirer
          </Button>
          <Button variant="text">Plus tard</Button>
          <Button variant="primary" busy>
            Envoi
          </Button>
          <Button variant="secondary" disabled>
            Rien
          </Button>
        </div>
        <div style={row}>
          <Button variant="primary" size="sm" icon="check">
            Valider
          </Button>
          <Button size="sm">Reconnecter</Button>
          <Button size="sm" variant="ghost">
            Détails
          </Button>
          <Button size="sm" variant="text" href="https://anilist.co/" target="_blank">
            Lien texte
          </Button>
        </div>
      </Block>

      <Block name="IconButton">
        <div style={row}>
          <IconButton icon="gear" label="Réglages" />
          <IconButton icon="panel" label="Panneau latéral" outlined />
          <IconButton icon="more" label="Plus d’actions" haspopup="menu" expanded />
          <IconButton icon="gear" label="Réglages" pressed />
          <IconButton icon="xCircle" label="Masquer" outlined iconClass="h-3 w-3" />
          <IconButton icon="trash" label="Inactif" disabled />
        </div>
      </Block>

      <Block name="Stepper · LogoButton · StatusText">
        <Card>
          <Stepper text="Ép. 4 / 12" value={4} max={12} decrementLabel="Moins un épisode" incrementLabel="Plus un épisode" onDecrement={() => undefined} onIncrement={() => undefined} />
          <Stepper text="Ép. 0 / 12" value={0} max={12} decrementLabel="Moins un épisode" incrementLabel="Plus un épisode" onDecrement={() => undefined} onIncrement={() => undefined} />
          <Stepper text="Ép. 12 / 12" value={12} max={12} decrementLabel="Moins un épisode" incrementLabel="Plus un épisode" onDecrement={() => undefined} onIncrement={() => undefined} />
          <Stepper text="Ép. 1180 / ?" value={1180} max={null} decrementLabel="Moins un épisode" incrementLabel="Plus un épisode" onDecrement={() => undefined} onIncrement={() => undefined} />
          <div style={row}>
            <LogoButton platform="crunchyroll" href="https://www.crunchyroll.com/" label="Ouvrir sur Crunchyroll" />
            <LogoButton platform="adn" href="https://animationdigitalnetwork.com/" label="Ouvrir sur ADN" />
            <LogoButton platform="netflix" href="https://www.netflix.com/" label="Ouvrir sur Netflix" />
            <LogoButton platform="disney" href="https://www.disneyplus.com/" label="Ouvrir sur Disney+" />
            <LogoButton platform="prime" href="https://www.primevideo.com/" label="Ouvrir sur Prime Video" />
          </div>
          <div style={row}>
            <StatusText tone="ok">Disponible</StatusText>
            <StatusText tone="info">Sam. 18:00</StatusText>
            <StatusText tone="warn">À vérifier</StatusText>
            <StatusText tone="error">Échec</StatusText>
            <StatusText tone="muted">Terminée</StatusText>
          </div>
          <div style={{ width: '120px' }}>
            <StatusText tone="info">Prochain épisode dimanche 17:15 sur Crunchyroll</StatusText>
          </div>
        </Card>
      </Block>

      <Block name="Switch">
        <Toggles />
      </Block>

      <Block name="ServiceLogo">
        <div style={{ ...row, gap: '12px' }}>
          <ServiceLogo id="anilist" size="sm" />
          <ServiceLogo id="mal" size="md" />
          <ServiceLogo id="anilist" size="lg" />
          <ServiceLogo id="crunchyroll" size="md" />
          <ServiceLogo id="netflix" size="lg" />
        </div>
        <div style={{ ...row, gap: '12px', padding: '8px', borderRadius: '10px', background: 'var(--color-raised)' }}>
          <ServiceLogo id="anilist" size="sm" badge="ok" ring="raised" />
          <ServiceLogo id="mal" size="sm" badge="info" ring="raised" />
          <ServiceLogo id="anilist" size="sm" badge="warn" ring="raised" />
          <ServiceLogo id="mal" size="sm" badge="error" ring="raised" />
          <ServiceLogo id="mal" size="sm" badge="expired" ring="raised" />
        </div>
        <div style={{ ...row, gap: '12px', padding: '8px', borderRadius: '10px', background: 'var(--color-surface)' }}>
          <ServiceLogo id="anilist" size="lg" badge="ok" />
          <ServiceLogo id="mal" size="lg" badge="warn" />
          <ServiceLogo id="mal" size="lg" badge="expired" />
        </div>
      </Block>

      <Block name="Cover">
        <div style={{ ...row, alignItems: 'flex-start', gap: '12px' }}>
          <Cover size="row" title="Dandadan" src={DANDADAN} progress={{ value: 4, total: 12, label: 'Progression' }} />
          <Cover size="row" title="Les Carnets de l’apothicaire" src={APOTHICAIRE} progress={{ value: 30, total: 48, label: 'Progression' }} />
          <Cover size="row" title="One Piece" src={null} progress={{ value: 1180, total: null, label: 'Progression' }} />
          <Cover size="agenda" title="Frieren" src={DANDADAN} dimmed />
          <Cover size="agenda" title="Kaiju No. 8" src={null} />
        </div>
      </Block>

      <Block name="Tabs">
        <Tabs label="Vues" idBase="gallery" tabs={[{ id: 'watching', label: 'En cours' }, { id: 'activity', label: 'Activité', badge: 2 }]} selected={tab} onSelect={setTab} />
      </Block>

      <Block name="Section · SettingsRow">
        <Section title="Accès rapide">
          <SettingsCard>
            <SettingsRow title="Synchro automatique" description="Met à jour ta liste à la fin de chaque épisode" toggle={{ checked: true, onChange: () => undefined }} />
            <SettingsRow title="Alertes de sortie" description="Une notification quand un épisode de tes séries sort" toggle={{ checked: false, onChange: () => undefined }} divider />
          </SettingsCard>
        </Section>
        <Section title="Catégories">
          <SettingsCard>
            <SettingsRow icon="sync" tile="lavender" title="Synchronisation" description="Auto · au début du générique" onClick={() => undefined} />
            <SettingsRow icon="monitor" tile="mint" title="Plateformes" description="4 sur 5 actives · lecteur Crunchyroll" onClick={() => undefined} divider />
            <SettingsRow icon="bell" tile="butter" title="Notifications" description="Discrètes · alertes désactivées" onClick={() => undefined} divider />
            <SettingsRow icon="window" tile="sakura" title="Affichage" description="Langue, panneau latéral, raccourcis clavier" onClick={() => undefined} divider />
            <SettingsRow icon="help" tile="muted" title="Aide & à propos" onClick={() => undefined} divider />
          </SettingsCard>
        </Section>
        <Section title="Par série">
          <SettingsCard>
            <SettingsRow title="Correspondances mémorisées" description="La saison AniList retenue pour chaque série" summary="73" onClick={() => undefined} />
            <SettingsRow title="Version" trailing={<span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>2.4.0</span>} divider />
          </SettingsCard>
        </Section>
        <Section title="À propos (liens externes)">
          <SettingsCard>
            <SettingsRow icon="sparkles" title="Nouveautés" summary="synckai.app" href="https://synckai.app/fr/changelog" external />
            <SettingsRow icon="code" title="Code source" summary="GitHub" href="https://github.com/Sync-Kai/SyncKai" external divider />
          </SettingsCard>
        </Section>
      </Block>

      <Block name="ChoiceCards">
        <TriggerCards />
        <ChoiceCards
          legend="Style des notifications (désactivé)"
          options={[
            { value: 'discreet', label: 'Discrètes', badge: 'Recommandé', description: 'Une pastille « Synchronisé » de quelques secondes' },
            { value: 'detailed', label: 'Détaillées', description: 'Une bulle avec l’épisode et le résultat' },
          ]}
          value="discreet"
          onChange={() => undefined}
          disabled
        />
      </Block>

      <Block name="Section (compte, danger)">
        <Section title="Crunchyroll" count={61}>
          <Card>Lignes</Card>
        </Section>
        <Section title="Zone de danger" tone="danger">
          <Card>Tout réinitialiser</Card>
        </Section>
        <SettingsCard>
          <SettingsRow title="Synchro automatique" description="En pause : aucun épisode n’est envoyé" descriptionTone="warn" toggle={{ checked: false, onChange: () => undefined }} />
        </SettingsCard>
      </Block>

      <Block name="Segmented">
        <Segmented label="Onglet à l’ouverture" options={PANEL_TABS} value={segment} onChange={setSegment} fill />
        <Segmented label="Fiche ouverte par défaut" options={ENTRY_SERVICES} value="anilist" onChange={() => undefined} />
        <Segmented label="Fiche ouverte par défaut (désactivée)" options={ENTRY_SERVICES} value="anilist" onChange={() => undefined} disabled />
      </Block>

      <Block name="Select (liste ouverte, option à activer d’abord)">
        <SettingsCard>
          <SettingsRow title="Crunchyroll" description="Tous les animes" leading={<ServiceLogo id="crunchyroll" size="tile" />} trailing={<span style={{ color: 'var(--color-mint)', fontSize: '12px', fontWeight: 700 }}>Inclus</span>} />
        </SettingsCard>
        <div style={{ height: '200px' }}>
          <SettingsCard>
            <Select
              label="Ouvrir les épisodes sur"
              options={[
                { value: 'crunchyroll', label: 'Crunchyroll', leading: <ServiceLogo id="crunchyroll" /> },
                { value: 'adn', label: 'ADN', leading: <ServiceLogo id="adn" /> },
                { value: 'prime', label: 'Prime Video', leading: <ServiceLogo id="prime" />, disabled: true, hint: 'Activer d’abord' },
              ]}
              value="crunchyroll"
              onChange={() => undefined}
              defaultOpen
            />
          </SettingsCard>
        </div>
      </Block>

      <Block name="Alert">
        <Alert message="Connexion annulée." />
        <Alert message="Erreur inattendue lors du chargement du profil." action={{ label: 'Réessayer', onClick: () => undefined }} />
      </Block>

      <Block name="AccountAvatar">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AccountAvatar service="anilist" url={null} size="md" ring="surface" />
          <AccountAvatar service="mal" url={null} state="expired" size="md" ring="surface" />
          <AccountAvatar service="anilist" url={null} state="disconnected" size="md" ring="surface" />
          <AccountAvatar service="mal" url={null} />
        </div>
      </Block>

      <Block name="Collapsible">
        <Collapsible title="Détails : saison, note, commentaire">
          <span>Contenu</span>
        </Collapsible>
        <Collapsible title="Diagnostic de correspondance" count={12} defaultOpen>
          <Card>
            <span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>Contenu déplié</span>
          </Card>
        </Collapsible>
        <Collapsible title="Trace de débogage" count={214} variant="section">
          <Card>
            <span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>Section repliable (outils de dev)</span>
          </Card>
        </Collapsible>
      </Block>

      <Block name="StarRating">
        <Rating initial={8.5} />
        <Rating initial={6} size="sm" />
        <Rating initial={0} />
        <Rating initial={7.5} readonly />
      </Block>

      <Block name="Menu · ligne « Mes séries »">
        <div style={{ borderRadius: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-line)', height: '470px' }} data-series-card="">
          <SeriesRow title="Dandadan" cover={DANDADAN} value={4} total={12} status="Disponible" tone="ok" menuOpen />
          <div style={{ height: '1px', background: 'var(--color-line)', margin: '0 10px' }} />
          <SeriesRow title="Les Carnets de l’apothicaire" cover={APOTHICAIRE} value={30} total={48} status="Sam. 18:00" tone="info" />
        </div>
      </Block>

      <Block name="Fiche « Sur cette page » : MediaHeader · ServiceLines · FeedbackBanner · StatusActions · MediaDetails">
        <Card>
          <MediaHeaderSkeleton overline="Sur cette page" title="Frieren" />
        </Card>
        <Card>
          <MediaHeader
            overline="Sur cette page"
            title="Les Carnets de l’apothicaire Saison 2"
            coverUrl={APOTHICAIRE}
            entry={{ href: 'https://anilist.co/anime/176301', label: 'Ouvrir la fiche sur AniList' }}
            meta="Saison 2 · 2025 · 24 ép. · En diffusion · Crunchyroll"
            airing={{ tone: 'info', text: 'Ép. 7 dans 18 h', date: 'sam. 17 oct., 18:00' }}
            actions={<Menu label="Plus d’actions"><MenuItem icon="pause">Mettre en pause</MenuItem></Menu>}
          />
          <SeasonPicker label="Saison" ariaLabel="Choisir la saison" options={[{ id: 1, label: 'Saison 2 · partie 2 — Mushoku Tensei II Part 2 (2024)' }, { id: 2, label: 'Saison 2 · partie 1 — Mushoku Tensei II (2023)' }]} value={1} onPick={() => undefined} warning="Saison devinée : vérifie-la ci-dessous" />
          <ServiceLines
            label="État dans tes listes"
            lines={[
              { service: 'anilist', serviceLabel: 'AniList', text: 'En cours · Ép. 6 / 24', state: 'in-list' },
              { service: 'mal', serviceLabel: 'MyAnimeList', text: 'Pas dans ta liste', state: 'absent' },
            ]}
          />
          <FeedbackBanner tone="warning" text="Ép. 7 vu · échec MyAnimeList" retry={{ label: 'Réessayer', ariaLabel: 'Réessayer sur MyAnimeList', onClick: () => undefined }} />
          <AddToListButtons labels={{ PLANNING: 'Ajouter à À regarder', CURRENT: 'Ajouter à En cours' }} busy={null} primary={false} onAdd={() => undefined} focusKey="g" />
          <StatusActions statusLabel="En cours" stepper={{ text: 'Ép. 6 / 24', value: 6, max: 24, decrementLabel: 'Moins', incrementLabel: 'Plus', onDecrement: () => undefined, onIncrement: () => undefined }} />
          <MediaDetails label="Détails : saison, note, commentaire" open onToggle={() => undefined}>
            <RatingBlock label="Ta note" sliderLabel="Noter" value={8.5} onRate={() => undefined} />
          </MediaDetails>
        </Card>
        <FeedbackBanner tone="success" text="Ajoutée à En cours" />
        <FeedbackBanner tone="info" text="Déjà dans ta liste" />
        <FeedbackBanner tone="error" text="Erreur inattendue lors de l’ajout à la liste." />
        <Alert message="Aucune fiche AniList trouvée pour « Moi, quand je me réincarne en Slime »." tone="warn" icon="search" action={{ label: 'Réessayer', onClick: () => undefined }} />
      </Block>

      <Block name="Activité : Section teintée · carte « À vérifier » (ReviewCard)">
        <Section title="Échec" count={1} countInline tone="danger">
          <Alert message="Impossible de lire les synchros en attente." />
        </Section>
        <Section title="En attente" count={2} countInline tone="info">
          <FeedbackBanner tone="success" text="Frieren : AniList : épisode 7 enregistré" />
        </Section>
        <Section title="À noter" count={1} countInline tone="accent">
          <StarRating size="sm" label="Noter Berserk" value={8.5} />
        </Section>
        <Section title="À vérifier" count={1} countInline tone="warn">
          <ReviewCard review={REVIEW} actions={REVIEW_ACTIONS} />
          <ReviewCard review={{ ...REVIEW, key: 'empty', candidates: [], suggestion: null, reason: 'Aucune fiche AniList trouvée pour « Dandadan »' }} actions={REVIEW_ACTIONS} />
        </Section>
      </Block>

      <Block name="StatusBar">
        {BARS.map(({ name, ...bar }) => (
          <div key={name} style={column}>
            <div style={{ fontSize: '10px', opacity: 0.5 }}>{name}</div>
            <StatusBar {...bar} />
          </div>
        ))}
      </Block>
    </div>
  );
}

const app = document.getElementById('app');
if (!app) throw new Error('#app absent');
render(<Gallery />, app);

// Sous-menu « Ouvrir la fiche » déplié par son vrai bouton (clic), menu de la première ligne ouvert d'emblée
(await waitFor(() => document.querySelector<HTMLElement>('[data-series-card] [data-submenu-entry]'))).click();
// Focus retiré du menu : pas d'anneau de focus clavier sur la capture
(document.activeElement as HTMLElement | null)?.blur();
await markReady();
