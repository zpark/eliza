import eslintGlobalConfig from "../../eslint.config.mjs";

export default [
  ...eslintGlobalConfig,
  {
    rules: {
      indent: ["error", 2],
      'padding-line-between-statements': [
        'error',
        // Blank line between "use strict" (or other directives) and imports
        { blankLine: 'always', prev: 'directive', next: 'import' },

        // No blank lines between import statements
        { blankLine: 'never', prev: 'import', next: 'import' },

        // One blank line after the last import statement
        {
          blankLine: 'always',
          prev: 'import',
          next: ['const', 'let', 'var', 'function', 'expression', 'if', 'block', 'class', 'export', 'block-like']
        },

        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: '*', next: 'block-like' }
      ],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
    },
  },
];
