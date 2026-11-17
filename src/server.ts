#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VERSION } from './version.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mcp-staging-data',
    version: VERSION,
  });
  // Tools are registered in milestone 4.
  return server;
}

await createServer().connect(new StdioServerTransport());
