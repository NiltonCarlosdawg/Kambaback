const crypto = require('crypto');
const prisma = require('../../../lib/prisma');
const { gerarTokens } = require('../../../middleware/auth');
const { definirCookieRefresh } = require('../../../utils/refreshCookie');

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';

let cacheChaves = null;

const buscarChavesApple = async () => {
  if (cacheChaves) return cacheChaves;
  const res = await fetch(APPLE_JWKS_URI);
  const { keys } = await res.json();
  cacheChaves = keys;
  setTimeout(() => { cacheChaves = null; }, 3600000);
  return keys;
};

const base64URLDecode = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
};

const loginComApple = async (req, res, next) => {
  try {
    const { id_token, nome } = req.body;

    if (!id_token) {
      return res.status(400).json({ success: false, mensagem: 'ID token Apple não fornecido.' });
    }

    if (!APPLE_CLIENT_ID) {
      return res.status(500).json({ success: false, mensagem: 'Apple OAuth não configurado.' });
    }

    // Decodificar o JWT manualmente para extrair header e payload
    const partes = id_token.split('.');
    if (partes.length !== 3) {
      return res.status(401).json({ success: false, mensagem: 'Token Apple inválido.' });
    }

    const header = JSON.parse(base64URLDecode(partes[0]).toString());
    const payload = JSON.parse(base64URLDecode(partes[1]).toString());
    const assinatura = base64URLDecode(partes[2]);

    // Verificar expiração
    if (payload.exp * 1000 < Date.now()) {
      return res.status(401).json({ success: false, mensagem: 'Token Apple expirado.' });
    }

    // Verificar issuer
    if (payload.iss !== 'https://appleid.apple.com') {
      return res.status(401).json({ success: false, mensagem: 'Issuer inválido.' });
    }

    // Verificar audience
    if (payload.aud !== APPLE_CLIENT_ID) {
      return res.status(401).json({ success: false, mensagem: 'Audience inválido.' });
    }

    // Verificar assinatura RSA
    const chaves = await buscarChavesApple();
    const chave = chaves.find(k => k.kid === header.kid);
    if (!chave) {
      return res.status(401).json({ success: false, mensagem: 'Chave Apple não encontrada.' });
    }

    const publicKey = crypto.createPublicKey({ format: 'jwk', key: chave });
    const mensagem = Buffer.from(partes[0] + '.' + partes[1]);
    const valido = crypto.verify(null, mensagem, publicKey, assinatura);

    if (!valido) {
      return res.status(401).json({ success: false, mensagem: 'Assinatura Apple inválida.' });
    }

    const { sub: appleId, email } = payload;

    // F-007: ligar por email exige email VERIFICADO (Apple devolve boolean ou "true")
    const emailVerificado =
      payload.email_verified === true || payload.email_verified === 'true';

    // Procurar ou criar utilizador
    let usuario = await prisma.user.findUnique({ where: { appleId } });

    // Gate apenas para contas ainda não ligadas a este appleId: sem email
    // verificado, quem controle um email não verificado da vítima assumia a conta
    if (!usuario && email && !emailVerificado) {
      return res.status(401).json({
        success: false,
        mensagem:
          'Email não verificado pela Apple. Inicia sessão com a tua senha para associar a conta Apple.'
      });
    }

    if (!usuario && email) {
      usuario = await prisma.user.findUnique({ where: { email } });
      if (usuario) {
        usuario = await prisma.user.update({
          where: { id: usuario.id },
          data: { appleId, ultimoLogin: new Date() }
        });
      }
    }

    if (!usuario) {
      const nomeCompleto = nome || email?.split('@')[0] || 'Utilizador Apple';
      usuario = await prisma.user.create({
        data: {
          appleId,
          email: email || `${appleId}@apple.privado`,
          nome: nomeCompleto,
          senha: null,
          dataNascimento: new Date('2000-01-01'),
          sexo: 'OUTRO',
          morada: '',
          verificado: true,
          ultimoLogin: new Date()
        }
      });
    }

    const { accessToken, refreshToken } = gerarTokens(usuario.id);

    await prisma.user.update({
      where: { id: usuario.id },
      data: { refreshToken, ultimoLogin: new Date() }
    });

    // F-019: refresh token também em cookie httpOnly
    definirCookieRefresh(res, refreshToken);

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        verificado: usuario.verificado
      }
    });

  } catch (err) {
    console.error('[APPLE] Erro:', err.message);
    return res.status(401).json({ success: false, mensagem: 'Token Apple inválido ou expirado.' });
  }
};

module.exports = { loginComApple };
