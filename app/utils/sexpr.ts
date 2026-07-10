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

function refLabel(value: Sexpr) {
  if (typeof value !== 'string') return undefined;
  if (/^\d+$/.test(value)) return `#${value}`;
  return `「${value}」`;
}

function joinLabels(items: string[]) {
  if (items.length <= 2) return items.join('、');
  return `${items.slice(0, -1).join('、')}、${items.at(-1)}`;
}

function setLabel(expr: Sexpr) {
  if (!Array.isArray(expr) || typeof expr[0] !== 'string') return undefined;

  if (expr[0] === 'puzzles') {
    const labels = expr.slice(1).map(refLabel);
    if (labels.some(label => !label)) return undefined;
    return `谜题 ${joinLabels(labels as string[])}`;
  }

  if (expr[0] === 'puzzle-range' && expr.length === 3) {
    const start = refLabel(expr[1]);
    const end = refLabel(expr[2]);
    return start && end ? `谜题 ${start} 到 ${end}` : undefined;
  }

  if (expr[0] === 'round' && expr.length === 2) {
    const round = refLabel(expr[1]);
    return round ? `区域 ${round}` : undefined;
  }

  return undefined;
}

function countComparisonText(op: string, lhs: Sexpr, rhs: Sexpr) {
  if (!Array.isArray(lhs) || lhs[0] !== 'solved-count' || lhs.length !== 2 || typeof rhs !== 'string') {
    return undefined;
  }

  const scope = setLabel(lhs[1]);
  if (!scope || !/^\d+$/.test(rhs)) return undefined;

  const opText: Record<string, string> = {
    gt: `超过 ${rhs}`,
    ge: `至少 ${rhs}`,
    lt: `少于 ${rhs}`,
    le: `至多 ${rhs}`,
    eq: `恰好 ${rhs}`,
    ne: `不是 ${rhs}`,
  };

  return opText[op] ? `${scope} 解出 ${opText[op]} 题` : undefined;
}

function translateSexpr(expr: Sexpr): string | undefined {
  if (!Array.isArray(expr) || typeof expr[0] !== 'string') return undefined;

  const [op, ...args] = expr;
  if (op === 'game-started' && args.length === 0) return '队伍开始比赛';

  if (op === 'solved' && args.length === 1) {
    const puzzle = refLabel(args[0]);
    return puzzle ? `解出谜题 ${puzzle}` : undefined;
  }

  if ((op === 'all-solved' || op === 'any-solved') && args.length === 1) {
    const scope = setLabel(args[0]);
    if (!scope) return undefined;
    return op === 'all-solved' ? `解出全部 ${scope}` : `解出任意一个 ${scope}`;
  }

  if (['gt', 'ge', 'lt', 'le', 'eq', 'ne'].includes(op) && args.length === 2) {
    return countComparisonText(op, args[0], args[1]);
  }

  if ((op === 'and' || op === 'or') && args.length > 0 && args.length <= 3) {
    const parts = args.map(translateSexpr);
    if (parts.some(part => !part)) return undefined;
    return parts.join(op === 'and' ? '，且 ' : '，或 ');
  }

  return undefined;
}

export function translateUnlockCondition(value: string) {
  if (value === 'default') return '默认解锁';

  const parsed = parseUnlockCondition(value);
  return parsed ? (translateSexpr(parsed) ?? value) : value;
}
