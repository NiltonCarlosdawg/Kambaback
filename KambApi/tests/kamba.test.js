// tests/kamba.test.js — F-024
// Valida o pipeline unificado de conversa (JSON + SSE):
//  - no STREAM a moderação de OUTPUT acontece ANTES de transmitir (buffer)
//  - tokens reais chegam à resposta/`done` (stream_options.include_usage)
//  - contrato de validação/moderação de input/offline mantido nos dois modos
const request = require('supertest');
const { app } = require('../server');
const { registar, limparUtilizadores, resetarLimiteAuth, prisma } = require('./helpers');

// Mock do cliente LLM: sem rede, controlamos isConfigured e as respostas.
// O spread do módulo real mantém getClient/isModerationSupported etc. para os
// restantes importadores (contentModerator, embeddingService, ...).
jest.mock('../src/modules/kamba/services/ai/openaiClient', () => {
  const real = jest.requireActual('../src/modules/kamba/services/ai/openaiClient');
  return {
    ...real,
    isConfigured: jest.fn(() => false),
    isModerationSupported: jest.fn(() => false), // força moderação por regex
    chamarGroq: jest.fn(),
    chamarGroqComTools: jest.fn(),
    chamarStream: jest.fn(),
    completar: jest.fn(),
  };
});

const openaiClient = require('../src/modules/kamba/services/ai/openaiClient');

/** Converte a resposta SSE num array de eventos JSON. */
const parseSSE = (texto) =>
  texto
    .split('\n\n')
    .map((bloco) => bloco.trim())
    .filter((bloco) => bloco.startsWith('data:'))
    .map((bloco) => JSON.parse(bloco.replace(/^data:\s*/, '')));

