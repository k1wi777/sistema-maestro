// Selects and runs the tests affected by the current changes (see
// .rei/docs/project/verification.md, V10). Plain Node, no dependencies.
//
// Usage: node scripts/test-affected.mjs [--base <ref>] [--plan]
//   --base <ref>  base to compare against (default: TEST_BASE or origin/main)
//   --plan        print the decision as JSON and do not run anything
// With GITHUB_OUTPUT defined, writes `mode` and `db` for the CI.
// Fail-safe: any doubt or error resolves to mode "all", never to "none".
import console from 'node:console';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(root, 'apps/api');
const MAX_FILES = 150;

const args = process.argv.slice(2);
const planOnly = args.includes('--plan');
const baseIdx = args.indexOf('--base');
const base =
  (baseIdx >= 0 ? args[baseIdx + 1] : undefined) ?? process.env.TEST_BASE ?? 'origin/main';

const git = (...a) =>
  execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = (s) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

// Ordered rules: the first one that matches wins.
const rules = [
  [
    'all',
    (f) =>
      f.startsWith('packages/shared/') ||
      f === 'apps/api/prisma/schema.prisma' ||
      f.startsWith('apps/api/prisma/migrations/') ||
      f === 'apps/api/prisma.config.ts' ||
      f.startsWith('apps/api/src/core/') ||
      f === 'package.json' ||
      f.endsWith('/package.json') ||
      ['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.nvmrc', 'turbo.json'].includes(f) ||
      /(^|\/)tsconfig[^/]*\.json$/.test(f) ||
      /^apps\/api\/jest[^/]*\.json$/.test(f) ||
      f === 'apps/api/nest-cli.json' ||
      f.startsWith('apps/api/test/integration/support/') ||
      f.startsWith('.github/') ||
      f.startsWith('scripts/'),
  ],
  ['db', (f) => f.startsWith('apps/api/prisma/seed/') || f.startsWith('apps/api/test/db/')],
  [
    'related',
    (f) => (f.startsWith('apps/api/src/') || f.startsWith('apps/api/test/')) && f.endsWith('.ts'),
  ],
  [
    'none',
    (f) =>
      f.endsWith('.md') ||
      f.startsWith('.rei/') ||
      f.startsWith('.claude/') ||
      f.startsWith('apps/web/') ||
      f.startsWith('.husky/') ||
      [
        '.editorconfig',
        '.gitignore',
        '.gitattributes',
        '.prettierrc.json',
        '.prettierignore',
        '.lintstagedrc.json',
        'eslint.config.mjs',
      ].includes(f),
  ],
];

function decide() {
  let mergeBase;
  let changed;
  let deleted;
  try {
    mergeBase = git('merge-base', base, 'HEAD').trim();
    const diff = lines(git('diff', '--name-only', '--no-renames', mergeBase));
    const untracked = lines(git('ls-files', '--others', '--exclude-standard'));
    changed = [...new Set([...diff, ...untracked])].sort();
    deleted = new Set(changed.filter((f) => !existsSync(resolve(root, f))));
  } catch (e) {
    return {
      mode: 'all',
      db: true,
      base,
      files: [],
      reason: `git failed or base not found (${base}): ${String(e.message).split('\n')[0]}`,
    };
  }
  if (changed.length > MAX_FILES) {
    return {
      mode: 'all',
      db: true,
      base,
      files: changed,
      reason: `more than ${MAX_FILES} changed files`,
    };
  }
  const related = [];
  let db = false;
  for (const f of changed) {
    const hit = rules.find(([, test]) => test(f));
    if (!hit) return { mode: 'all', db: true, base, files: changed, reason: `unknown file: ${f}` };
    const [cat] = hit;
    if (cat === 'all')
      return { mode: 'all', db: true, base, files: changed, reason: `core file changed: ${f}` };
    if (cat === 'db') db = true;
    if (cat === 'related' || cat === 'db') {
      if (deleted.has(f)) {
        if (!/\.(spec|int-spec|db-spec)\.ts$/.test(f) && cat === 'related') {
          return {
            mode: 'all',
            db: true,
            base,
            files: changed,
            reason: `source file deleted: ${f}`,
          };
        }
      } else if (cat === 'related') related.push(f);
    }
  }
  if (related.length === 0 && !db) {
    return {
      mode: 'none',
      db: false,
      base,
      files: changed,
      reason: 'no changed file affects tests',
    };
  }
  return {
    mode: 'affected',
    db,
    base,
    files: changed,
    related,
    reason: db ? 'related tests + database tests (V8)' : 'related tests only',
  };
}

let plan;
try {
  plan = decide();
} catch (e) {
  plan = { mode: 'all', db: true, base, files: [], reason: `unexpected error: ${e.message}` };
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `mode=${plan.mode}\ndb=${plan.db}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Test selection\n\n- mode: \`${plan.mode}\`\n- database tests: \`${plan.db}\`\n- base: \`${plan.base}\`\n- reason: ${plan.reason}\n- changed files: ${plan.files.length}\n`,
  );
}

if (planOnly) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

console.error(
  `[test-affected] mode=${plan.mode} db=${plan.db} base=${plan.base} files=${plan.files.length} (${plan.reason})`,
);
if (plan.db) {
  console.error(
    '[test-affected] V8 (pnpm test:db) is required and is not run by this script: run it against the migrated local database.',
  );
}

function run(cmd, cmdArgs, cwd) {
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
  if (r.error) {
    console.error(`[test-affected] could not run ${cmd}: ${r.error.message}`);
    return 1;
  }
  return r.status ?? 1;
}

if (plan.mode === 'none') {
  console.error('[test-affected] nothing to run.');
  process.exit(0);
}

if (plan.mode === 'all') {
  const exec = process.env.npm_execpath;
  if (!exec) {
    console.error(
      '[test-affected] run it via `pnpm test:affected` so the full suite can be launched.',
    );
    process.exit(1);
  }
  const isScript = /\.(c|m)?js$/.test(exec);
  process.exit(run(isScript ? process.execPath : exec, isScript ? [exec, 'test'] : ['test'], root));
}

// affected
if (plan.related.length === 0) {
  console.error(
    '[test-affected] no related unit/integration tests; only database tests (V8) apply.',
  );
  process.exit(0);
}
const jest = resolve(apiDir, 'node_modules/jest/bin/jest.js');
process.exit(
  run(
    process.execPath,
    [jest, '--findRelatedTests', ...plan.related.map((f) => resolve(root, f)), '--passWithNoTests'],
    apiDir,
  ),
);
