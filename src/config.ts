export type AppConfig = {
  sourceUrl: string;
  targetUrl: string;
  hmacKey: string;
  rulesPath: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const sourceUrl = env.STAGING_DATA_SOURCE_URL;
  const targetUrl = env.STAGING_DATA_TARGET_URL;
  const hmacKey = env.STAGING_DATA_HMAC_KEY;
  const rulesPath = env.STAGING_DATA_RULES_PATH ?? 'staging-data.rules.json';

  if (!sourceUrl) throw new Error('STAGING_DATA_SOURCE_URL is required');
  if (!targetUrl) throw new Error('STAGING_DATA_TARGET_URL is required');
  if (!hmacKey) throw new Error('STAGING_DATA_HMAC_KEY is required');
  if (hmacKey.length < 16) throw new Error('STAGING_DATA_HMAC_KEY must be at least 16 characters');

  return { sourceUrl, targetUrl, hmacKey, rulesPath };
}
