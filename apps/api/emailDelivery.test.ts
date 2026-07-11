import { describe, expect, it, vi } from "vitest";
import { loadApiConfig } from "./config";
import { configuredEmailDelivery } from "./emailDelivery";

describe("transactional email delivery", () => {
  it("sends verification messages through Resend with server-owned credentials", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => (
      new Response(JSON.stringify({ id: "email-1" }), { status: 200 })
    ));
    const delivery = configuredEmailDelivery(loadApiConfig({
      resendApiKey: "resend-secret",
      emailFrom: "Story Mode AI <accounts@example.com>",
      fetchImpl,
    }));

    await delivery.sendVerificationEmail({
      to: "player@example.com",
      verificationUrl: "https://story.example.com/#verifyEmail=one-use-token",
      expiresAt: "2026-07-11T00:00:00.000Z",
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer resend-secret" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: "Story Mode AI <accounts@example.com>",
      to: ["player@example.com"],
      subject: "Verify your Story Mode AI account",
    });
  });

  it("reports only the Resend status when delivery fails", async () => {
    const delivery = configuredEmailDelivery(loadApiConfig({
      resendApiKey: "resend-secret",
      emailFrom: "Story Mode AI <accounts@example.com>",
      fetchImpl: async () => new Response("provider-internal-detail", { status: 503 }),
    }));

    await expect(delivery.sendPasswordResetEmail({
      to: "player@example.com",
      resetUrl: "https://story.example.com/#passwordReset=one-use-token",
      expiresAt: "2026-07-11T00:00:00.000Z",
    })).rejects.toThrow("Transactional email delivery failed (HTTP 503).");
  });
});
