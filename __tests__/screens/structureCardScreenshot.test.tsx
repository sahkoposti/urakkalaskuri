import { StructureLineCard } from '@/src/components/calculation/StructureLineCard';
import { line, structure } from '@/__tests__/pdfFixtures';
import type { StructureLine } from '@/src/core/models/types';
import { renderScreen } from './renderScreen';

const STRUCTURES = [
  structure('s1', 'Fiktiivinen ulkomaalaus'),
  structure('s2', 'Fiktiivinen sokkeli'),
  structure('s3', 'Fiktiivinen katto'),
];

function fictionalLines(): StructureLine[] {
  return [
    { ...line('l1', 's1', 'Fiktiivinen ulkomaalaus', '80'), unit: 'm²' },
    { ...line('l2', 's2', 'Fiktiivinen sokkeli', '40'), unit: 'jm' },
    { ...line('l3', 's3', 'Fiktiivinen katto', '120'), unit: 'm²' },
  ];
}

describe('structure card screenshots', () => {
  it('matches single-card render snapshot (business, Lisätiedot collapsed)', () => {
    const tree = renderScreen(
      <StructureLineCard
        line={line('snap', 's1', 'Fiktiivinen rakenne')}
        structure={STRUCTURES[0]}
        offerIncludesVat
        onChange={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('matches three-card stack snapshot', () => {
    const tree = renderScreen(
      <>
        {fictionalLines().map((ln, index) => (
          <StructureLineCard
            key={ln.id}
            line={ln}
            structure={STRUCTURES[index]}
            offerIncludesVat
            onChange={() => undefined}
            onDelete={() => undefined}
            showAdditionalInfo={index === 0}
          />
        ))}
      </>,
    );
    expect(tree.toJSON()).toMatchSnapshot();
  });
});