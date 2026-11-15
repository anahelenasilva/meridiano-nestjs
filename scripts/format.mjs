// Formats the repo's code files with Prettier. `pnpm format` and
// .githooks/pre-commit both run it, so they share one list of code files:
//
//   node scripts/format.mjs                  rewrite every git-listed code file but committed migrations
//   node scripts/format.mjs --check-staged   fail when the staged copy of a code file is unformatted
//
// --check-staged reads each file from the index, not the working tree, so a
// partial stage (git add -p) is judged on exactly what the commit will contain.
// Config comes from the working tree's .prettierrc and .editorconfig, like the
// Prettier CLI.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const codeFiles = ['*.ts', '*.mts', '*.cts', '*.js', '*.mjs', '*.cjs'];
const isStagedCheck = process.argv.includes('--check-staged');

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const listFiles = isStagedCheck
  ? ['diff', '--cached', '--name-only', '--diff-filter=ACM']
  : ['ls-files', '--cached', '--others', '--exclude-standard'];
// The pre-commit hook's check-migration-edits.sh blocks any edit to a
// migration committed to HEAD, so `pnpm format` leaves those alone. A new
// migration still gets formatted, and --check-staged still checks it.
const committedMigrations = new Set(
  isStagedCheck
    ? []
    : git(
        'ls-tree',
        '-r',
        '-z',
        '--name-only',
        'HEAD',
        '--',
        'src/database/migrations',
      ).split('\0'),
);
const paths = git(...listFiles, '-z', '--', ...codeFiles)
  .split('\0')
  .filter((path) => path && !committedMigrations.has(path));
if (paths.length === 0) process.exit(0);

// Loaded only when there is a file to check, so a commit with no code files
// works in a worktree that has no node_modules yet.
const prettier = await import('prettier').catch(() => {
  console.error('format: cannot load prettier. Run `pnpm install` first.');
  process.exit(1);
});

const failures = [];
const unformatted = [];
for (const path of paths) {
  try {
    const options = {
      ...(await prettier.resolveConfig(path, { editorconfig: true })),
      filepath: path,
    };
    if (isStagedCheck) {
      const isFormatted = await prettier.check(
        git('show', `:${path}`),
        options,
      );
      if (!isFormatted) {
        failures.push(`  ${path}`);
        unformatted.push(path);
      }
      continue;
    }
    const source = readFileSync(path, 'utf8');
    const formatted = await prettier.format(source, options);
    if (formatted !== source) {
      writeFileSync(path, formatted);
      console.log(path);
    }
  } catch (error) {
    failures.push(`  ${path}: ${error.message.split('\n')[0]}`);
  }
}

// Quotes a path for the copy-paste command when it has shell characters.
const shellQuote = (path) =>
  /^[\w@%+=:,./-]+$/.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`;

if (failures.length > 0) {
  // The fix names only the blocked files: `pnpm format` would rewrite every
  // unformatted file in the repo, not just the ones in this commit.
  const fix =
    unformatted.length > 0
      ? `\n\nFormat them, stage them and commit again:\n  pnpm exec prettier --write ${unformatted.map(shellQuote).join(' ')}`
      : '';
  console.error(
    isStagedCheck
      ? `format: these staged files fail Prettier:\n${failures.join('\n')}${fix}`
      : `format: Prettier could not format these files:\n${failures.join('\n')}`,
  );
  process.exitCode = 1;
}
