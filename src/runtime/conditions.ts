import type { CompareOp, Condition } from '../model/types';
import type { VarStore } from './env';

export const COMPARE_OPS: Record<CompareOp, { label: string; symbol: string; test(a: number, b: number): boolean }> = {
  eq: { label: 'is exactly', symbol: '=', test: (a, b) => a === b },
  neq: { label: 'is not', symbol: '≠', test: (a, b) => a !== b },
  gt: { label: 'is more than', symbol: '>', test: (a, b) => a > b },
  gte: { label: 'is at least', symbol: '≥', test: (a, b) => a >= b },
  lt: { label: 'is less than', symbol: '<', test: (a, b) => a < b },
  lte: { label: 'is at most', symbol: '≤', test: (a, b) => a <= b },
};

export function evaluateCondition(c: Condition, vars: VarStore): boolean {
  if (c.type !== 'variable') return true;
  const op = COMPARE_OPS[c.op];
  if (!op) return true;
  return op.test(vars.get(c.variableId), Number(c.value) || 0);
}
