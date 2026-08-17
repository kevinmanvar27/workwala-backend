import nodemailer from 'nodemailer';
import { query } from './db';

async function getMailConfig() {
  try {
    const settings = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings WHERE group_name = 'mail' AND deleted_at IS NULL`
    );
    const cfg: Record<string, string> = {};
    settings.forEach((s) => (cfg[s.key_name] = s.value));
    return cfg;
  } catch {
    return {};
  }
}

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const cfg = await getMailConfig();

  const host = cfg.mail_host || process.env.MAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(cfg.mail_port || process.env.MAIL_PORT || '587');
  const user = cfg.mail_username || process.env.MAIL_USER || '';
  const pass = cfg.mail_password || process.env.MAIL_PASS || '';
  const fromAddr = cfg.mail_from_address || process.env.MAIL_FROM || user;
  const fromName = cfg.mail_from_name || 'WorkWala';

  // Fail loudly if mail credentials are not configured — prevents silent delivery failures
  if (!user || !pass || pass === 'your-app-password') {
    throw new Error(
      'Mail credentials not configured. Set MAIL_USER and MAIL_PASS in .env.local ' +
      'or configure them in the Admin → Settings → Mail panel.'
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to,
    subject,
    html,
  });
}
