#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { extractTool } from './tools/extract.js';
import { inspectSchema } from './tools/inspect_schema.js';
import { planSubsetTool } from './tools/plan_subset.js';
import { setRules } from './tools/set_rules.js';
import { verifyTool } from './tools/verify.js';
import { VERSION } from './version.js';

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export function createServer(env: NodeJS.ProcessEnv = process.env): McpServer {
  const server = new McpServer({
    name: 'mcp-staging-data',
    version: VERSION,
  });

  const config = () => loadConfig(env);

  server.registerTool(
    'inspect_schema',
    {
      description:
        'List tables, foreign keys and columns flagged as likely PII. Never returns row values.',
      inputSchema: {},
      annotations: readAnnotations,
    },
    async () => inspectSchema(config()),
  );

  server.registerTool(
    'set_rules',
    {
      description:
        'Set per-column anonymization rules and write staging-data.rules.json in the working directory.',
      inputSchema: {
        columns: z
          .record(
            z.string(),
            z.object({
              type: z.enum(['hash', 'fake_name', 'fake_email', 'fake_phone', 'null', 'keep']),
              reason: z.string().min(1).max(500).optional(),
            }),
          )
          .describe('Map of table.column to rule'),
        replace: z.boolean().optional().describe('Replace the whole rules file instead of merging'),
      },
      annotations: writeAnnotations,
    },
    async args => setRules(config(), args),
  );

  server.registerTool(
    'plan_subset',
    {
      description:
        'Given a root table and primary key, return related tables and row counts for the subset. No row values.',
      inputSchema: {
        table: z.string().min(1).max(128),
        ids: z
          .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
          .min(1)
          .max(16)
          .describe('Primary-key values for the root row'),
        maxRows: z.number().int().positive().max(100_000).optional(),
      },
      annotations: readAnnotations,
    },
    async args => planSubsetTool(config(), { table: args.table, primaryKey: args.ids, maxRows: args.maxRows }),
  );

  server.registerTool(
    'extract',
    {
      description:
        'Copy a planned subset from source to target with in-memory anonymization. Read-only on source. Never returns row values.',
      inputSchema: {
        table: z.string().min(1).max(128),
        ids: z
          .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
          .min(1)
          .max(16)
          .describe('Primary-key values for the root row'),
        maxRows: z.number().int().positive().max(100_000).optional(),
      },
      annotations: writeAnnotations,
    },
    async args => extractTool(config(), { table: args.table, primaryKey: args.ids, maxRows: args.maxRows }),
  );

  server.registerTool(
    'verify',
    {
      description:
        'Check that PII-flagged columns in the target are ruled and look anonymized. Returns only status and column names.',
      inputSchema: {
        tables: z.array(z.string().min(1).max(128)).max(200).optional(),
      },
      annotations: readAnnotations,
    },
    async args => verifyTool(config(), args),
  );

  return server;
}

await createServer().connect(new StdioServerTransport());
