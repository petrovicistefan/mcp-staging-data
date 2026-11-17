import { buildFkGraph } from './graph.js';
import {
  encodeRowKey,
  type Catalog,
  type ForeignKey,
  type PlannedTable,
  type RowKey,
  type SubsetPlan,
  type SubsetSeed,
} from './types.js';

export type RowLookup = {
  /** Primary-key tuples for rows matching equality filters (AND across columns). */
  findKeys(table: string, equals: Record<string, unknown>): Promise<unknown[][]> | unknown[][];
  /** Column values for one row identified by primary key. */
  getColumns(
    table: string,
    primaryKeyValues: unknown[],
    columns: string[],
  ): Promise<(unknown | null)[]> | (unknown | null)[];
};

export type PlanSubsetOptions = {
  catalog: Catalog;
  seeds: SubsetSeed[];
  lookup: RowLookup;
  maxRows?: number;
};

async function awaitable<T>(value: Promise<T> | T): Promise<T> {
  return value;
}

type QueueItem = {
  table: string;
  pkValues: unknown[];
  /** When false, row was pulled only as an FK parent — do not expand its other children. */
  expandChildren: boolean;
};

/**
 * Walk the FK graph from seeds.
 * - Always include referenced parents (FK integrity).
 * - Include referencing children only from seeds and their descendants, not from
 *   parents that were pulled solely for integrity (avoids sibling explosion).
 * Cycle-safe via visited (table, rowKey).
 */
export async function planSubset(options: PlanSubsetOptions): Promise<SubsetPlan> {
  const maxRows = options.maxRows ?? 5_000;
  const { childrenOf, parentsOf, tableNames } = buildFkGraph(options.catalog);
  const pkByTable = new Map(options.catalog.tables.map(t => [t.name, t.primaryKey]));

  const selected = new Map<string, Set<RowKey>>();
  let totalRows = 0;
  let truncated = false;
  const queue: QueueItem[] = [];

  const enqueue = (table: string, pkValues: unknown[], expandChildren: boolean) => {
    if (!tableNames.has(table)) throw new Error(`Unknown table: ${table}`);
    const rowKey = encodeRowKey(pkValues);
    let set = selected.get(table);
    if (!set) {
      set = new Set();
      selected.set(table, set);
    }
    if (set.has(rowKey)) return;
    if (totalRows >= maxRows) {
      truncated = true;
      return;
    }
    set.add(rowKey);
    totalRows += 1;
    queue.push({ table, pkValues, expandChildren });
  };

  for (const seed of options.seeds) {
    const pk = pkByTable.get(seed.table);
    if (!pk || pk.length === 0) throw new Error(`Table ${seed.table} has no primary key`);
    if (seed.primaryKeyValues.length !== pk.length) {
      throw new Error(
        `Seed for ${seed.table} has ${seed.primaryKeyValues.length} values, pk needs ${pk.length}`,
      );
    }
    enqueue(seed.table, seed.primaryKeyValues, true);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { table, pkValues, expandChildren } = current;

    for (const fk of parentsOf.get(table) ?? []) {
      if (truncated) break;
      await visitParent(options.lookup, pkByTable, enqueue, table, pkValues, fk);
    }

    if (!expandChildren) continue;

    for (const fk of childrenOf.get(table) ?? []) {
      if (truncated) break;
      await visitChildren(options.lookup, pkByTable, enqueue, table, pkValues, fk);
    }
  }

  const tables: PlannedTable[] = [...selected.entries()]
    .map(([table, keys]) => ({
      table,
      rowKeys: [...keys].sort(),
      rowCount: keys.size,
    }))
    .sort((a, b) => a.table.localeCompare(b.table));

  return { tables, totalRows, truncated };
}

async function visitParent(
  lookup: RowLookup,
  pkByTable: Map<string, string[]>,
  enqueue: (table: string, pkValues: unknown[], expandChildren: boolean) => void,
  childTable: string,
  childPkValues: unknown[],
  fk: ForeignKey,
): Promise<void> {
  const parentPk = pkByTable.get(fk.toTable);
  if (!parentPk) return;

  const fkValues = await awaitable(lookup.getColumns(childTable, childPkValues, fk.fromColumns));
  if (fkValues.some(v => v === null || v === undefined)) return;

  if (fk.toColumns.length === parentPk.length && fk.toColumns.every((c, i) => c === parentPk[i])) {
    enqueue(fk.toTable, fkValues, false);
    return;
  }

  const equals: Record<string, unknown> = {};
  fk.toColumns.forEach((col, i) => {
    equals[col] = fkValues[i]!;
  });
  const keys = await awaitable(lookup.findKeys(fk.toTable, equals));
  for (const key of keys) enqueue(fk.toTable, key, false);
}

async function visitChildren(
  lookup: RowLookup,
  pkByTable: Map<string, string[]>,
  enqueue: (table: string, pkValues: unknown[], expandChildren: boolean) => void,
  parentTable: string,
  parentPkValues: unknown[],
  fk: ForeignKey,
): Promise<void> {
  const parentPk = pkByTable.get(parentTable);
  if (!parentPk) return;

  const equals: Record<string, unknown> = {};
  let resolved = true;
  for (let i = 0; i < fk.toColumns.length; i++) {
    const toCol = fk.toColumns[i]!;
    const fromCol = fk.fromColumns[i]!;
    const pkIdx = parentPk.indexOf(toCol);
    if (pkIdx < 0) {
      resolved = false;
      break;
    }
    equals[fromCol] = parentPkValues[pkIdx]!;
  }

  if (!resolved) {
    const vals = await awaitable(lookup.getColumns(parentTable, parentPkValues, fk.toColumns));
    fk.fromColumns.forEach((fromCol, j) => {
      equals[fromCol] = vals[j]!;
    });
  }

  const keys = await awaitable(lookup.findKeys(fk.fromTable, equals));
  for (const key of keys) enqueue(fk.fromTable, key, true);
}
