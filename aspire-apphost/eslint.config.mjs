// @ts-check
import path from 'node:path';
import base from '../eslint.base.js';

// Composed from eslint.base.js so the AppHost gets house style *and* the
// scaffolded rules
export default base(
  // Turns on antfu's type-aware layer, which no-floating-promises requires: the
  // rule has to know that a call returns a Thenable. Scoped by the tsconfig's own
  // narrow `include`, so it cannot reach into the app packages.
  //
  // Absolute, not relative. antfu feeds this straight to typescript-eslint as
  // `projectService.defaultProject` and offers no `tsconfigRootDir` to anchor it,
  // so a relative path resolves against the process cwd — and we always run ESLint
  // from the repo root.
  { typescript: { tsconfigPath: path.join(import.meta.dirname, 'tsconfig.json') } },

  {
    name: 'velo/apphost/rules',
    files: ['apphost.mts'],
    rules: {
      // The AppHost is an ESM entry point whose entire API is async: `createBuilder`,
      // every `add*`/`with*` call, and `build().run()`
      'antfu/no-top-level-await': 'off',

      // Every builder call returns a promise, and a dropped `await` omits the
      // resource from the app model instead of failing: the AppHost starts
      // without that resource.
      'ts/no-floating-promises': ['error', { checkThenables: true }],
    },
  },
);
