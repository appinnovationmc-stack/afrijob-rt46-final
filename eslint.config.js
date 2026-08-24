import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

// Phase O (quality gate): eslint was a devDependency with an npm script
// ("lint": "eslint .") but no config file at all — `npm run lint` was
// dead on arrival. This is the standard Vite + React + TS setup those
// installed versions expect, not a custom rule set invented for this
// audit.
export default tseslint.config(
  { ignores: ['dist', 'android', 'ios'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Underscore-prefixed args/vars are a deliberate "intentionally
      // unused" convention already used across this codebase (destructured
      // props, catch blocks) - matches noUnusedParameters/noUnusedLocals'
      // intent in tsconfig without fighting that existing pattern.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // any is used pragmatically in a handful of places (Supabase RPC
      // return shapes, error catches) - flagging it as a warning keeps it
      // visible without blocking the existing build on a repo-wide type
      // audit that's out of scope for standing up the lint config itself.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
