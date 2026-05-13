const { OAuth2Client } = require('google-auth-library');
const prisma = require('../../../lib/prisma');
const { gerarTokens } = require('../../../middleware/auth');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const buscarInfoUsuarioGoogle = async (accessToken) => {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`
  );
  if (!response.ok) throw new Error('Falha ao obter dados do Google');
  return response.json();
};

const loginComGoogle = async (req, res, next) => {
  try {
    const { credential, access_token } = req.body;

    if (!credential && !access_token) {
      return res.status(400).json({
        success: false,
        mensagem: 'Credencial ou token de acesso Google não fornecidos.'
      });
    }

    if (!googleClient) {
      return res.status(500).json({
        success: false,
        mensagem: 'Google OAuth não configurado. Configura GOOGLE_CLIENT_ID no .env'
      });
    }

    let payload;

    // Suporta dois fluxos:
    // 1. credential (ID Token) - do GoogleLogin component
    // 2. access_token - do useGoogleLogin hook
    if (credential) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      const userInfo = await buscarInfoUsuarioGoogle(access_token);
      payload = {
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      };
    }

    if (!payload) {
      return res.status(401).json({ success: false, mensagem: 'Token Google inválido.' });
    }

    const { sub: googleId, email, name } = payload;

    let usuario = await prisma.user.findUnique({ where: { googleId } });

    if (!usuario) {
      usuario = await prisma.user.findUnique({ where: { email } });
      if (usuario) {
        usuario = await prisma.user.update({
          where: { id: usuario.id },
          data: { googleId, ultimoLogin: new Date() }
        });
      }
    }

    if (!usuario) {
      const nomeCompleto = name || email.split('@')[0];
      usuario = await prisma.user.create({
        data: {
          googleId,
          email,
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

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        verificado: usuario.verificado
      },
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        verificado: usuario.verificado
      }
    });

  } catch (err) {
    if (err.message?.includes('invalid_token') || err.message?.includes('Token used too late')) {
      return res.status(401).json({ success: false, mensagem: 'Token Google expirado ou inválido.' });
    }
    next(err);
  }
};

module.exports = { loginComGoogle };
