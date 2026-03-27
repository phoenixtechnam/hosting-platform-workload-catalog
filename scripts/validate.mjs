#!/usr/bin/env node

/**
 * Validates all manifest.json files against the JSON Schema
 * and checks catalog.json completeness.
 *
 * Usage: node scripts/validate.mjs
 * Exit code 0 = all valid, 1 = errors found
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ✗ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠ ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

// ── Load schema ──────────────────────────────────────────────────────────────

const schemaPath = join(ROOT, 'schema', 'manifest.schema.json');
if (!existsSync(schemaPath)) {
  console.error('FATAL: schema/manifest.schema.json not found');
  process.exit(1);
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

// ── Load catalog.json ────────────────────────────────────────────────────────

console.log('\n📋 Validating catalog.json...');

const catalogPath = join(ROOT, 'catalog.json');
if (!existsSync(catalogPath)) {
  error('catalog.json not found');
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

if (!catalog.version) error('catalog.json missing "version" field');
if (!catalog.name) error('catalog.json missing "name" field');
if (!Array.isArray(catalog.workloads)) {
  error('catalog.json missing "workloads" array');
  process.exit(1);
}
if (catalog.workloads.length === 0) {
  error('catalog.json "workloads" array is empty');
}

// Check for duplicates in catalog
const catalogSet = new Set(catalog.workloads);
if (catalogSet.size !== catalog.workloads.length) {
  error('catalog.json contains duplicate workload entries');
}

ok(`catalog.json has ${catalog.workloads.length} workloads`);

// ── Discover manifest directories ────────────────────────────────────────────

const dirs = readdirSync(ROOT).filter((name) => {
  const full = join(ROOT, name);
  return (
    statSync(full).isDirectory() &&
    !name.startsWith('.') &&
    !name.startsWith('node_modules') &&
    name !== 'schema' &&
    name !== 'scripts'
  );
});

// ── Validate each manifest ───────────────────────────────────────────────────

console.log('\n📦 Validating manifests...\n');

const manifestCodes = new Set();

for (const dir of dirs) {
  const manifestPath = join(ROOT, dir, 'manifest.json');
  console.log(`  ${dir}/manifest.json`);

  if (!existsSync(manifestPath)) {
    error(`${dir}/manifest.json not found`);
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    error(`${dir}/manifest.json is not valid JSON: ${e.message}`);
    continue;
  }

  // Schema validation
  const valid = validate(manifest);
  if (!valid) {
    for (const err of validate.errors) {
      const path = err.instancePath || '(root)';
      error(`${dir}: ${path} ${err.message}`);
    }
    continue;
  }

  // Code must match directory name
  if (manifest.code !== dir) {
    error(`${dir}: code "${manifest.code}" does not match directory name "${dir}"`);
  }

  // Duplicate code check
  if (manifestCodes.has(manifest.code)) {
    error(`${dir}: duplicate code "${manifest.code}"`);
  }
  manifestCodes.add(manifest.code);

  // Dockerfile consistency
  if (manifest.has_dockerfile) {
    const dockerfilePath = join(ROOT, dir, 'Dockerfile');
    if (!existsSync(dockerfilePath)) {
      error(`${dir}: has_dockerfile is true but no Dockerfile found`);
    }
  }

  // If image is null, must have Dockerfile
  if (manifest.image === null && !manifest.has_dockerfile) {
    error(`${dir}: image is null but has_dockerfile is false — need one or the other`);
  }

  // Runtime workloads must have services field
  if (manifest.type === 'runtime' && !manifest.services) {
    error(`${dir}: runtime workload missing "services" field`);
  }

  // Database/service workloads must have provides field
  if ((manifest.type === 'database' || manifest.type === 'service') && !manifest.provides) {
    error(`${dir}: ${manifest.type} workload missing "provides" field`);
  }

  // Health check must have either path or command, not both
  if (manifest.health_check) {
    const hasPath = manifest.health_check.path !== null && manifest.health_check.path !== undefined;
    const hasCommand = manifest.health_check.command !== null && manifest.health_check.command !== undefined;
    if (hasPath && hasCommand) {
      error(`${dir}: health_check has both "path" and "command" — use one or the other`);
    }
    if (!hasPath && !hasCommand) {
      error(`${dir}: health_check has neither "path" nor "command"`);
    }
  }

  ok(`${dir}: valid (${manifest.type}, ${manifest.runtime} ${manifest.version})`);
}

// ── Cross-reference catalog.json ↔ directories ──────────────────────────────

console.log('\n🔗 Cross-referencing catalog.json ↔ directories...');

for (const workload of catalog.workloads) {
  if (!dirs.includes(workload)) {
    error(`catalog.json lists "${workload}" but no directory found`);
  }
}

for (const dir of dirs) {
  if (!catalog.workloads.includes(dir)) {
    warn(`directory "${dir}" exists but is not listed in catalog.json`);
  }
}

// ── Service dependency consistency ───────────────────────────────────────────

console.log('\n🔗 Checking service dependency consistency...');

const providers = new Map();
for (const dir of dirs) {
  const manifestPath = join(ROOT, dir, 'manifest.json');
  if (!existsSync(manifestPath)) continue;
  try {
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (m.provides) {
      if (m.provides.database) {
        providers.set(`database:${m.provides.database.engine}`, {
          code: m.code,
          version: m.provides.database.version,
        });
      }
      if (m.provides.redis) {
        providers.set('redis', {
          code: m.code,
          version: m.provides.redis.version,
        });
      }
    }
  } catch {
    // already reported above
  }
}

for (const dir of dirs) {
  const manifestPath = join(ROOT, dir, 'manifest.json');
  if (!existsSync(manifestPath)) continue;
  try {
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (m.services?.database?.required) {
      const hasProvider = m.services.database.engines.some((e) =>
        providers.has(`database:${e.type}`)
      );
      if (!hasProvider) {
        warn(
          `${dir}: requires database (${m.services.database.engines.map((e) => e.type).join('/')}) but no matching provider in catalog`
        );
      }
    }
    if (m.services?.redis?.required) {
      if (!providers.has('redis')) {
        warn(`${dir}: requires redis but no redis provider in catalog`);
      }
    }
  } catch {
    // already reported above
  }
}

ok('dependency check complete');

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
if (errors > 0) {
  console.error(`\n❌ ${errors} error(s), ${warnings} warning(s)\n`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${dirs.length} manifests valid, ${warnings} warning(s)\n`);
  process.exit(0);
}
