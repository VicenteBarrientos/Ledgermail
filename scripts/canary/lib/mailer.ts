import nodemailer from "nodemailer";

export interface MailerConfig {
  smtpUser: string;
  smtpPass: string;
  targetEmail: string;
}

export function getMailerConfigFromEnv(): MailerConfig {
  const smtpUser = process.env.CANARY_SMTP_USER;
  const smtpPass = process.env.CANARY_SMTP_PASS;
  const targetEmail = process.env.CANARY_TARGET_EMAIL;

  if (!smtpUser || !smtpPass || !targetEmail) {
    throw new Error(
      "Missing canary SMTP config. Set CANARY_SMTP_USER, CANARY_SMTP_PASS (Gmail App Password) " +
      "and CANARY_TARGET_EMAIL (the monitored LedgerMail test inbox) in your environment."
    );
  }

  return { smtpUser, smtpPass, targetEmail };
}

/**
 * Sends the synthetic test email to the monitored LedgerMail test inbox.
 *
 * Uses a plain Gmail SMTP App Password rather than the OAuth flow LedgerMail
 * itself uses to *read* mail — sending only needs a normal account, and
 * keeping it separate from LedgerMail's gmail.readonly OAuth grant avoids
 * mixing sender/reader credentials.
 */
export async function sendCanaryEmail(config: MailerConfig, subject: string, html: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });

  await transporter.sendMail({
    from: config.smtpUser,
    to: config.targetEmail,
    subject,
    html
  });
}
