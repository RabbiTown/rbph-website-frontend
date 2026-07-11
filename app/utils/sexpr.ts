export type Sexpr = string | Sexpr[];

function tokenizeSexpr(input: string) {
  return input.match(/\(|\)|[^\s()]+/g) ?? [];
}

function parseSexpr(tokens: string[], index = 0): [Sexpr, number] {
  const token = tokens[index];
  if (!token) throw new Error('unexpected end');

  if (token !== '(') return [token, index + 1];

  const items: Sexpr[] = [];
  let next = index + 1;
  while (tokens[next] !== ')') {
    if (next >= tokens.length) throw new Error('missing close paren');
    const [item, used] = parseSexpr(tokens, next);
    items.push(item);
    next = used;
  }

  return [items, next + 1];
}

export function parseUnlockCondition(input: string) {
  const tokens = tokenizeSexpr(input.trim());
  if (tokens.length === 0) return undefined;

  try {
    const [expr, used] = parseSexpr(tokens);
    return used === tokens.length ? expr : undefined;
  } catch {
    return undefined;
  }
}

export function serializeSexpr(expr: Sexpr): string {
  if (typeof expr === 'string') return expr;
  return `(${expr.map(serializeSexpr).join(' ')})`;
}

export function isSimpleAtom(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

function refLabel(value: Sexpr, t: Translate) {
  if (typeof value !== 'string') return undefined;
  return /^\d+$/.test(value)
    ? t('components.unlockConditionPreview.numericReference', { value })
    : t('components.unlockConditionPreview.namedReference', { value });
}

function setLabel(expr: Sexpr, t: Translate) {
  if (!Array.isArray(expr) || typeof expr[0] !== 'string') return undefined;

  if (expr[0] === 'puzzles') {
    const labels = expr.slice(1).map(value => refLabel(value, t));
    if (labels.some(label => !label)) return undefined;
    return t('components.unlockConditionPreview.puzzleSet', { items: labels });
  }

  if (expr[0] === 'puzzle-range' && expr.length === 3) {
    const start = refLabel(expr[1], t);
    const end = refLabel(expr[2], t);
    return start && end ? t('components.unlockConditionPreview.puzzleRange', { start, end }) : undefined;
  }

  if (expr[0] === 'round' && expr.length === 2) {
    const round = refLabel(expr[1], t);
    return round ? t('components.unlockConditionPreview.round', { round }) : undefined;
  }

  return undefined;
}

function countComparisonText(op: string, lhs: Sexpr, rhs: Sexpr, t: Translate) {
  if (!Array.isArray(lhs) || lhs[0] !== 'solved-count' || lhs.length !== 2 || typeof rhs !== 'string') {
    return undefined;
  }

  const scope = setLabel(lhs[1], t);
  if (!scope || !/^\d+$/.test(rhs)) return undefined;

  return ['gt', 'ge', 'lt', 'le', 'eq', 'ne'].includes(op)
    ? t(`components.unlockConditionPreview.comparison.${op}`, { scope, count: rhs })
    : undefined;
}

function translateSexpr(expr: Sexpr, t: Translate): string | undefined {
  if (!Array.isArray(expr) || typeof expr[0] !== 'string') return undefined;

  const [op, ...args] = expr;
  if (op === 'game-started' && args.length === 0) return t('components.unlockConditionPreview.gameStarted');

  if (op === 'solved' && args.length === 1) {
    const puzzle = refLabel(args[0], t);
    return puzzle ? t('components.unlockConditionPreview.solvedPuzzle', { puzzle }) : undefined;
  }

  if ((op === 'all-solved' || op === 'any-solved') && args.length === 1) {
    const scope = setLabel(args[0], t);
    if (!scope) return undefined;
    return t(`components.unlockConditionPreview.${op === 'all-solved' ? 'allSolved' : 'anySolved'}`, { scope });
  }

  if (['gt', 'ge', 'lt', 'le', 'eq', 'ne'].includes(op) && args.length === 2) {
    return countComparisonText(op, args[0], args[1], t);
  }

  if ((op === 'and' || op === 'or') && args.length > 0 && args.length <= 3) {
    const parts = args.map(arg => translateSexpr(arg, t));
    if (parts.some(part => !part)) return undefined;
    return t(`components.unlockConditionPreview.${op}`, { parts });
  }

  return undefined;
}

export function translateUnlockCondition(value: string, t: Translate) {
  if (value === 'default') return t('components.unlockConditionPreview.default');

  const parsed = parseUnlockCondition(value);
  return parsed ? (translateSexpr(parsed, t) ?? value) : value;
}
