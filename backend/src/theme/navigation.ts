/** CHUNK 7 — THEME-INPUT-1.1 progressive navigation contract. */
import { THEME_HIERARCHY, type ThemeLevel, type ThemeNode } from './types.ts';

export const STOCK_RETRIEVAL_SCOPE_LEVELS: readonly ThemeLevel[] = ['THEME','SUB_THEME','INDUSTRY','VALUE_CHAIN','COMPANY'];
const PARENT_LEVEL: ReadonlyMap<ThemeLevel, ThemeLevel|null> = new Map([
  ['THEME', null], ['SUB_THEME', 'THEME'], ['INDUSTRY', 'SUB_THEME'], ['VALUE_CHAIN', 'INDUSTRY'], ['COMPANY', 'VALUE_CHAIN'], ['STOCK', 'COMPANY'],
]);

export function canRetrieveStocksAtLevel(level: ThemeLevel): boolean { return STOCK_RETRIEVAL_SCOPE_LEVELS.includes(level); }
export function validateNavigationScope(level: ThemeLevel, nodeId: string): string[] {
  const errors: string[] = [];
  if (!THEME_HIERARCHY.includes(level)) errors.push('invalid theme navigation level');
  if (!nodeId.trim()) errors.push('resolved navigation nodeId is required');
  if (!canRetrieveStocksAtLevel(level)) errors.push('STOCK is an instrument leaf, not a stock-retrieval parent scope');
  return [...new Set(errors)];
}

/** Validates the actual resolved parent chain; IDs alone are not accepted as proof of parent context. */
export function validateResolvedNavigationScope(level: ThemeLevel, nodeId: string, resolvedNodes: ReadonlyMap<string, ThemeNode>): string[] {
  const errors = validateNavigationScope(level, nodeId);
  if (errors.length > 0) return errors;
  const node = resolvedNodes.get(nodeId);
  if (!node) return ['resolved navigation node does not exist'];
  if (node.level !== level) return [`resolved navigation node level must be ${level}`];
  let current: ThemeNode = node;
  let expectedParent = PARENT_LEVEL.get(level);
  while (expectedParent !== null && expectedParent !== undefined) {
    if (!current.parentNodeId?.trim()) { errors.push(`${current.level} requires resolved parent context`); break; }
    const parent = resolvedNodes.get(current.parentNodeId);
    if (!parent) { errors.push(`resolved ${expectedParent} parent does not exist`); break; }
    if (parent.level !== expectedParent) { errors.push(`resolved parent level must be ${expectedParent}`); break; }
    current = parent;
    expectedParent = PARENT_LEVEL.get(current.level);
  }
  return [...new Set(errors)];
}

/** Legacy depth helper retained for compatibility; resolved-node callers should use validateResolvedNavigationScope. */
export function assertNoFabricatedParentContext(requestedLevel: ThemeLevel, resolvedParentIds: readonly string[]): string[] {
  const expectedDepth = THEME_HIERARCHY.indexOf(requestedLevel);
  if (expectedDepth <= 0) return [];
  return resolvedParentIds.length >= expectedDepth ? [] : [`${requestedLevel} navigation requires resolved parent context`];
}