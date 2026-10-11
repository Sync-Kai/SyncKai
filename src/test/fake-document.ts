import { vi } from 'vitest';

// Faux `document` minimal pour exercer un adapter de bout en bout sans dépendance DOM (environnement node) :
// blocs JSON-LD et éléments enregistrés sous un sélecteur simple. `querySelector("a, b")` renvoie le premier
// élément enregistré sous l'un des sélecteurs de la liste, dans l'ordre de la liste. Fichier de test uniquement.

export interface FakeElementInit {
  text: string;
  /** href du lien englobant (closest('a')) */
  href?: string;
}

interface FakeElement {
  textContent: string;
  closest(selector: string): { href: string } | null;
}

export interface FakeDocument {
  /** Remplace les blocs <script type="application/ld+json"> */
  setJsonLd(...blocks: string[]): void;
  /** Enregistre (ou retire avec null) l'élément répondant à `selector` */
  set(selector: string, element: FakeElementInit | null): void;
  readonly documentElement: { lang: string };
}

export function installFakeDocument(lang = 'fr'): FakeDocument {
  let jsonLd: { textContent: string }[] = [];
  const elements = new Map<string, FakeElement>();
  const documentElement = { lang };

  const querySelector = (selector: string): FakeElement | null => {
    for (const part of selector.split(',').map((s) => s.trim())) {
      const element = elements.get(part);
      if (element) return element;
    }
    return null;
  };
  vi.stubGlobal('document', {
    documentElement,
    querySelector,
    querySelectorAll: (selector: string): readonly unknown[] => {
      if (selector === 'script[type="application/ld+json"]') return jsonLd;
      const element = querySelector(selector);
      return element ? [element] : [];
    },
  });

  return {
    documentElement,
    setJsonLd(...blocks) {
      jsonLd = blocks.map((textContent) => ({ textContent }));
    },
    set(selector, init) {
      if (!init) {
        elements.delete(selector);
        return;
      }
      const { href } = init;
      elements.set(selector, { textContent: init.text, closest: (s) => (s === 'a' && href !== undefined ? { href } : null) });
    },
  };
}
