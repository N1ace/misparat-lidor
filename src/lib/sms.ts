export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

export class HttpSmsProvider implements SmsProvider {
  constructor(
    private url: string,
    private apiKey: string,
    private senderId: string,
  ) {}

  async send(to: string, body: string): Promise<void> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        to,
        from: this.senderId,
        message: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`SMS API ${res.status}: ${text.slice(0, 200)}`);
    }
  }
}

export class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, body: string): Promise<void> {
    console.log(`[SMS → ${to}] ${body}`);
  }
}

export function getSmsProvider(): SmsProvider {
  const url = process.env.SMS_API_URL;
  const key = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER_ID;
  if (url && key && sender) return new HttpSmsProvider(url, key, sender);
  return new ConsoleSmsProvider();
}
