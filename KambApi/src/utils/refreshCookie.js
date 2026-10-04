// src/utils/refreshCookie.js
//
// F-019: o refresh token vive num cookie httpOnly — o JavaScript (e logo
// qualquer XSS) não o consegue ler, eliminando o roubo de sessão com
// renovação infinita que existia com o refresh token no localStorage.
//
// - httpOnly: invisível ao JS (não aparece em document.cookie)
// - path /api/auth: só é enviado às rotas de auth (refresh/logout/...)
// - Produção (Vercel → Render) é cross-site, portanto SameSite=None + Secure
//   (obrigatório: com Lax/Strict o navegador nem enviaria o cookie no XHR)
// - Desenvolvimento (localhost) é o mesmo site: Lax chega e não exige Secure

const EM_PRODUCAO = process.env.NODE_ENV === 'production';

const opcoesBase = () => ({
  httpOnly: true,
  secure: EM_PRODUCAO,
  sameSite: EM_PRODUCAO ? 'none' : 'lax',
  path: '/api/auth',
});

/** Regista o refresh token num cookie httpOnly (7 dias = expiresIn do JWT). */
const definirCookieRefresh = (res, refreshToken) =>
  res.cookie('refreshToken', refreshToken, {
    ...opcoesBase(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

/** Remove o cookie — tem de usar EXATAMENTE os mesmos atributos do set. */
const limparCookieRefresh = (res) => res.clearCookie('refreshToken', opcoesBase());

module.exports = { definirCookieRefresh, limparCookieRefresh };
