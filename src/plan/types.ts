export type CatalogColumn = {
  table: string;
  name: string;
  dataType: string;
  udtName?: string;
  isNullable: boolean;
  ordinalPosition: number;
};

export type CatalogTable = {
  name: string;
  primaryKey: string[];
};

export type ForeignKey = {
  name: string;
  /** Table that holds the FK columns (child). */
  fromTable: string;
  fromColumns: string[];
  /** Referenced table (parent). */
  toTable: string;
  toColumns: string[];
};

export type Catalog = {
  tables: CatalogTable[];
  columns: CatalogColumn[];
  foreignKeys: ForeignKey[];
};

export type RowKey = string;

/** Stable string key for a primary-key value tuple. */
export function encodeRowKey(values: unknown[]): RowKey {
  return JSON.stringify(values);
}

export function decodeRowKey(key: RowKey): unknown[] {
  return JSON.parse(key) as unknown[];
}

export type SubsetSeed = {
  table: string;
  /** Parallel to the table's primaryKey columns. */
  primaryKeyValues: unknown[];
};

export type PlannedTable = {
  table: string;
  rowKeys: RowKey[];
  rowCount: number;
};

export type SubsetPlan = {
  tables: PlannedTable[];
  totalRows: number;
  truncated: boolean;
};
