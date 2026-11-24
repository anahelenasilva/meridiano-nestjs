// @ts-check
import eslint from '@eslint/js';
import {
  projectStructureParser,
  projectStructurePlugin,
} from 'eslint-plugin-project-structure';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `pnpm lint` passes every tracked .ts file. infrastructure/ is a separate
  // CDK package with its own package.json and tsconfig.
  { ignores: ['infrastructure/**'] },
  {
    ignores: ['projectStructure.cache.json'],
    languageOptions: { parser: projectStructureParser },
    plugins: {
      'project-structure': projectStructurePlugin,
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-nested-ternary': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // node:test's describe/it/test return promises its runner awaits.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['describe', 'it', 'test'],
            },
          ],
        },
      ],
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/libs/**'],
              message:
                'Import a lib through @libs/*, never a relative path. See libs/README.md#import-conventions',
            },
          ],
        },
      ],
      // Issue #419: a named type built on object types uses `interface X extends A`.
      // The selector flags a non-generic alias only when every part is a type reference or an object literal,
      // so a brand, union, array, function or conditional part keeps the `type`.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'TSTypeAliasDeclaration:not([typeParameters]) > TSIntersectionType:not(:has(> :not(TSTypeReference, TSTypeLiteral, TSIntersectionType)))',
          message:
            'Write a named object type as `interface X extends A { ... }`. If it flows into a Record<...> parameter, keep the `type` (an interface has no implicit index signature) and add `// eslint-disable-next-line no-restricted-syntax -- flows into Record`.',
        },
        // toEqual and toHaveBeenCalledWith treat `key: undefined` as a missing key, so in an exact object it asserts nothing.
        // Inside expect.objectContaining it checks the key is present and undefined, so the selector skips that.
        {
          selector:
            "CallExpression[callee.property.name=/^(toEqual|toHaveBeenCalledWith|toHaveBeenNthCalledWith|toHaveBeenLastCalledWith)$/] Property[value.type='Identifier'][value.name='undefined']:not(CallExpression[callee.property.name='objectContaining'] Property)",
          message:
            'In an exact toEqual / toHaveBeenCalledWith object, `key: undefined` matches a missing key and asserts nothing. Delete it; the exact object already fails if the key gets a value.',
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
