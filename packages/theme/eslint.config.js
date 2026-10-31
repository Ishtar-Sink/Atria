import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'fonts'] },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  { files: ['eslint.config.js'], ...tseslint.configs.disableTypeChecked },
);
