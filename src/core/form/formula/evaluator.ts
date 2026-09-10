import {
  slidingMarginParamsFromContext,
  slidingSellingPriceAlv0,
} from '@/src/core/calculation/slidingMargin';

export class FormulaEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaEvaluationError';
  }
}

/** Sisäänrakennetut kaavafunktiot (eivät ole lomakemuuttujia). */
export const FORMULA_FUNCTIONS = new Set([
  'min',
  'max',
  'round',
  'if',
  'sqrt',
  'cos',
  'liukuva_myyntihinta',
]);

type CompareOp = '>' | '<' | '>=' | '<=' | '==' | '!=';

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'compare'; value: CompareOp }
  | { type: 'comma' }
  | { type: 'lparen' }
  | { type: 'rparen' };

const TOKEN_CACHE_LIMIT = 400;
const tokenCache = new Map<string, Token[]>();
const identifierCache = new Map<string, string[]>();

function cacheGet<T>(cache: Map<string, T>, key: string, limit: number, build: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit;
  const value = build();
  if (cache.size >= limit) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
  return value;
}

function tokenizeUncached(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const input = expression.replace(/\s+/g, '');

  while (i < input.length) {
    const char = input[i];

    if (char === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      continue;
    }

    if (char === '=' && input[i + 1] === '=') {
      tokens.push({ type: 'compare', value: '==' });
      i += 2;
      continue;
    }
    if (char === '!' && input[i + 1] === '=') {
      tokens.push({ type: 'compare', value: '!=' });
      i += 2;
      continue;
    }
    if (char === '>' && input[i + 1] === '=') {
      tokens.push({ type: 'compare', value: '>=' });
      i += 2;
      continue;
    }
    if (char === '<' && input[i + 1] === '=') {
      tokens.push({ type: 'compare', value: '<=' });
      i += 2;
      continue;
    }
    if (char === '>') {
      tokens.push({ type: 'compare', value: '>' });
      i += 1;
      continue;
    }
    if (char === '<') {
      tokens.push({ type: 'compare', value: '<' });
      i += 1;
      continue;
    }

    if ('+-*/'.includes(char)) {
      tokens.push({ type: 'op', value: char as '+' | '-' | '*' | '/' });
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let raw = '';
      while (i < input.length && /[0-9.]/.test(input[i])) {
        raw += input[i];
        i += 1;
      }
      const value = Number.parseFloat(raw);
      if (!Number.isFinite(value)) {
        throw new FormulaEvaluationError(`Virheellinen luku: ${raw}`);
      }
      tokens.push({ type: 'number', value });
      continue;
    }

    if (/[a-zA-Z0-9_äöåÄÖÅ.]/.test(char)) {
      let raw = '';
      while (i < input.length && /[a-zA-Z0-9_äöåÄÖÅ.]/.test(input[i])) {
        raw += input[i];
        i += 1;
      }
      tokens.push({ type: 'ident', value: raw });
      continue;
    }

    throw new FormulaEvaluationError(`Tuntematon merkki: ${char}`);
  }

  return tokens;
}

function tokenize(expression: string): Token[] {
  return cacheGet(tokenCache, expression, TOKEN_CACHE_LIMIT, () => tokenizeUncached(expression));
}

function resolveIdentifier(name: string, context: Record<string, number>): number {
  if (name in context) {
    return context[name]!;
  }
  // Puuttuva syöte (kytkin pois, tuote valitsematta, piilotettu kenttä) on 0,
  // jotta live-laskenta ei heitä poikkeusta joka näppäimellä.
  return 0;
}

function applyCompare(op: CompareOp, left: number, right: number): number {
  switch (op) {
    case '>':
      return left > right ? 1 : 0;
    case '<':
      return left < right ? 1 : 0;
    case '>=':
      return left >= right ? 1 : 0;
    case '<=':
      return left <= right ? 1 : 0;
    case '==':
      return left === right ? 1 : 0;
    case '!=':
      return left !== right ? 1 : 0;
  }
}

