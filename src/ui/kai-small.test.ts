import { afterEach, describe, expect, it, vi } from 'vitest';
import { happyKai, smallKai } from './kai-small';

// Mascotte des scripts de contenu (bulle de synchro) : `happyKai` doit dessiner exactement le Kai ravi de `smallKai`.

/** Nœud minimal (pas de DOM dans les tests unitaires) : balise, attributs, enfants, texte */
interface FakeNode {
  tag: string;
  attrs: Record<string, string>;
  children: FakeNode[];
  textContent: string;
  setAttribute(key: string, value: string): void;
  append(...nodes: FakeNode[]): void;
}

function fakeNode(tag: string): FakeNode {
  const node: FakeNode = {
    tag,
    attrs: {},
    children: [],
    textContent: '',
    setAttribute: (key, value) => {
      node.attrs[key] = value;
    },
    append: (...nodes) => {
      node.children.push(...nodes);
    },
  };
  return node;
}

/** Arbre sérialisé, numéro d'instance des ids de dégradés neutralisé */
function serialize(node: FakeNode): string {
  const attrs = Object.entries(node.attrs).map(([key, value]) => `${key}="${value.replace(/sk-kai\d+/g, 'sk-kai#')}"`);
  return `<${[node.tag, ...attrs].join(' ')}>${node.textContent}${node.children.map(serialize).join('')}</${node.tag}>`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('happyKai', () => {
  it('même dessin que smallKai({ expression: "happy" }), sans tuile ni animation', () => {
    vi.stubGlobal('document', { createElementNS: (_ns: string, tag: string) => fakeNode(tag) });
    const expected = serialize(smallKai('w-6', { expression: 'happy' }) as unknown as FakeNode);
    expect(serialize(happyKai('w-6') as unknown as FakeNode)).toBe(expected);
    expect(expected).toContain('<defs>');
    expect(expected).not.toContain('<text');
  });

  it('ids de dégradés propres à chaque instance', () => {
    vi.stubGlobal('document', { createElementNS: (_ns: string, tag: string) => fakeNode(tag) });
    const first = happyKai('') as unknown as FakeNode;
    const second = happyKai('') as unknown as FakeNode;
    expect(first.children[0]?.children[0]?.attrs.id).not.toBe(second.children[0]?.children[0]?.attrs.id);
  });
});
