import { isSimpleAtom, parseUnlockCondition, serializeSexpr, type Sexpr } from './sexpr';

export type UnlockCompareOp = 'gt' | 'ge' | 'lt' | 'le' | 'eq' | 'ne';
export type UnlockSetType = 'puzzles' | 'puzzle-range' | 'round';
export type UnlockValueType = 'number' | 'solved-count';
export type UnlockGateType = 'default' | 'source' | 'and' | 'or' | 'not' | 'solved' | 'all-solved' | 'any-solved' | 'game-started' | 'cmp';

export interface UnlockPuzzleOptionData {
  id: number;
  slug?: string | null;
  title: string;
  game_id?: number;
  round_id?: number;
  sort?: number;
}

export interface UnlockRoundOptionData {
  id: number;
  slug?: string | null;
  title: string;
  game_id?: number;
  sort?: number;
}

export type UnlockSetNode =
  | { type: 'puzzles'; refs: string[] }
  | { type: 'puzzle-range'; start: number; end: number }
  | { type: 'round'; ref: string };

export type UnlockValueNode =
  | { type: 'number'; value: number }
  | { type: 'solved-count'; set: UnlockSetNode };

export type UnlockGateNode =
  | { type: 'default' }
  | { type: 'source'; source: string }
  | { type: 'and' | 'or'; children: UnlockGateNode[] }
  | { type: 'not'; child: UnlockGateNode }
  | { type: 'solved'; ref: string }
  | { type: 'all-solved' | 'any-solved'; set: UnlockSetNode }
  | { type: 'game-started' }
  | { type: 'cmp'; op: UnlockCompareOp; lhs: UnlockValueNode; rhs: UnlockValueNode };

export function unlockPuzzleRef(item: Pick<UnlockPuzzleOptionData, 'id' | 'slug'>) {
  return String(item.id);
}

export function unlockRoundRef(item: Pick<UnlockRoundOptionData, 'id' | 'slug'>) {
  return String(item.id);
}

export function defaultUnlockSet(puzzles: UnlockPuzzleOptionData[] = [], rounds: UnlockRoundOptionData[] = []): UnlockSetNode {
  if (puzzles[0]) {
    return { type: 'puzzles', refs: [unlockPuzzleRef(puzzles[0])] };
  }
  if (rounds[0]) {
    return { type: 'round', ref: unlockRoundRef(rounds[0]) };
  }
  return { type: 'puzzles', refs: [] };
}

export function defaultUnlockValue(): UnlockValueNode {
  return { type: 'number', value: 1 };
}

export function defaultUnlockGate(type: UnlockGateType = 'game-started', puzzles: UnlockPuzzleOptionData[] = [], rounds: UnlockRoundOptionData[] = []): UnlockGateNode {
  const firstPuzzle = puzzles[0] ? unlockPuzzleRef(puzzles[0]) : '';
  const set = defaultUnlockSet(puzzles, rounds);

  switch (type) {
    case 'default':
      return { type: 'default' };
    case 'source':
      return { type: 'source', source: 'default' };
    case 'and':
    case 'or':
      return { type, children: [defaultUnlockGate('game-started', puzzles, rounds)] };
    case 'not':
      return { type: 'not', child: defaultUnlockGate('game-started', puzzles, rounds) };
    case 'solved':
      return { type: 'solved', ref: firstPuzzle };
    case 'all-solved':
    case 'any-solved':
      return { type, set };
    case 'cmp':
      return {
        type: 'cmp',
        op: 'ge',
        lhs: { type: 'solved-count', set },
        rhs: defaultUnlockValue(),
      };
    case 'game-started':
    default:
      return { type: 'game-started' };
  }
}

function atom(value: string | number | undefined) {
  const raw = String(value ?? '').trim();
  return isSimpleAtom(raw) ? raw : '';
}

export function serializeUnlockSet(node: UnlockSetNode): Sexpr | undefined {
  if (node.type === 'puzzles') {
    const refs = node.refs.map(atom).filter(Boolean);
    return refs.length > 0 ? ['puzzles', ...refs] : undefined;
  }

  if (node.type === 'puzzle-range') {
    const start = Math.max(0, Math.trunc(node.start || 0));
    const end = Math.max(0, Math.trunc(node.end || 0));
    return start > 0 && end > 0 ? ['puzzle-range', String(start), String(end)] : undefined;
  }

  const ref = atom(node.ref);
  return ref ? ['round', ref] : undefined;
}

