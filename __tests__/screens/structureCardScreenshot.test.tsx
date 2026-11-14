import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { StructureLineCard } from '@/src/components/calculation/StructureLineCard';
import { line, structure } from '@/__tests__/pdfFixtures';
import type { StructureLine } from '@/src/core/models/types';
import { renderScreen } from './renderScreen';

const OUT_DIR = path.join(__dirname, '../../docs/esimerkki-tiivistys');

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

type JsonNode = {
  type?: string;
  props?: Record<string, unknown>;
  children?: JsonNode[] | string | null;
};

function styleAttr(style: unknown): string {
  if (!style || typeof style !== 'object') return '';
  const flat: Record<string, string | number> = {};
  const stack = Array.isArray(style) ? style : [style];
  for (const entry of stack) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      if (value == null || typeof value === 'object') continue;
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      flat[cssKey] = value as string | number;
    }
  }
  const css = Object.entries(flat)
    .map(([k, v]) => `${k}:${typeof v === 'number' ? `${v}px` : v}`)
    .join(';');
  return css ? ` style="${css}"` : '';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderJsonNode(node: JsonNode | string | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return escapeHtml(node);
  const type = node.type ?? 'div';
  const props = node.props ?? {};
  const childNodes = node.children;
  const tag =
    type === 'Text' ? 'span' : type === 'View' || type === 'Pressable' || type === 'TextInput' ? 'div' : 'div';
  const className = type === 'TextInput' ? 'rn-input' : '';
  let inner = '';
  if (Array.isArray(childNodes)) {
    inner = childNodes.map((c) => renderJsonNode(c)).join('');
  } else if (typeof childNodes === 'string') {
    inner = escapeHtml(childNodes);
  }
  const attrs = [className ? `class="${className}"` : '', styleAttr(props.style)].filter(Boolean).join(' ');
  return `<${tag}${attrs ? ` ${attrs}` : ''}>${inner}</${tag}>`;
}

function renderCardsHtml(): string {
  return fictionalLines()
    .map((ln, index) => {
      const tree = renderScreen(
        <StructureLineCard
          line={ln}
          structure={STRUCTURES[index]}
          offerIncludesVat
          weatherReserveFactor={1.15}
          onChange={() => undefined}
          onDelete={() => undefined}
          showAdditionalInfo={index === 0}
        />,
      );
      return renderJsonNode(tree.toJSON() as JsonNode);
    })
    .join('\n');
}

function writePng(targetName: 'before.png' | 'after.png') {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const htmlPath = path.join(OUT_DIR, '_preview.html');
  const pngPath = path.join(OUT_DIR, targetName);
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: #f4f4f4; font-family: system-ui, sans-serif; }
  .stack { display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
  .rn-input { min-height: 20px; }
</style></head><body><div class="stack">${renderCardsHtml()}</div></body></html>`;
  fs.writeFileSync(htmlPath, html, 'utf8');
  execSync(
    `google-chrome --headless=new --disable-gpu --hide-scrollbars --window-size=460,2400 --screenshot=${pngPath} file://${htmlPath}`,
    { stdio: 'pipe' },
  );
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

  const shot = process.env.STRUCTURE_CARD_SCREENSHOT;
  (shot === 'before' || shot === 'after' ? it : it.skip)(
    `writes ${shot ?? '—'}.png when STRUCTURE_CARD_SCREENSHOT is set`,
    () => {
      writePng(shot === 'after' ? 'after.png' : 'before.png');
    },
  );
});