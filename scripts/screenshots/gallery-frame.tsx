// Galerie des composants de base (src/ui/components) dans leurs états, thème sombre, à la largeur `?width=` (400 :
// popup et Réglages, 360 : panneau latéral). Développement seulement : servie par le serveur Vite des captures, jamais
// construite dans le paquet. Mise en page de la galerie par l'objet `style` : aucune classe ici, pour que le scan
// Tailwind du paquet (qui lit aussi scripts/) n'y trouve rien de nouveau.
import './gallery.css';
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { loadLocale, setLocale } from '../../src/i18n';
import { Button } from '../../src/ui/components/button';
import { Collapsible } from '../../src/ui/components/collapsible';
import { Cover } from '../../src/ui/components/cover';
import { IconButton } from '../../src/ui/components/icon-button';
import { LogoButton } from '../../src/ui/components/logo-button';
import { Menu, MenuItem, MenuSeparator, SubMenu } from '../../src/ui/components/menu';
import { Section } from '../../src/ui/components/section';
import { ServiceLogo } from '../../src/ui/components/service-logo';
import { SettingsCard, SettingsRow } from '../../src/ui/components/settings-row';
import { StarRating } from '../../src/ui/components/star-rating';
import { StatusBar, type StatusBarAccount, type StatusBarProps } from '../../src/ui/components/status-bar';
import { StatusText } from '../../src/ui/components/status-text';
import { Stepper } from '../../src/ui/components/stepper';
import { Switch } from '../../src/ui/components/switch';
import { Tabs } from '../../src/ui/components/tabs';
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

function Rating({ initial, size, readonly = false }: { initial: number; size?: 'sm' | 'md'; readonly?: boolean }) {
  const [value, setValue] = useState(initial);
  return <StarRating label="Noter Frieren" value={value} onChange={setValue} size={size} readonly={readonly} />;
}

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
            <SettingsRow icon="screen" tile="mint" title="Plateformes" description="4 sur 5 actives · lecteur Crunchyroll" onClick={() => undefined} divider />
            <SettingsRow icon="bell" tile="butter" title="Notifications" description="Discrètes · alertes désactivées" onClick={() => undefined} divider />
            <SettingsRow icon="panel" tile="sakura" title="Affichage" description="Langue, panneau latéral, raccourcis clavier" onClick={() => undefined} divider />
            <SettingsRow icon="help" tile="muted" title="Aide & à propos" onClick={() => undefined} divider />
          </SettingsCard>
        </Section>
        <Section title="Par série">
          <SettingsCard>
            <SettingsRow title="Correspondances mémorisées" description="La saison AniList retenue pour chaque série" summary="73" onClick={() => undefined} />
            <SettingsRow title="Version" trailing={<span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>2.4.0</span>} divider />
          </SettingsCard>
        </Section>
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
