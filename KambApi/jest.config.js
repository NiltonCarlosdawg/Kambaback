// jest.config.js — F-022: configuração central dos testes
module.exports = {
  testEnvironment: 'node',
  // Corre ANTES de qualquer módulo dos testes: aponta a BD para kambapro_test
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testMatch: ['**/tests/**/*.test.js'],
  // Testes de integração contra BD real com o app carregado por worker — o
  // default de 5s é curto quando 5 workers arrancam em simultâneo (CI é mais
  // lento que a máquina local; causou flakes na simulação do F-023)
  testTimeout: 30000,
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
