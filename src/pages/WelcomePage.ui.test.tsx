/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BackendSessionState } from "../runtime/backendApi";
import { WelcomePage } from "./WelcomePage";

const timestamp = "2026-07-05T00:00:00.000Z";

function session(): BackendSessionState {
  return {
    sessionToken: "session-test",
    user: {
      id: "user-test",
      email: "player@example.com",
      displayName: "Player",
      status: "active",
      emailVerified: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    profile: {
      userId: "user-test",
      displayName: "Player",
      bio: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

describe("WelcomePage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("signs up with an invite and surfaces the verification token", async () => {
    const user = userEvent.setup();
    const onSignupPassword = vi.fn(async () => ({ verificationToken: "verify-token" }));

    render(
      <WelcomePage
        runtimeConfig={{ mode: "backendLocal", apiBaseUrl: "http://127.0.0.1:8787" }}
        onRuntimeConfigChange={vi.fn()}
        onSignupPassword={onSignupPassword}
        onVerifyEmail={vi.fn(async () => session())}
        onLoginPassword={vi.fn(async () => session())}
        onStartGoogleOAuth={vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }))}
      />,
    );

    await user.type(screen.getByLabelText("Invite token"), "invite-1");
    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Display name"), "Player");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(onSignupPassword).toHaveBeenCalledWith({
      inviteToken: "invite-1",
      email: "player@example.com",
      password: "correct horse battery staple",
      displayName: "Player",
    });
    expect(screen.getByDisplayValue("verify-token")).toBeInTheDocument();
    expect(screen.getByText("Signup created. Verify the account to continue.")).toBeInTheDocument();
  });

  it("logs in existing users without exposing the app shell", async () => {
    const user = userEvent.setup();
    const onLoginPassword = vi.fn(async () => session());

    render(
      <WelcomePage
        runtimeConfig={{ mode: "backendLocal", apiBaseUrl: "http://127.0.0.1:8787" }}
        onRuntimeConfigChange={vi.fn()}
        onSignupPassword={vi.fn(async () => ({ verificationToken: "verify-token" }))}
        onVerifyEmail={vi.fn(async () => session())}
        onLoginPassword={onLoginPassword}
        onStartGoogleOAuth={vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }))}
      />,
    );

    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(onLoginPassword).toHaveBeenCalledWith({ email: "player@example.com", password: "password" });
    expect(screen.queryByRole("button", { name: "Library" })).not.toBeInTheDocument();
  });
});
