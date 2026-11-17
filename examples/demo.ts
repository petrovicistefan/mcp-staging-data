/**
 * Demo against docker-compose.test.yml + test/fixtures (fake data only).
 *
 *   docker compose -f docker-compose.test.yml up -d
 *   npm run build && npm run demo
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.ts';
import { openTarget } from '../src/db/target.ts';
import { extractTool } from '../src/tools/extract.ts';
import { inspectSchema } from '../src/tools/inspect_schema.ts';
import { planSubsetTool } from '../src/tools/plan_subset.ts';
import { verifyTool } from '../src/tools/verify.ts';
import { resetDatabase, SOURCE_URL, TARGET_URL, waitForPostgres } from '../test/integration/helpers.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rulesPath = join(root, 'test/fixtures/rules.json');
const HMAC = 'demo-hmac-key-not-for-production';

async function main() {
  await waitForPostgres(SOURCE_URL);
  await waitForPostgres(TARGET_URL);
  await resetDatabase(SOURCE_URL, true);
  await resetDatabase(TARGET_URL, false);

  const config = loadConfig({
    STAGING_DATA_SOURCE_URL: SOURCE_URL,
    STAGING_DATA_TARGET_URL: TARGET_URL,
    STAGING_DATA_HMAC_KEY: HMAC,
    STAGING_DATA_RULES_PATH: rulesPath,
  });

  console.log('1) inspect_schema');
  const schema = await inspectSchema(config);
  if (schema.isError) throw new Error(schema.content[0]?.text);
  const piiCount = (schema.structuredContent as { piiColumns: unknown[] }).piiColumns.length;
  console.log(`   PII-flagged columns: ${piiCount} (no row values returned)`);

  console.log('2) plan_subset orders ids=[10]');
  const plan = await planSubsetTool(config, { table: 'orders', primaryKey: [10] });
  if (plan.isError) throw new Error(plan.content[0]?.text);
  const planBody = plan.structuredContent as { totalRows: number };
  console.log(`   totalRows=${planBody.totalRows}`);

  console.log('3) extract');
  const extracted = await extractTool(config, { table: 'orders', primaryKey: [10] });
  if (extracted.isError) throw new Error(extracted.content[0]?.text);
  const extractedBody = extracted.structuredContent as { inserted: Record<string, number> };
  console.log(`   inserted=${JSON.stringify(extractedBody.inserted)}`);

  console.log('4) verify');
  const verified = await verifyTool(config, {});
  if (verified.isError) throw new Error(verified.content[0]?.text);
  const verifyBody = verified.structuredContent as { ok: boolean };
  if (!verifyBody.ok) throw new Error(`verify failed: ${verified.content[0]?.text}`);
  console.log('   ok=true');

  const target = await openTarget(TARGET_URL);
  try {
    const rows = await target.query('SELECT email, full_name FROM users');
    const email = rows.rows[0]?.email;
    const name = rows.rows[0]?.full_name;
    if (email === 'alice@corp.example' || name === 'Alice Example') {
      throw new Error('demo failed: clear fixture PII found in target');
    }
    console.log('5) target spot-check: source emails/names are gone');
  } finally {
    await target.end();
  }

  console.log('Demo OK.');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