function callFormulaFunction(
  name: string,
  args: number[],
  context: Record<string, number>,
): number {
  switch (name) {
    case 'min': {
      if (args.length < 2) {
        throw new FormulaEvaluationError('min() vaatii vähintään kaksi argumenttia');
      }
      return Math.min(...args);
    }
    case 'max': {
      if (args.length < 2) {
        throw new FormulaEvaluationError('max() vaatii vähintään kaksi argumenttia');
      }
      return Math.max(...args);
    }
    case 'round': {
      if (args.length < 1 || args.length > 2) {
        throw new FormulaEvaluationError('round() ottaa 1–2 argumenttia');
      }
      const value = args[0]!;
      const digits = args[1] ?? 0;
      if (!Number.isInteger(digits) || digits < 0 || digits > 10) {
        throw new FormulaEvaluationError('round()-desimaalien on oltava kokonaisluku 0–10');
      }
      const factor = 10 ** digits;
      return Math.round(value * factor) / factor;
    }
    case 'if': {
      if (args.length !== 3) {
        throw new FormulaEvaluationError('if() vaatii kolme argumenttia: if(ehto, sitten, muuten)');
      }
      return args[0]! !== 0 ? args[1]! : args[2]!;
    }
    case 'sqrt': {
      if (args.length !== 1) {
        throw new FormulaEvaluationError('sqrt() ottaa yhden argumentin');
      }
      const value = args[0]!;
      if (value < 0) {
        throw new FormulaEvaluationError('sqrt() ei salli negatiivista lukua');
      }
      return Math.sqrt(value);
    }
    case 'cos': {
      if (args.length !== 1) {
        throw new FormulaEvaluationError('cos() ottaa yhden argumentin (asteina)');
      }
      return Math.cos((args[0]! * Math.PI) / 180);
    }
    case 'liukuva_myyntihinta': {
      if (args.length !== 1) {
        throw new FormulaEvaluationError(
          'liukuva_myyntihinta() ottaa yhden argumentin: suorat kustannukset (alv0)',
        );
      }
      try {
        return slidingSellingPriceAlv0(args[0]!, slidingMarginParamsFromContext(context));
      } catch (error) {
        throw new FormulaEvaluationError(
          error instanceof Error ? error.message : 'Liukuva myyntihinta epäonnistui',
        );
      }
    }
    default:
      throw new FormulaEvaluationError(`Tuntematon funktio: ${name}`);
  }
}

function parseExpression(tokens: Token[], context: Record<string, number>, pos = 0): [number, number] {
  return parseComparison(tokens, context, pos);
}

function parseComparison(
  tokens: Token[],
  context: Record<string, number>,
  pos: number,
): [number, number] {
  let [left, index] = parseAddSub(tokens, context, pos);

  while (index < tokens.length && tokens[index]?.type === 'compare') {
    const op = (tokens[index] as Extract<Token, { type: 'compare' }>).value;
    const [right, nextIndex] = parseAddSub(tokens, context, index + 1);
    left = applyCompare(op, left, right);
    index = nextIndex;
  }

  return [left, index];
}

function parseAddSub(tokens: Token[], context: Record<string, number>, pos: number): [number, number] {
  let [left, index] = parseMulDiv(tokens, context, pos);

  while (index < tokens.length && tokens[index]?.type === 'op') {
    const op = (tokens[index] as Extract<Token, { type: 'op' }>).value;
    if (op !== '+' && op !== '-') break;
    const [right, nextIndex] = parseMulDiv(tokens, context, index + 1);
    left = op === '+' ? left + right : left - right;
    index = nextIndex;
  }

  return [left, index];
}

