import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import { readdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
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

const zodDtoRestriction = {
  paths: [
    {
      name: 'nestjs-zod',
      importNames: ['createZodDto'],
      message:
        'Importa createZodDto de shared/http/zod-dto (ruta relativa), que corrige los nullable del contrato OpenAPI.',
    },
  ],
};

// El frontend nunca importa código de la API: lo común va a @gns/shared. La regla resuelve los
// especificadores relativos contra la carpeta del archivo (un patrón fijo chocaría con las carpetas
// `api/` de cada feature) y también bloquea el nombre del paquete.
const apiRoot = resolve(import.meta.dirname, 'apps', 'api');
const API_IMPORT_MESSAGE =
  'El frontend no puede importar código de la API (apps/api): lo común va a @gns/shared.';

const noApiImport = {
  meta: { type: 'problem', schema: [], messages: { forbidden: API_IMPORT_MESSAGE } },
  create(context) {
    const fileDir = dirname(context.filename);
    const check = (node, specifier) => {
      if (typeof specifier !== 'string') return;
      let forbidden = specifier === '@gns/api' || specifier.startsWith('@gns/api/');
      if (!forbidden && specifier.startsWith('.')) {
        const target = resolve(fileDir, specifier);
        forbidden = target === apiRoot || target.startsWith(apiRoot + sep);
      }
      if (forbidden) context.report({ node, messageId: 'forbidden' });
    };
    const literal = (node) => (node && node.type === 'Literal' ? node.value : undefined);
    return {
      ImportDeclaration: (node) => check(node.source, node.source.value),
      ExportAllDeclaration: (node) => check(node.source, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node.source, node.source.value);
      },
      ImportExpression: (node) => check(node.source, literal(node.source)),
      TSImportEqualsDeclaration: (node) => {
        const ref = node.moduleReference;
        if (ref.type === 'TSExternalModuleReference') check(ref, literal(ref.expression));
      },
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          check(node, literal(node.arguments[0]));
        }
      },
    };
  },
};

const gnsPlugin = { rules: { 'no-api-import': noApiImport } };

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
      'apps/web/test-results/',
      'apps/web/playwright-report/',
      '.rei/',
      '.claude/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // La configuración de Playwright no pertenece a ningún tsconfig (el de la web solo incluye `src`,
        // y el de `e2e` no puede ser el más cercano a ella).
        projectService: { allowDefaultProject: ['apps/web/playwright.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Los archivos de configuración (JS y prisma.config.ts) no pertenecen a ningún tsconfig.
  {
    files: ['**/*.{js,mjs,cjs}', '**/prisma.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Los DTO se crean con el envoltorio de shared/http/zod-dto.ts, que corrige los
  // `nullable` del contrato OpenAPI; solo ese archivo importa createZodDto de nestjs-zod.
  // (La regla siguiente la repite porque en configuración plana la última sustituye a la anterior.)
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/test/**/*.ts'],
    ignores: ['apps/api/src/shared/http/zod-dto.ts'],
    rules: { 'no-restricted-imports': ['error', zodDtoRestriction] },
  },
  // Solo el repository toca la base: Prisma se importa únicamente desde la
  // infraestructura de base de datos y los prisma-*.repository.ts.
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/test/integration/example/**/*.ts'],
    ignores: [
      'apps/api/src/shared/http/zod-dto.ts',
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
          ...zodDtoRestriction,
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
  // Suite de navegador (Playwright): no es código de páginas, así que no le aplican las reglas de
  // Next.js ni de React. Es el único sitio de la web que importa código de apps/api (el entorno
  // efímero y los datos demo de BE-92).
  {
    files: ['apps/web/e2e/**/*.ts', 'apps/web/playwright.config.ts'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  // El frontend no importa la API (la suite de navegador, en e2e, queda fuera a propósito).
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { gns: gnsPlugin },
    rules: { 'gns/no-api-import': 'error' },
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
