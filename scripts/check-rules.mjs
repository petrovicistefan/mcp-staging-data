#!/usr/bin/env node
// Automated checks for the hard rules in AGENTS.md. Exit code 1 on any violation.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = {
  srcExt: '.ts',
  versionModule: 'src/version.ts',
  serverEntries: ['src/server.ts'],
  stdioFiles: ['src/server.ts'],
  // Opt-in hosted path only (added later if needed).
  networkFiles: ['src/hosted.ts', 'src/control-plane-client.ts'],
  // Only src/db/ may import pg or open Postgres connections.
  dbDir: 'src/db',
  cliOutputFiles: [],
};

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const fail = (rule, message) => errors.push(`[${rule}] ${message}`);
const readText = path => readFileSync(join(root, path), 'utf8');
const readJson = path => JSON.parse(readText(path));

function walk(dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const name of readdirSync(abs)) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel));
    else if (rel.endsWith(CONFIG.srcExt)) out.push(rel);
  }
  return out;
}

const stripComments = text =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const stripStrings = text =>
  text.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, '""');

const pkg = readJson('package.json');
const server = readJson('server.json');
const sources = walk('src').map(file => ({ file, text: readText(file) }));

// 1. version sync
if (!pkg.version) fail('version-sync', 'package.json has no version');
if (server.version !== pkg.version) {
  fail('version-sync', `server.json version ${server.version} !== package.json ${pkg.version}`);
}
if (!Array.isArray(server.packages) || server.packages.length === 0) {
  fail('version-sync', 'server.json has no packages[]');
}
for (const [i, entry] of (server.packages ?? []).entries()) {
  if (entry.version !== pkg.version) {
    fail('version-sync', `server.json packages[${i}].version ${entry.version} !== package.json ${pkg.version}`);
  }
}

