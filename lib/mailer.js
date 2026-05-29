import nodemailer from "nodemailer";

// Gmail transporter.
// IMPORTANT: EMAIL_PASS must be a Google "App password", not your normal Gmail
// password. Generate one at: https://myaccount.google.com/apppasswords
// (Requires 2-Step Verification to be enabled on the account.)
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return transporter;
}

const FROM = () => `"Taskly" <${process.env.EMAIL_USER}>`;

// Simple HTML template using brand colors.
const codeEmailHtml = (title, code, intro) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#F4F1EA; padding:32px;">
    <div style="max-width:480px; margin:auto; background:#FFFFFF; border-radius:22px; padding:32px; border:1px solid #E7E1D6;">
      <div style="width:48px; height:48px; border-radius:14px; background:#FF6B4A; color:#FFF; font-size:28px; font-weight:700; text-align:center; line-height:48px; margin-bottom:18px;">T</div>
      <h1 style="margin:0 0 8px; font-size:22px; color:#1C1A17;">${title}</h1>
      <p style="margin:0 0 22px; font-size:14px; color:#6B6359; line-height:1.5;">${intro}</p>
      <div style="background:#FBF9F4; border:1px solid #E7E1D6; border-radius:14px; padding:18px; text-align:center;">
        <div style="font-size:12px; font-weight:700; letter-spacing:1.5px; color:#A39A8C; text-transform:uppercase; margin-bottom:6px;">Your code</div>
        <div style="font-size:36px; font-weight:700; letter-spacing:8px; color:#1C1A17; font-family:'Courier New',monospace;">${code}</div>
      </div>
      <p style="margin:18px 0 0; font-size:12px; color:#A39A8C;">This code expires in 15 minutes. If you didn't request this, you can ignore the email.</p>
    </div>
  </div>
`;

export async function sendVerificationEmail(to, code) {
  await getTransporter().sendMail({
    from: FROM(),
    to,
    subject: "Verify your Taskly account",
    html: codeEmailHtml(
      "Welcome to Taskly",
      code,
      "Enter the code below in the app to finish creating your account."
    ),
  });
}

export async function sendPasswordResetEmail(to, code) {
  await getTransporter().sendMail({
    from: FROM(),
    to,
    subject: "Reset your Taskly password",
    html: codeEmailHtml(
      "Password reset",
      code,
      "Enter the code below in the app to set a new password."
    ),
  });
}
