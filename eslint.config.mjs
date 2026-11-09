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
  // Los archivos de configuración (JS y prisma.config.ts) no pertenecen a ningún tsconfig.
  {
    files: ['**/*.{js,mjs,cjs}', '**/prisma.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Solo el repository toca la base: Prisma se importa únicamente desde la
  // infraestructura de base de datos y los prisma-*.repository.ts.
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/test/integration/example/**/*.ts'],
    ignores: [
      'apps/api/src/shared/database/**',
      'apps/api/src/shared/repository/prisma-*.ts',
      '**/prisma-*.repository.ts',
      '**/*.spec.ts',
      '**/*.int-spec.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^@prisma/|generated/prisma)',
              message:
                'Solo el repository toca la base de datos: los servicios y controladores dependen de la interfaz del repository, no de Prisma.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
