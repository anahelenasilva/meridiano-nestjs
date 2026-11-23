// Run through `pnpm test:mutation <file>`, which passes --mutate, so no
// mutate list lives here.
export default {
  testRunner: 'jest',
  // pnpm keeps the runner out of core's node_modules, where Stryker's default
  // `@stryker-mutator/*` plugin glob looks, so name it.
  plugins: ['@stryker-mutator/jest-runner'],
  // projectType custom with no configFile reads the root Jest config in
  // package.json.
  jest: { projectType: 'custom', enableFindRelatedTests: true },
  coverageAnalysis: 'perTest',
  // NestJS decorator arguments run at module load, and Stryker reruns every
  // test for each such static mutant.
  ignoreStatic: true,
  // Each mutant run loads every spec related to the file (about 16 s for
  // libs/database), and parallel runners slow that further. The default 5 s
  // on top of the dry run's overhead turned killable mutants into timeouts.
  timeoutMS: 60000,
  reporters: ['clear-text', 'progress', 'html', 'json'],
  // Anchored to the repo root so a same-named folder under src/ or libs/ still
  // reaches the sandbox. Stryker already skips node_modules, .git and its own
  // temp dir.
  ignorePatterns: [
    '/dist',
    '/build',
    '/coverage',
    '/.nyc_output',
    '/reports',
    '/infrastructure',
    '/transcripts',
    '/.claude/worktrees',
    '/.sandcastle/worktrees',
    '/.pnpm-store',
  ],
};
