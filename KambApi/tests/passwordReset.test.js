// tests/passwordReset.test.js — F-022
// Fluxo de redefinição de senha (lógica F-020): OTP de 6 dígitos gerado com
// CSPRNG, na BD apenas sha256(salt:otp), lockout ao 5.º erro, sem oráculo
// (mensagem idêntica com email inexistente) e OTP de uso único.
//
// O serviço de email é MOCKADO — nenhum SMTP real nos testes; o OTP capturado
// permite validar o fluxo completo.
let mockOtp = null;

jest.mock('../src/services/emailService', () => ({
  sendOTPEmail: jest.fn(async (_to, otp) => {
    mockOtp = otp;
  }),
  transporter: {},
}));

const { app, request, registar, limparUtilizadores, resetarLimiteAuth, prisma } = require('./helpers');
const { sendOTPEmail } = require('../src/services/emailService');

describe('Redefinição de senha (OTP)', () => {
  let user;

  const esqueci = () =>
    request(app).post('/api/auth/esqueci-senha').send({ email: user.email });
  const redefinir = (otp, novaSenha = 'NovaSenha123') =>
    request(app).post('/api/auth/redefinir-senha').send({ email: user.email, otp, novaSenha });
  /** Falhas em /api/auth consome orçamento do limiteAuth — reinicia antes. */
  const falha = async (fazerRequisicao) => {
    resetarLimiteAuth();
    return fazerRequisicao();
  };

  beforeAll(async () => {
    user = await registar('reset');
  });

  beforeEach(() => {
    mockOtp = null;
    sendOTPEmail.mockClear();
    resetarLimiteAuth();
  });

  afterAll(async () => {
    await limparUtilizadores(user.email);
  });

  it('email inexistente: mesmo 200 e NENHUM email enviado (sem oráculo)', async () => {
    const res = await request(app)
      .post('/api/auth/esqueci-senha')
      .send({ email: `naoexiste${Date.now()}@teste.kamba.dev` });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendOTPEmail).not.toHaveBeenCalled();
  });

  it('esqueci-senha com email válido → 200 com OTP de exatamente 6 dígitos', async () => {
    const res = await esqueci();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendOTPEmail).toHaveBeenCalledTimes(1);
    expect(sendOTPEmail).toHaveBeenCalledWith(user.email, expect.any(String), expect.any(String));
    expect(mockOtp).toMatch(/^\d{6}$/);
  });

  it('a BD guarda apenas sha256(salt:otp) em hex — nunca o OTP em texto claro', async () => {
    await esqueci();
    expect(mockOtp).toMatch(/^\d{6}$/);

    const token = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { criadoEm: 'desc' },
    });

    expect(token).not.toBeNull();
    expect(token.otp).not.toBe(mockOtp);
    expect(token.otp).toMatch(/^[0-9a-f]{64}$/);
    expect(token.salt.length).toBeGreaterThan(0);
    expect(token.tentativas).toBe(0);
    expect(token.used).toBe(false);
  });

  it('OTP errado → 400 sem alterar a senha atual', async () => {
    await esqueci();

    const res = await falha(() => redefinir('000000'));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Código OTP inválido ou expirado.');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, senha: user.senha });
    expect(login.status).toBe(200);
  });

  it('OTP certo redefine: nova senha entra, antiga morre e OTP não reutiliza', async () => {
    await esqueci();

    const res = await redefinir(mockOtp);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const loginNova = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, senha: 'NovaSenha123' });
    expect(loginNova.status).toBe(200);
    expect(loginNova.body.accessToken).toBeDefined();

    const loginAntiga = await falha(() =>
      request(app).post('/api/auth/login').send({ email: user.email, senha: user.senha }),
    );
    expect(loginAntiga.status).toBe(401);

    const reutilizacao = await falha(() => redefinir(mockOtp, 'OutraSenha123'));
    expect(reutilizacao.status).toBe(400);
    expect(reutilizacao.body.error.message).toBe('Código OTP inválido ou expirado.');
  });

  it('lockout: 5 erros seguidos matam o token — nem o OTP certo passa depois', async () => {
    await esqueci();
    expect(mockOtp).toMatch(/^\d{6}$/);

    for (let i = 0; i < 5; i++) {
      const res = await falha(() => redefinir('000000'));
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Código OTP inválido ou expirado.');
    }

    const token = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { criadoEm: 'desc' },
    });
    expect(token.tentativas).toBe(5);
    expect(token.used).toBe(true);

    // Mesmo com o OTP correto, o token já morreu (mesma mensagem: sem oráculo)
    const comCorreto = await falha(() => redefinir(mockOtp));
    expect(comCorreto.status).toBe(400);
    expect(comCorreto.body.error.message).toBe('Código OTP inválido ou expirado.');

    const login = await falha(() =>
      request(app).post('/api/auth/login').send({ email: user.email, senha: 'NovaSenha123' }),
    );
    expect(login.status).toBe(200);
  });
});
