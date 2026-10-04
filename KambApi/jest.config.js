// jest.config.js — F-022: configuração central dos testes
module.exports = {
  testEnvironment: 'node',
  // Corre ANTES de qualquer módulo dos testes: aponta a BD para kambapro_test
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testMatch: ['**/tests/**/*.test.js'],
  // Servidor/cron/socket podem deixar handles abertos — força a saída
  forceExit: true,
  // Cobertura + limiares (regressões de cobertura falham o `npm test`)
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/routes/**',       // fios de ligação (roting) — sem lógica própria
    '!src/docs/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    // Baseline medido em 04/10/2026: 23.03 / 10.8 / 13.39 / 24.02 — limiares
    // ~1 ponto abaixo para travar regressões de cobertura sem fragilidade
    global: {
      statements: 22,
      branches: 10,
      functions: 12,
      lines: 23,
    },
  },
};
