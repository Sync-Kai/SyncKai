import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { EDGES } from '../../test/import-graph';

// Les composants de base sont hors du scan Tailwind du paquet (`@source not "./components"` dans ui/theme.css) tant
// qu'aucun écran ne les monte : leurs classes n'entrent pas dans les CSS publiées. Le premier écran qui en importe un
// doit retirer cette exclusion, sinon ses classes manqueraient au build (la galerie, elle, les réintègre).

// Lu sur le disque (Vitest sert un CSS vide, même en `?raw`), depuis la racine du dépôt où tournent les tests
const theme = ts.sys.readFile(`${ts.sys.getCurrentDirectory()}/src/ui/theme.css`) ?? '';
const EXCLUSION = /@source\s+not\s+["']\.\/components["']/;
const isTest = (file: string): boolean => /\.test\.tsx?$/.test(file) || file.startsWith('test/');

describe('composants de base et scan Tailwind', () => {
  it('exclusion du scan dans ui/theme.css si et seulement si aucun module livré n’importe ui/components/', () => {
    const users = EDGES.filter((edge) => !edge.typeOnly && edge.to.startsWith('ui/components/') && !edge.from.startsWith('ui/components/') && !isTest(edge.from)).map((edge) => edge.from);
    const message =
      users.length > 0
        ? `ui/theme.css exclut encore ui/components du scan alors que ${users.join(', ')} les importe : retirer \`@source not "./components"\``
        : 'aucun écran ne monte les composants : garder `@source not "./components"` dans ui/theme.css (paquet inchangé)';
    expect(EXCLUSION.test(theme), message).toBe(users.length === 0);
  });
});
