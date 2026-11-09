import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // ESLint no lee .gitignore: las exclusiones se declaran aquí.
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.turbo/',
      '**/coverage/',
      '**/.next/',
      '.rei/',
      '.claude/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Los archivos de configuración JS no pertenecen a ningún tsconfig.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
