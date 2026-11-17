export type DbEndpoint = {
  host: string;
  port: number;
  database: string;
};

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Normalize a Postgres connection string into host/port/database for comparison.
 * Host aliases for loopback are collapsed so localhost and 127.0.0.1 compare equal.
 */
export function parseEndpoint(connectionString: string): DbEndpoint {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Invalid database connection string');
  }

  if (!/^postgres(ql)?:$/i.test(url.protocol)) {
    throw new Error('Database URL must use the postgres or postgresql scheme');
  }

  const hostRaw = (url.hostname || 'localhost').toLowerCase();
  const host = LOOPBACK.has(hostRaw) ? '127.0.0.1' : hostRaw;
  const port = url.port ? Number(url.port) : 5432;
  const database = decodeURIComponent((url.pathname || '/').replace(/^\//, ''));
  if (!database) throw new Error('Database URL is missing a database name');

  return { host, port, database };
}

export function endpointsEqual(a: DbEndpoint, b: DbEndpoint): boolean {
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

/** Refuse when source and target resolve to the same host+port+database. */
export function assertSourceTargetDistinct(sourceUrl: string, targetUrl: string): void {
  const source = parseEndpoint(sourceUrl);
  const target = parseEndpoint(targetUrl);
  if (endpointsEqual(source, target)) {
    throw new Error('Source and target must be different databases (host, port, and database)');
  }
}
