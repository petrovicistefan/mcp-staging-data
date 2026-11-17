import type { Catalog, ForeignKey } from './types.js';

export type FkEdge = ForeignKey & {
  /** Direction relative to walking from a known parent row to child rows. */
  kind: 'parent_to_child' | 'child_to_parent';
};

/**
 * Build adjacency lists for subset walking.
 * - childrenOf[parentTable]: FKs where other tables reference parentTable
 * - parentsOf[childTable]: FKs where childTable references other tables
 */
export function buildFkGraph(catalog: Catalog): {
  childrenOf: Map<string, ForeignKey[]>;
  parentsOf: Map<string, ForeignKey[]>;
  tableNames: Set<string>;
} {
  const childrenOf = new Map<string, ForeignKey[]>();
  const parentsOf = new Map<string, ForeignKey[]>();
  const tableNames = new Set(catalog.tables.map(t => t.name));

  const push = (map: Map<string, ForeignKey[]>, key: string, fk: ForeignKey) => {
    const list = map.get(key);
    if (list) list.push(fk);
    else map.set(key, [fk]);
  };

  for (const fk of catalog.foreignKeys) {
    if (!tableNames.has(fk.fromTable) || !tableNames.has(fk.toTable)) {
      throw new Error(`Foreign key ${fk.name} references unknown table`);
    }
    if (fk.fromColumns.length === 0 || fk.fromColumns.length !== fk.toColumns.length) {
      throw new Error(`Foreign key ${fk.name} has mismatched column lists`);
    }
    push(childrenOf, fk.toTable, fk);
    push(parentsOf, fk.fromTable, fk);
  }

  return { childrenOf, parentsOf, tableNames };
}

/** Topological order for inserts: parents before children. Cycle → error. */
export function insertOrder(catalog: Catalog): string[] {
  const { parentsOf, tableNames } = buildFkGraph(catalog);
  const remaining = new Set(tableNames);
  const ordered: string[] = [];

  while (remaining.size > 0) {
    const ready: string[] = [];
    for (const table of remaining) {
      const parents = parentsOf.get(table) ?? [];
      const blocked = parents.some(fk => remaining.has(fk.toTable) && fk.toTable !== table);
      if (!blocked) ready.push(table);
    }
    if (ready.length === 0) {
      throw new Error(`FK cycle detected among: ${[...remaining].sort().join(', ')}`);
    }
    ready.sort();
    for (const table of ready) {
      remaining.delete(table);
      ordered.push(table);
    }
  }
  return ordered;
}