export function serializeUnlockValue(node: UnlockValueNode): Sexpr | undefined {
  if (node.type === 'number') return String(Math.max(0, Math.trunc(node.value || 0)));
  const set = serializeUnlockSet(node.set);
  return set ? ['solved-count', set] : undefined;
}

export function serializeUnlockGate(node: UnlockGateNode): string {
  if (node.type === 'default') return 'default';
  if (node.type === 'source') return node.source.trim();
  if (node.type === 'game-started') return '(game-started)';
  if (node.type === 'solved') {
    const ref = atom(node.ref);
    return ref ? serializeSexpr(['solved', ref]) : '';
  }
  if (node.type === 'all-solved' || node.type === 'any-solved') {
    const set = serializeUnlockSet(node.set);
    return set ? serializeSexpr([node.type, set]) : '';
  }
  if (node.type === 'and' || node.type === 'or') {
    const children = node.children.map(serializeUnlockGate).filter(Boolean);
    return children.length > 0 ? `(${node.type} ${children.join(' ')})` : '';
  }
  if (node.type === 'not') {
    const child = serializeUnlockGate(node.child);
    return child ? serializeSexpr(['not', parseUnlockCondition(child) ?? child]) : '';
  }
  const lhs = serializeUnlockValue(node.lhs);
  const rhs = serializeUnlockValue(node.rhs);
  return lhs && rhs ? serializeSexpr([node.op, lhs, rhs]) : '';
}

function asList(expr: Sexpr | undefined): Sexpr[] | undefined {
  return Array.isArray(expr) ? expr : undefined;
}

function stringArg(value: Sexpr | undefined) {
  return typeof value === 'string' ? value : '';
}

function parseUnlockSet(expr: Sexpr | undefined): UnlockSetNode | undefined {
  const list = asList(expr);
  if (!list || typeof list[0] !== 'string') return undefined;

  if (list[0] === 'puzzles') {
    return { type: 'puzzles', refs: list.slice(1).map(stringArg).filter(Boolean) };
  }
  if (list[0] === 'puzzle-range' && list.length === 3) {
    return { type: 'puzzle-range', start: Number(stringArg(list[1])), end: Number(stringArg(list[2])) };
  }
  if (list[0] === 'round' && list.length === 2) {
    return { type: 'round', ref: stringArg(list[1]) };
  }
  return undefined;
}

function parseUnlockValue(expr: Sexpr | undefined): UnlockValueNode | undefined {
  if (typeof expr === 'string' && /^\d+$/.test(expr)) return { type: 'number', value: Number(expr) };

  const list = asList(expr);
  if (list?.[0] === 'solved-count' && list.length === 2) {
    const set = parseUnlockSet(list[1]);
    return set ? { type: 'solved-count', set } : undefined;
  }

  return undefined;
}

export function parseUnlockGate(value: string): UnlockGateNode {
  if (value === 'default') return { type: 'default' };

  const expr = parseUnlockCondition(value);
  const list = asList(expr);
  if (!list || typeof list[0] !== 'string') return { type: 'source', source: value };

  const [op, ...args] = list;
  if (op === 'game-started' && args.length === 0) return { type: 'game-started' };
  if (op === 'solved' && args.length === 1) return { type: 'solved', ref: stringArg(args[0]) };
  if ((op === 'all-solved' || op === 'any-solved') && args.length === 1) {
    const set = parseUnlockSet(args[0]);
    return set ? { type: op, set } : { type: 'source', source: value };
  }
  if ((op === 'and' || op === 'or') && args.length > 0) {
    return { type: op, children: args.map(arg => serializeSexpr(arg)).map(parseUnlockGate) };
  }
  if (op === 'not' && args.length === 1) {
    return { type: 'not', child: parseUnlockGate(serializeSexpr(args[0])) };
  }
  if (['gt', 'ge', 'lt', 'le', 'eq', 'ne'].includes(op) && args.length === 2) {
    const lhs = parseUnlockValue(args[0]);
    const rhs = parseUnlockValue(args[1]);
    return lhs && rhs ? { type: 'cmp', op: op as UnlockCompareOp, lhs, rhs } : { type: 'source', source: value };
  }

  return { type: 'source', source: value };
}
