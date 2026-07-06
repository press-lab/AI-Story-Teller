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

  it("signs up with an invite and verifies without exposing the verification token", async () => {
    const user = userEvent.setup();
    const onSignupPassword = vi.fn(async () => ({ verificationToken: "verify-token" }));
    const onVerifyEmail = vi.fn(async () => session());

    render(
      <WelcomePage
        onSignupPassword={onSignupPassword}
        onVerifyEmail={onVerifyEmail}
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
    expect(onVerifyEmail).toHaveBeenCalledWith("verify-token");
    expect(screen.queryByLabelText("Verification token")).not.toBeInTheDocument();
    expect(screen.getByText("Signed in.")).toBeInTheDocument();
  });

  it("logs in existing users without exposing the app shell", async () => {
    const user = userEvent.setup();
    const onLoginPassword = vi.fn(async () => session());

    render(
      <WelcomePage
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

  it("keeps auth actions clickable and shows missing-field guidance", async () => {
    const user = userEvent.setup();
    const onLoginPassword = vi.fn(async () => session());
    const onStartGoogleOAuth = vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }));

    render(
      <WelcomePage
        onSignupPassword={vi.fn(async () => ({ verificationToken: "verify-token" }))}
        onVerifyEmail={vi.fn(async () => session())}
        onLoginPassword={onLoginPassword}
        onStartGoogleOAuth={onStartGoogleOAuth}
      />,
    );

    expect(screen.queryByLabelText("Backend API URL")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter your email and password to log in.")).toBeInTheDocument();
    expect(onLoginPassword).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(screen.getByText("Enter an invite token to continue with Google.")).toBeInTheDocument();
    expect(onStartGoogleOAuth).not.toHaveBeenCalled();
  });
});
