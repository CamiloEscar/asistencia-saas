/**
 * ESLint v9 flat config for apps/api (NestJS).
 *
 * apps/api is a CommonJS package (no "type": "module"), so this file must be
 * CJS-compatible. We use a dynamic `import()` to load the ESM shared config
 * and return the resolved config as a Promise (ESLint v9 supports Promise
 * resolution for flat config files).
 */
module.exports = (async () => {
  const { default: nestConfig } = await import('@asistencia/eslint-config/nest');

  return [
    ...nestConfig,
    {
      ignores: ['dist/**', 'test/**', 'node_modules/**'],
    },
  ];
})();
