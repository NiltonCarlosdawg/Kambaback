const { OAuth2Client } = require('google-auth-library');
const prisma = require('../../../lib/prisma');
const { gerarTokens } = require('../../../middleware/auth');
const { definirCookieRefresh } = require('../../../utils/refreshCookie');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const buscarInfoUsuarioGoogle = async (accessToken) => {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`
  );
  if (!response.ok) throw new Error('Falha ao obter dados do Google');
  return response.json();
};

// F-007: no fluxo access_token não há verifyIdToken, por isso validamos a
// audience do token contra o GOOGLE_CLIENT_ID via endpoint tokeninfo do Google
const verificarAudienceGoogle = async (accessToken) => {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!response.ok) return null;
  const info = await response.json();
  const aud = info.aud;
  const aceite = Array.isArray(aud) ? aud.includes(GOOGLE_CLIENT_ID) : aud === GOOGLE_CLIENT_ID;
  return aceite ? info : null;
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
      // F-007: valida que o access_token foi emitido para a NOSSA app
      const infoAud = await verificarAudienceGoogle(access_token);
      if (!infoAud) {
        return res.status(401).json({
          success: false,
          mensagem: 'Token Google não foi emitido para esta aplicação.'
        });
      }
      const userInfo = await buscarInfoUsuarioGoogle(access_token);
      payload = {
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        email_verified: userInfo.email_verified ?? infoAud.email_verified,
      };
    }

    if (!payload) {
      return res.status(401).json({ success: false, mensagem: 'Token Google inválido.' });
    }

    const { sub: googleId, email, name } = payload;

    let usuario = await prisma.user.findUnique({ where: { googleId } });

    // F-007: ligar por email exige email VERIFICADO pelo Google — sem isto,
    // quem controle um email não verificado com o nome da vítima assumia a conta
    const emailVerificado =
      payload.email_verified === true || payload.email_verified === 'true';

    if (!usuario && !emailVerificado) {
      return res.status(401).json({
        success: false,
        mensagem:
          'Email não verificado pelo Google. Inicia sessão com a tua senha para associar a conta Google.'
      });
    }

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
      data: { refreshToken: require('../../../utils/encryption').hash(refreshToken), ultimoLogin: new Date() }
    });

    // F-019: refresh token também em cookie httpOnly
    definirCookieRefresh(res, refreshToken);

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
