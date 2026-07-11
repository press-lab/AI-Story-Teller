/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { logoutBackendSession, type BackendSessionState } from "./backendApi";

describe("backend account requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends logout as a keepalive revocation request", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, _init) => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const session: BackendSessionState = {
      sessionToken: "session-token",
      user: {
        id: "user-1",
        email: "reader@example.com",
        displayName: "Reader",
        status: "active",
        emailVerified: true,
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
      profile: {
        userId: "user-1",
        displayName: "Reader",
        bio: "",
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
    };

    await logoutBackendSession({ mode: "backendLocal", apiBaseUrl: "https://api.example.com" }, session);

    const logoutCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/auth/logout"));
    expect(logoutCall).toBeDefined();
    expect(logoutCall?.[1]).toEqual(expect.objectContaining({
      method: "POST",
      keepalive: true,
      headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
    }));
  });
});
