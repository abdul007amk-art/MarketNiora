/**
 * CHUNK 5 — executable integration-graph circular dependency guard.
 *
 * A production dependency graph is represented as consumer -> dependencies.
 * Any directed cycle is rejected; acyclic graphs are accepted.
 */
export interface EbiGraph {
  [consumer: string]: string[];
}

export function findCircularDependencies(graph: EbiGraph): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    stack.push(node);

    for (const dependency of graph[node] ?? []) {
      dfs(dependency);
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of Object.keys(graph)) {
    dfs(node);
  }

  return cycles;
}

export function validateAcyclicEbiGraph(graph: EbiGraph): string[] {
  return findCircularDependencies(graph).map(
    (cycle) => `circular EBI dependency detected: ${cycle.join(' -> ')}`,
  );
}