// 2. package.json is the only version source for serverInfo
if (!existsSync(join(root, CONFIG.versionModule))) {
  fail('version-source', `${CONFIG.versionModule} is missing`);
} else {
  const text = stripComments(readText(CONFIG.versionModule));
  if (!/package\.json/.test(text) || !/readFileSync|createRequire/.test(text) || !/export\s+const\s+VERSION\b/.test(text)) {
    fail('version-source', `${CONFIG.versionModule} must read package.json and export VERSION`);
  }
}
for (const entry of CONFIG.serverEntries) {
  if (!existsSync(join(root, entry))) {
    fail('version-source', `${entry} is missing`);
    continue;
  }
  const text = stripComments(readText(entry));
  if (!/from\s+['"]\.\/version\.(?:js|ts)['"]/.test(text) || !/\bversion\s*:\s*VERSION\b/.test(text)) {
    fail('version-source', `${entry} must import VERSION from ./version and use it for serverInfo`);
  }
}
for (const { file, text } of sources) {
  const code = stripComments(text);
  if (/\bversion\s*:\s*['"`]\d+\.\d+\.\d+/.test(code)) {
    fail('hardcoded-version', `${file} has a hardcoded version literal`);
  }
  if (pkg.version && (code.includes(`'${pkg.version}'`) || code.includes(`"${pkg.version}"`))) {
    fail('hardcoded-version', `${file} contains the package version "${pkg.version}" as a string literal`);
  }
}

// 3. required project docs and scripts
for (const doc of ['AGENTS.md', 'docs/PRODUCT.md', 'docs/DECISIONS.md', 'CHANGELOG.md']) {
  if (!existsSync(join(root, doc))) fail('docs', `${doc} is missing`);
}
if (existsSync(join(root, 'CHANGELOG.md'))) {
  const changelog = readText('CHANGELOG.md');
  const escaped = pkg.version.replace(/\./g, '\\.');
  if (!new RegExp(`^##\\s+(?:Unreleased|\\[?${escaped}\\]?)\\b`, 'mi').test(changelog)) {
    fail('docs', `CHANGELOG.md has no "Unreleased" or "${pkg.version}" heading`);
  }
}
for (const script of ['check', 'check:rules', 'test', 'test:integration', 'build', 'prepublishOnly']) {
  if (!pkg.scripts?.[script]) fail('scripts', `package.json is missing the "${script}" script`);
}
for (const part of ['check:rules', 'test']) {
  if (pkg.scripts?.prepublishOnly && !pkg.scripts.prepublishOnly.includes(part)) {
    fail('scripts', `prepublishOnly does not run "${part}"`);
  }
}

// 4. no telemetry; network only in opt-in hosted files (and pg only via src/db/)
const TELEMETRY =
  /posthog|mixpanel|segment\.(?:io|com)|@segment|amplitude|sentry|datadog|newrelic|applicationinsights|google-analytics|googletagmanager|plausible|hotjar|rudderstack|logrocket|bugsnag|telemetry|analytics/i;
const allDeps = Object.keys({
  ...pkg.dependencies,
  ...pkg.devDependencies,
  ...pkg.optionalDependencies,
  ...pkg.peerDependencies,
});
for (const dep of allDeps) {
  if (TELEMETRY.test(dep)) fail('no-telemetry', `dependency "${dep}" looks like telemetry/analytics`);
}
const NETWORK =
  /\bfetch\s*\(|from\s+['"](?:node:)?(?:https?|net|tls|dgram|http2)['"]|require\(\s*['"](?:node:)?(?:https?|net|tls|dgram|http2)['"]\s*\)|\bXMLHttpRequest\b|\bWebSocket\b/;
for (const { file, text } of sources) {
  const code = stripComments(text);
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    if (
      TELEMETRY.test(stripStrings(line)) ||
      /https?:\/\/[^'"`\s]*(?:posthog|mixpanel|segment|amplitude|sentry|datadog|google-analytics)/i.test(line)
    ) {
      fail('no-telemetry', `${file}:${i + 1} references telemetry/analytics`);
    }
  });
  if (!CONFIG.networkFiles.includes(file) && NETWORK.test(code)) {
    fail(
      'local-first',
      `${file} uses the network but is not an opt-in hosted file (${CONFIG.networkFiles.join(', ')})`,
    );
  }
}

// 5. only src/db/ may import pg
const PG_IMPORT = /from\s+['"]pg['"]|require\(\s*['"]pg['"]\s*\)|from\s+['"]pg\//;
for (const { file, text } of sources) {
  if (file.startsWith(`${CONFIG.dbDir}/`)) continue;
  if (PG_IMPORT.test(stripComments(text))) {
    fail('db-boundary', `${file} imports pg; only ${CONFIG.dbDir}/ may open database connections`);
  }
}

// 6. no connection-string / secret fields in tool input schemas
const FORBIDDEN_TOOL_FIELD = /['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*:|(?:^\s*|[,{]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/gm;
const FORBIDDEN_NAME = /url|dsn|conn|host|password|secret|key/i;
for (const { file, text } of sources) {
  if (!/registerTool\s*\(/.test(text)) continue;
  const code = stripComments(text);
  // Look at inputSchema blocks roughly: capture identifiers used as schema keys near registerTool.
  for (const match of code.matchAll(/registerTool\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([\s\S]*?)\}\s*,/g)) {
    const toolName = match[1];
    const config = match[2];
    const schemaSlice = config.match(/inputSchema\s*:\s*\{([\s\S]*)/);
    if (!schemaSlice) continue;
    const body = schemaSlice[1];
    let depth = 1;
    let end = 0;
    for (; end < body.length; end++) {
      if (body[end] === '{') depth++;
      else if (body[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const schemaBody = body.slice(0, end);
    for (const field of schemaBody.matchAll(FORBIDDEN_TOOL_FIELD)) {
      const name = field[1] || field[2];
      if (name && FORBIDDEN_NAME.test(name)) {
        fail(
          'no-conn-in-tools',
          `${file} tool "${toolName}" inputSchema field "${name}" looks like a connection/secret (use env vars)`,
        );
      }
    }
  }
}

// 7. no secrets / row data in logs; stdio files must not console.*
function callArguments(text, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return text.slice(openIndex + 1, i);
  }
  return text.slice(openIndex + 1);
}
const SENSITIVE =
  /secret|token|api[_-]?key|apikey|password|passwd|authorization|credential|header|body|process\.env|\breq\b|\brequest\b|\bargs?\b|\binput\b|\bsql\b|\bplan\b|payload|\brecords?\b|\bspec\b|\brow\b|\brows\b|\bemail\b|\bhmac\b/i;
for (const { file, text } of sources) {
  const code = stripComments(text);
  for (const match of code.matchAll(/\bconsole\.(\w+)\s*\(/g)) {
    const line = code.slice(0, match.index).split('\n').length;
    const method = match[1];
    const args = callArguments(code, match.index + match[0].length - 1);
    if (CONFIG.stdioFiles.includes(file)) {
      fail('no-secrets-in-logs', `${file}:${line} console.${method} in a stdio protocol file`);
    } else if (
      ['log', 'info', 'debug'].includes(method) &&
      !CONFIG.cliOutputFiles.includes(file) &&
      !/^\s*(?:'[^'\n]*'|"[^"\n]*")\s*$/.test(args)
    ) {
      fail('no-secrets-in-logs', `${file}:${line} console.${method} must only print a constant string`);
    } else if (!CONFIG.cliOutputFiles.includes(file) && SENSITIVE.test(stripStrings(args))) {
      fail(
        'no-secrets-in-logs',
        `${file}:${line} console.${method} arguments reference possibly sensitive data: ${args.trim().slice(0, 80)}`,
      );
    }
  }
  if (/process\.stderr\.write\s*\(/.test(code) && !CONFIG.cliOutputFiles.includes(file)) {
    fail('no-secrets-in-logs', `${file} writes to stderr directly; use a reviewed log call`);
  }
}

// 8. every anonymization rule module has a test proving output differs from input
const rulesDir = join(root, 'src/rules');
if (existsSync(rulesDir)) {
  for (const name of readdirSync(rulesDir)) {
    if (
      !name.endsWith('.ts') ||
      name.endsWith('.test.ts') ||
      name === 'index.ts' ||
      name === 'types.ts' ||
      name === 'hmac.ts' ||
      name === 'apply.ts' ||
      name === 'schema.ts'
    ) {
      continue;
    }
    const base = basename(name, '.ts');
    const testFile = join(rulesDir, `${base}.test.ts`);
    if (!existsSync(testFile)) {
      fail('rule-tests', `src/rules/${base}.ts has no src/rules/${base}.test.ts`);
      continue;
    }
    // `keep` is the only rule allowed to return the input; all others must prove output ≠ input.
    if (base === 'keep') continue;
    const testText = readText(`src/rules/${base}.test.ts`);
    if (
      !/!==|notEqual|notStrictEqual|not\.equal|doesNotMatch|not\.deepEqual/i.test(testText) &&
      !/differ|differs|≠|!=/.test(testText)
    ) {
      fail('rule-tests', `src/rules/${base}.test.ts must assert that rule output differs from input`);
    }
  }
}

if (errors.length) {
  console.error(`check:rules failed (${errors.length}):`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(`check:rules passed (${relative(process.cwd(), root) || '.'}, version ${pkg.version})`);