describe('Kamba conversa (F-024: pipeline JSON + stream unificados)', () => {
  let user;

  beforeAll(async () => {
    user = await registar('kamba');
  });

  afterAll(async () => {
    await limparUtilizadores(user.email);
  });

  beforeEach(() => {
    resetarLimiteAuth();
    openaiClient.isConfigured.mockReturnValue(false);
    openaiClient.chamarGroq.mockReset();
    openaiClient.chamarGroqComTools.mockReset();
    openaiClient.chamarStream.mockReset();
  });

  describe('validação e rotas rápidas (JSON)', () => {
    it('rejeita mensagem vazia com o fallback de não entendido', async () => {
      const res = await request(app)
        .post('/api/kamba/conversar')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ mensagem: '' });

      expect(res.status).toBe(200);
      expect(res.body.kamba).toBe(true);
      expect(res.body.mensagem).toBeTruthy();
    });

    it('modera INPUT antes de qualquer chamada ao LLM', async () => {
      const res = await request(app)
        .post('/api/kamba/conversar')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ mensagem: 'vou te matar agora' });

      expect(res.status).toBe(200);
      expect(res.body.mensagem).toMatch(/conversa para aqui/);
      expect(res.body.moderado).toBe(true);
      expect(openaiClient.chamarGroq).not.toHaveBeenCalled();
      expect(openaiClient.chamarGroqComTools).not.toHaveBeenCalled();
    });

    it('devolve a resposta offline quando a IA não está configurada', async () => {
      const res = await request(app)
        .post('/api/kamba/conversar')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ mensagem: 'Porque é que o mar fica azul de dia?' });

      expect(res.status).toBe(200);
      expect(res.body.kamba).toBe(true);
      expect(res.body.offline).toBe(true);
      expect(openaiClient.chamarGroq).not.toHaveBeenCalled();
    });
  });

  describe('caminho LLM (JSON)', () => {
    it('devolve conteúdo, tokens reais e metadados', async () => {
      openaiClient.isConfigured.mockReturnValue(true);
      openaiClient.chamarGroq.mockResolvedValue({
        choices: [{ message: { content: 'Resposta do LLM de teste.' } }],
        usage: { total_tokens: 99 },
      });
      openaiClient.chamarGroqComTools.mockResolvedValue({
        choices: [{ message: { content: 'Resposta do LLM de teste.' } }],
        usage: { total_tokens: 99 },
      });

      const res = await request(app)
        .post('/api/kamba/conversar')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ mensagem: 'Porque é que as estrelas brilham no céu à noite?' });

      expect(res.status).toBe(200);
      expect(res.body.mensagem).toBe('Resposta do LLM de teste.');
      expect(res.body.tokens).toBe(99);
      expect(res.body.latencia).toMatch(/ms$/);
      expect(res.body.intencao).toBeTruthy();
    });
  });

  describe('stream SSE (F-024: buffer + moderação antes de transmitir)', () => {
    it('NUNCA transmite conteúdo bloqueado em `chunk` — modera antes', async () => {
      openaiClient.isConfigured.mockReturnValue(true);
      openaiClient.chamarStream.mockResolvedValue({
        choices: [
          { message: { content: 'Olá! A minha resposta é: fuck you. Pronto.' } },
        ],
        usage: { total_tokens: 42 },
      });

      const res = await request(app)
        .post('/api/kamba/stream')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ mensagem: 'Porque é que as galáxias se afastam umas das outras?' });

      expect(res.status).toBe(200);

      const eventos = parseSSE(res.text);
      const tipos = eventos.map((e) => e.type);

      // contrato SSE preservado
      expect(tipos).toContain('stream_start');
      expect(tipos).toContain('done');
      expect(tipos).toContain('moderated');

      // O NÚCLEO DO F-024: nenhum `chunk` pode conter o conteúdo proibido
      const chunks = eventos.filter((e) => e.type === 'chunk');
      expect(chunks.length).toBe(0);
      expect(res.text).not.toContain('fuck you');

      // cliente recebe a substituta de bloqueio (não o conteúdo original)
      const moderado = eventos.find((e) => e.type === 'moderated');
      expect(moderado.mensagem).toMatch(/Epa, kamba/);

      // tokens reais no `done` (antes eram sempre 0 no stream)
      const done = eventos.find((e) => e.type === 'done');
      expect(done.tokens).toBe(42);
      expect(done.moderado).toBe(true);
    });

    it('transmite o conteúdo aprovado em `chunk` com tokens reais', async () => {
      openaiClient.isConfigured.mockReturnValue(true);
      openaiClient.chamarStream.mockResolvedValue({
        choices: [{ message: { content: 'Claro! O universo é enorme. ✨' } }],
        usage: { total_tokens: 7 },
      });

      const res = await request(app)
        .post('/api/kamba/stream')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ mensagem: 'Conta-me uma curiosidade sobre os vulcões ativos.' });

      expect(res.status).toBe(200);

      const eventos = parseSSE(res.text);
      const tipos = eventos.map((e) => e.type);
      expect(tipos).toEqual(
        expect.arrayContaining(['stream_start', 'chunk', 'done']),
      );
      expect(tipos).not.toContain('moderated');

      const chunk = eventos.find((e) => e.type === 'chunk');
      expect(chunk.content).toBe('Claro! O universo é enorme. ✨');

      const done = eventos.find((e) => e.type === 'done');
      expect(done.tokens).toBe(7);
      expect(done.latencia).toMatch(/ms$/);
    });
  });

  describe('A/B testing protegido por admin (F-027)', () => {
    it('GET /analytics/testes devolve 403 para utilizador comum', async () => {
      const res = await request(app)
        .get('/api/kamba/analytics/testes')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.mensagem).toBe('Apenas administradores');
    });

    it('GET /analytics/testes devolve os testes para ADMIN', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });

      const res = await request(app)
        .get('/api/kamba/analytics/testes')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.testes)).toBe(true);

      // repõe o role por omissão — os restantes testes assumem USER
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'USER' },
      });
    });
  });
});
