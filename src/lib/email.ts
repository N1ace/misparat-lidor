import { Resend } from "resend";

export interface EmailProvider {
  send(to: string, subject: string, text: string): Promise<void>;
}

export class ResendEmailProvider implements EmailProvider {
  private client: Resend;
  constructor(
    apiKey: string,
    private from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject,
      text,
    });
    if (error) throw new Error(error.message);
  }
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(to: string, subject: string, text: string): Promise<void> {
    console.log(`[EMAIL → ${to}] ${subject}\n${text}`);
  }
}

export function getEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "מספרת לידור <onboarding@resend.dev>";
  if (key) return new ResendEmailProvider(key, from);
  return new ConsoleEmailProvider();
}
