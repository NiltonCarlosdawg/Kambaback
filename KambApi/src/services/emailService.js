const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (to, otp, nome) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0B0E11; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #cbfb46; border-radius: 12px; margin-bottom: 12px;">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="black"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"/></svg>
        </div>
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">KambaPro</h1>
      </div>
      <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 8px;">Olá, ${nome}!</h2>
      <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Recebemos um pedido de redefinição de palavra-passe para a tua conta. Utiliza o código abaixo para redefinir a tua senha:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: #1a1d23; padding: 20px 40px; border-radius: 12px; border: 1px solid #2a2d33; letter-spacing: 12px; font-size: 32px; font-weight: 700; color: #cbfb46;">
          ${otp}
        </div>
      </div>
      <p style="color: #a0a0a0; font-size: 13px; line-height: 1.5; margin: 0;">
        Este código expira em <strong style="color: #ffffff;">10 minutos</strong>. Se não fizeste este pedido, ignora este email.
      </p>
      <hr style="border: none; border-top: 1px solid #2a2d33; margin: 32px 0;" />
      <p style="color: #666; font-size: 11px; text-align: center; margin: 0;">
        KambaPro — Gestão financeira simplificada
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"KambaPro" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Redefinição de palavra-passe — Código OTP',
    html,
  });
};

module.exports = { sendOTPEmail, transporter };
