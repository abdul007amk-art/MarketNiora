/**
 * CHUNK 6 — circular dependency / unversioned integration guard.
 */
export type OceGraph = Record<string, string[]>;

export function findOceCycles(graph: OceGraph): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(node: string): void {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      cycles.push([...path.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    path.push(node);
    for (const next of graph[node] ?? []) visit(next);
    path.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of Object.keys(graph)) visit(node);
  return cycles;
}

export function validateOceAcyclic(graph: OceGraph): string[] {
  const cycles = findOceCycles(graph);
  return cycles.length === 0
    ? []
    : cycles.map((cycle) => `circular dependency: ${cycle.join(' -> ')}`);
}

export function validateVersionPinnedIntegration(methodologyVersion: string): string[] {
  return methodologyVersion.trim()
    ? []
    : ['integration methodologyVersion is required'];
}
