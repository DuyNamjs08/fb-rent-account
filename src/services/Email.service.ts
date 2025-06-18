import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true nếu dùng port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const EmailService = {
  sendVerificationEmail: async (
    to: string,
    verifyLink: string,
  ): Promise<void> => {
    const subject = 'Xác nhận tài khoản của bạn';
    const html = `
      <p>Chào bạn,</p>
      <p>Chúng tôi nhận được yêu cầu tạo tài khoản với email này.</p>
      <p>Nếu bạn thực sự yêu cầu, hãy nhấn nút bên dưới để xác nhận:</p>
      
      <a href="${verifyLink}&email=${to}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">✔ Vâng, là tôi</a>

      <p style="margin-top: 20px;">Nếu bạn không thực hiện yêu cầu này, bạn có thể bỏ qua email này hoặc nhấn nút dưới đây:</p>

      <a href="${verifyLink}&cancel=true" style="display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">✖ Không phải tôi</a>

      <p style="margin-top: 20px; font-size: 12px; color: #666;">Email này sẽ hết hạn sau một khoảng thời gian. Vui lòng xác nhận sớm.</p>
    `;

    await transporter.sendMail({
      from: `"No Reply" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  },
};
