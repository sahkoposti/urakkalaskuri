export class FormulaEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaEvaluationError';
  }
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  min: (args) => {
    if (args.length === 0) {
      throw new FormulaEvaluationError('min() tarvitsee vähintään yhden argumentin');
    }
    return Math.min(...args);
  },
  max: (args) => {
    if (args.length === 0) {
      throw new FormulaEvaluationError('max() tarvitsee vähintään yhden argumentin');
    }
    return Math.max(...args);
  },
  round: (args) => {
    if (args.length === 1) {
      return Math.round(args[0]!);
    }
    if (args.length === 2) {
      const digits = args[1]!;
      const factor = 10 ** digits;
      return Math.round(args[0]! * factor) / factor;
    }
    throw new FormulaEvaluationError('round() ottaa 1–2 argumenttia');
  },
};

function tokenize(expression: string): Token[] {
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
    if (char === ',' || char === ';') {
      tokens.push({ type: 'comma' });
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
      while (i < input.length && /[0-9.]/.test(input[i]!)) {
        raw += input[i];
        i += 1;
      }
      const value = Number.parseFloat(raw.replace(',', '.'));
      if (!Number.isFinite(value)) {
        throw new FormulaEvaluationError(`Virheellinen luku: ${raw}`);
      }
      tokens.push({ type: 'number', value });
      continue;
    }

    if (/[a-zA-Z0-9_äöåÄÖÅ.]/.test(char)) {
      let raw = '';
      while (i < input.length && /[a-zA-Z0-9_äöåÄÖÅ.]/.test(input[i]!)) {
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

function resolveIdentifier(name: string, context: Record<string, number>): number {
  if (name in context) {
    return context[name]!;
  }
  throw new FormulaEvaluationError(`Tuntematon muuttuja: ${name}`);
}

function parseExpression(tokens: Token[], context: Record<string, number>, pos = 0): [number, number] {
  return parseAddSub(tokens, context, pos);
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
      throw new FormulaEvaluationError('Jako nollalla');
    }
    left = op === '*' ? left * right : left / right;
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
    return [[], pos + 1];
  }

  const args: number[] = [];
  let index = pos;
  while (true) {
    const [value, next] = parseExpression(tokens, context, index);
    args.push(value);
    if (tokens[next]?.type === 'comma') {
      index = next + 1;
      continue;
    }
    if (tokens[next]?.type === 'rparen') {
      return [args, next + 1];
    }
    throw new FormulaEvaluationError('Puuttuva sulkeva sulku tai pilkku');
  }
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
      const fn = FUNCTIONS[token.value];
      if (!fn) {
        throw new FormulaEvaluationError(`Tuntematon funktio: ${token.value}`);
      }
      const [args, index] = parseArgList(tokens, context, pos + 2);
      return [fn(args), index];
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

export function substituteFormula(formula: string, context: Record<string, number>): string {
  return formula.replace(/[a-zA-Z_äöåÄÖÅ][a-zA-Z0-9_äöåÄÖÅ.]*/g, (ident) => {
    if (ident in context) {
      return String(context[ident]);
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
