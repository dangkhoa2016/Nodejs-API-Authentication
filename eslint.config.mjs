import globals from 'globals';
import pluginJs from '@eslint/js';


/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  pluginJs.configs.recommended,
  {
    rules: {
      // ensure semicolon at the end of the statement
      'semi': ['error', 'always'],
      // ensure comma-dangle in multi-line objects/arrays
      'comma-dangle': ['error', 'always-multiline'],

      'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
      // Indent using 2 spaces
      'indent': ['error', 2],
      // Ensure there is a space before the `{` symbol in block structures.
      'space-before-blocks': ['error', 'always'],
      // Ensure there is a space around operators
      'space-infix-ops': 'error',
      // Ensure there are no trailing spaces at the end of the line
      'no-trailing-spaces': 'error',
      // Ensure there are spaces inside the object curly braces
      'object-curly-spacing': ['error', 'always'],
    },
  },
];
