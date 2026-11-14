import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import { readdirSync } from 'node:fs';
import tseslint from 'typescript-eslint';

// Frontend feature first: una feature solo conoce `@/shared` y `@gns/shared`.
// Las features se leen del disco para que una carpeta nueva quede aislada sin tocar esto.
const webSrc = `${import.meta.dirname}/apps/web/src`;
const webFeatures = readdirSync(`${webSrc}/features`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const lucideOnlyInIcons = {
  name: 'lucide-react',
  message:
    'Los iconos se piden con <Icon name="…" /> de @/shared/ui; lucide-react solo se importa en shared/ui/icons.',
};

const importRule = (options) => ({
  'no-restricted-imports': ['error', options],
});

const otherFeaturesPatterns = (own) =>
  webFeatures
    .filter((name) => name !== own)
    .flatMap((other) => [
      {
        regex: `^@/features/${other}(/|$)`,
        message: `La feature «${own}» no puede importar la feature «${other}»: lo común va a @/shared.`,
      },
      {
        regex: `^(\\.\\./)+${other}(/|$)`,
        message: `La feature «${own}» no puede importar la feature «${other}»: lo común va a @/shared.`,
      },
    ]);

export default defineConfig(
  // ESLint no lee .gitignore: las exclusiones se declaran aquí.
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.turbo/',
      '**/coverage/',
      '**/.next/',
      'apps/web/src/shared/api/generated/',
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
  // Frontend: reglas de Next.js y de los hooks de React (ESLint 10, configuración plana).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // App Router: no existe el directorio pages.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  // lucide-react queda detrás de <Icon>: un único punto de control del estilo.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/shared/ui/icons/**'],
    rules: importRule({ paths: [lucideOnlyInIcons] }),
  },
  ...webFeatures.map((feature) => ({
    files: [`apps/web/src/features/${feature}/**/*.{ts,tsx}`],
    rules: importRule({
      paths: [lucideOnlyInIcons],
      patterns: otherFeaturesPatterns(feature),
    }),
  })),
  // shared no conoce a quienes lo usan.
  {
    files: ['apps/web/src/shared/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/shared/ui/icons/**'],
    rules: importRule({
      paths: [lucideOnlyInIcons],
      patterns: [
        {
          regex: '^@/(features|app)(/|$)',
          message: 'shared no puede importar de features ni de app.',
        },
      ],
    }),
  },
  {
    files: ['apps/web/src/shared/ui/icons/**/*.{ts,tsx}'],
    rules: importRule({
      patterns: [
        {
          regex: '^@/(features|app)(/|$)',
          message: 'shared no puede importar de features ni de app.',
        },
      ],
    }),
  },
  prettier,
);