function parseMulDiv(tokens: Token[], context: Record<string, number>, pos: number): [number, number] {
  let [left, index] = parseUnary(tokens, context, pos);

  while (index < tokens.length && tokens[index]?.type === 'op') {
    const op = (tokens[index] as Extract<Token, { type: 'op' }>).value;
    if (op !== '*' && op !== '/') break;
    const [right, nextIndex] = parseUnary(tokens, context, index + 1);
    if (op === '/' && right === 0) {
      // Tuote valitsematta tai tyhjä menekki: 0, jotta live-laskenta ei heitä joka näppäimellä.
      left = 0;
    } else {
      left = op === '*' ? left * right : left / right;
    }
    index = nextIndex;
  }

  return [left, index];
}

function parseUnary(tokens: Token[], context: Record<string, number>, pos: number): [number, number] {
  if (tokens[pos]?.type === 'op' && (tokens[pos] as Extract<Token, { type: 'op' }>).value === '-') {
    const [value, index] = parseUnary(tokens, context, pos + 1);
    return [-value, index];
  }
  return parsePrimary(tokens, context, pos);
}

function parseArgList(
  tokens: Token[],
  context: Record<string, number>,
  pos: number,
): [number[], number] {
  if (tokens[pos]?.type === 'rparen') {
    return [[], pos];
  }

  const args: number[] = [];
  let index = pos;
  while (true) {
    const [value, nextIndex] = parseExpression(tokens, context, index);
    args.push(value);
    index = nextIndex;
    if (tokens[index]?.type === 'comma') {
      index += 1;
      continue;
    }
    break;
  }
  return [args, index];
}

function parsePrimary(tokens: Token[], context: Record<string, number>, pos: number): [number, number] {
  const token = tokens[pos];
  if (!token) {
    throw new FormulaEvaluationError('Kaava päättyi odottamattomasti');
  }

  if (token.type === 'number') {
    return [token.value, pos + 1];
  }

  if (token.type === 'ident') {
    if (tokens[pos + 1]?.type === 'lparen') {
      if (!FORMULA_FUNCTIONS.has(token.value)) {
        throw new FormulaEvaluationError(`Tuntematon funktio: ${token.value}`);
      }
      const [args, afterArgs] = parseArgList(tokens, context, pos + 2);
      if (tokens[afterArgs]?.type !== 'rparen') {
        throw new FormulaEvaluationError('Puuttuva sulkeva sulku funktiokutsussa');
      }
      return [callFormulaFunction(token.value, args, context), afterArgs + 1];
    }
    return [resolveIdentifier(token.value, context), pos + 1];
  }

  if (token.type === 'lparen') {
    const [value, index] = parseExpression(tokens, context, pos + 1);
    if (tokens[index]?.type !== 'rparen') {
      throw new FormulaEvaluationError('Puuttuva sulkeva sulku');
    }
    return [value, index + 1];
  }

  throw new FormulaEvaluationError('Virheellinen lauseke');
}

export function extractFormulaIdentifiers(formula: string): string[] {
  return cacheGet(identifierCache, formula, TOKEN_CACHE_LIMIT, () => {
    const matches = formula.match(/[a-zA-Z_äöåÄÖÅ][a-zA-Z0-9_äöåÄÖÅ.]*/g) ?? [];
    return [...new Set(matches)].filter((ident) => !FORMULA_FUNCTIONS.has(ident));
  });
}

/** Debug-sijoitus: enintään 2 desimaalia (ei vaikuta laskentaan). */
function formatSubstitutedNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

export function substituteFormula(formula: string, context: Record<string, number>): string {
  return formula.replace(/[a-zA-Z0-9_äöåÄÖÅ.]+/g, (ident) => {
    if (FORMULA_FUNCTIONS.has(ident)) return ident;
    if (ident in context) {
      return formatSubstitutedNumber(context[ident]!);
    }
    return ident;
  });
}

export function evaluateFormula(formula: string, context: Record<string, number>): number {
  const trimmed = formula.trim();
  if (!trimmed) {
    throw new FormulaEvaluationError('Kaava on tyhjä');
  }
  const tokens = tokenize(trimmed);
  const [result, index] = parseExpression(tokens, context, 0);
  if (index !== tokens.length) {
    throw new FormulaEvaluationError('Kaava sisältää ylimääräisiä merkkejä');
  }
  return result;
}
