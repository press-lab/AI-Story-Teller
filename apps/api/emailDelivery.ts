import type { ApiConfig } from "./config";

export interface VerificationEmailInput {
  to: string;
  verificationUrl: string;
  expiresAt: string;
}

export interface PasswordResetEmailInput {
  to: string;
  resetUrl: string;
  expiresAt: string;
}

export interface EmailDelivery {
  sendVerificationEmail(input: VerificationEmailInput): Promise<void>;
  sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void>;
}

export function configuredEmailDelivery(config: ApiConfig): EmailDelivery {
  if (config.emailDelivery) return config.emailDelivery;
  if (config.emailDeliveryMode === "disabled") return new DisabledEmailDelivery();
  if (config.resendApiKey && config.emailFrom) {
    return new ResendEmailDelivery(config.resendApiKey, config.emailFrom, config.fetchImpl);
  }
  return new MissingEmailDelivery();
}

class DisabledEmailDelivery implements EmailDelivery {
  async sendVerificationEmail(): Promise<void> {
    throw new Error("Account email is disabled during controlled UAT.");
  }

  async sendPasswordResetEmail(): Promise<void> {
    throw new Error("Account email is disabled during controlled UAT.");
  }
}

class MissingEmailDelivery implements EmailDelivery {
  async sendVerificationEmail(): Promise<void> {
    throw new Error("Transactional email is not configured. Set RESEND_API_KEY and AIST_EMAIL_FROM.");
  }

  async sendPasswordResetEmail(): Promise<void> {
    throw new Error("Transactional email is not configured. Set RESEND_API_KEY and AIST_EMAIL_FROM.");
  }
}

class ResendEmailDelivery implements EmailDelivery {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
    return this.send({
      to: input.to,
      subject: "Verify your AI Story Teller account",
      text: [
        "Verify your AI Story Teller account by opening this link:",
        input.verificationUrl,
        "",
        `This one-use link expires at ${input.expiresAt}.`,
      ].join("\n"),
    });
  }

  sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    return this.send({
      to: input.to,
      subject: "Reset your AI Story Teller password",
      text: [
        "Reset your AI Story Teller password by opening this link:",
        input.resetUrl,
        "",
        `This one-use link expires at ${input.expiresAt}.`,
        "If you did not request this reset, you can ignore this message.",
      ].join("\n"),
    });
  }

  private async send(input: { to: string; subject: string; text: string }): Promise<void> {
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Transactional email delivery failed (HTTP ${response.status}).`);
    }
  }
}
