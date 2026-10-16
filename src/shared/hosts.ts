// Hôtes des plateformes : un domaine ou l'un de ses sous-domaines. Module pur, sûr pour le monde MAIN.

/** Prédicat : `hostname` est l'un de ces domaines ou l'un de leurs sous-domaines (casse ignorée) */
export function domainOrSubdomain(...domains: readonly string[]): (hostname: string) => boolean {
  return (hostname) => {
    const host = hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  };
}
