/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

function signupResult() {
  return {
    user: session().user,
    profile: session().profile,
    verificationRequired: true as const,
    message: "Check your email for a verification link.",
  };
}

describe("WelcomePage", () => {
  afterEach(() => {
    cleanup();
    history.replaceState(history.state, "", "/");
    vi.restoreAllMocks();
  });

  it("keeps existing login available while hiding disabled email capabilities", () => {
    render(
      <WelcomePage
        capabilities={{ passwordLogin: true, passwordSignup: false, passwordReset: false, emailVerificationDelivery: false, googleOAuth: false }}
        onSignupPassword={vi.fn(async () => signupResult())}
        onVerifyEmail={vi.fn(async () => session())}
        onLoginPassword={vi.fn(async () => session())}
        onRequestPasswordReset={vi.fn(async () => ({ ok: true as const, message: "unused" }))}
        onConfirmPasswordReset={vi.fn(async () => ({ ok: true as const }))}
        onStartGoogleOAuth={vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }))}
      />,
    );
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    expect(screen.getByText(/disabled during controlled UAT/i)).toBeInTheDocument();
  });

  it("signs up with an invite and waits for email verification without exposing a token", async () => {
    const user = userEvent.setup();
    const onSignupPassword = vi.fn(async () => signupResult());
    const onVerifyEmail = vi.fn(async () => session());

    render(
      <WelcomePage
        onSignupPassword={onSignupPassword}
        onVerifyEmail={onVerifyEmail}
        onLoginPassword={vi.fn(async () => session())}
        onRequestPasswordReset={vi.fn(async () => ({ ok: true as const, message: "If an account exists for that email, a password-reset link has been sent." }))}
        onConfirmPasswordReset={vi.fn(async () => ({ ok: true as const }))}
        onStartGoogleOAuth={vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }))}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await user.type(screen.getByLabelText("Invite token"), "invite-1");
    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Display name"), "Player");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSignupPassword).toHaveBeenCalledWith({
      inviteToken: "invite-1",
      email: "player@example.com",
      password: "correct horse battery staple",
      displayName: "Player",
    });
    expect(onVerifyEmail).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Verification token")).not.toBeInTheDocument();
    expect(screen.getByText("Check your email for a verification link.")).toBeInTheDocument();
  });

  it("logs in existing users without exposing the app shell", async () => {
    const user = userEvent.setup();
    const onLoginPassword = vi.fn(async () => session());

    render(
      <WelcomePage
        onSignupPassword={vi.fn(async () => signupResult())}
        onVerifyEmail={vi.fn(async () => session())}
        onLoginPassword={onLoginPassword}
        onRequestPasswordReset={vi.fn(async () => ({ ok: true as const, message: "If an account exists for that email, a password-reset link has been sent." }))}
        onConfirmPasswordReset={vi.fn(async () => ({ ok: true as const }))}
        onStartGoogleOAuth={vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }))}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Log in" }));
    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(onLoginPassword).toHaveBeenCalledWith({ email: "player@example.com", password: "password" });
    expect(screen.queryByRole("button", { name: "Library" })).not.toBeInTheDocument();
  });

  it("consumes an emailed verification link and removes the token from the URL", async () => {
    const onVerifyEmail = vi.fn(async () => session());
    window.location.hash = "verifyEmail=verification-from-email";

    render(
      <WelcomePage
        onSignupPassword={vi.fn(async () => signupResult())}
        onVerifyEmail={onVerifyEmail}
        onLoginPassword={vi.fn(async () => session())}
        onRequestPasswordReset={vi.fn(async () => ({ ok: true as const, message: "If an account exists for that email, a password-reset link has been sent." }))}
        onConfirmPasswordReset={vi.fn(async () => ({ ok: true as const }))}
        onStartGoogleOAuth={vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }))}
      />,
    );

    await waitFor(() => expect(onVerifyEmail).toHaveBeenCalledWith("verification-from-email"));
    expect(window.location.hash).toBe("");
  });

  it("opens dedicated auth screens and shows missing-field guidance", async () => {
    const user = userEvent.setup();
    const onLoginPassword = vi.fn(async () => session());
    const onStartGoogleOAuth = vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }));

    render(
      <WelcomePage
        onSignupPassword={vi.fn(async () => signupResult())}
        onVerifyEmail={vi.fn(async () => session())}
        onLoginPassword={onLoginPassword}
        onRequestPasswordReset={vi.fn(async () => ({ ok: true as const, message: "If an account exists for that email, a password-reset link has been sent." }))}
        onConfirmPasswordReset={vi.fn(async () => ({ ok: true as const }))}
        onStartGoogleOAuth={onStartGoogleOAuth}
      />,
    );

    expect(screen.queryByLabelText("Backend API URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByRole("heading", { name: "Log In" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Invite token")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter your email and password to log in.")).toBeInTheDocument();
    expect(onLoginPassword).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByRole("heading", { name: "Sign Up" })).toBeInTheDocument();
    expect(screen.getByLabelText("Invite token")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(screen.getByText("Enter an invite token to continue with Google.")).toBeInTheDocument();
    expect(onStartGoogleOAuth).not.toHaveBeenCalled();
  });

  it("requests a reset and consumes a reset link without exposing its token in the form", async () => {
    const user = userEvent.setup();
    const onRequestPasswordReset = vi.fn(async () => ({
      ok: true as const,
      message: "If an account exists for that email, a password-reset link has been sent.",
    }));
    const onConfirmPasswordReset = vi.fn(async () => ({ ok: true as const }));

    const { unmount } = render(
      <WelcomePage
        onSignupPassword={vi.fn(async () => signupResult())}
        onVerifyEmail={vi.fn(async () => session())}
        onLoginPassword={vi.fn(async () => session())}
        onRequestPasswordReset={onRequestPasswordReset}
        onConfirmPasswordReset={onConfirmPasswordReset}
        onStartGoogleOAuth={vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }))}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(onRequestPasswordReset).toHaveBeenCalledWith("player@example.com");
    unmount();

    window.location.hash = "passwordReset=reset-from-email";
    render(
      <WelcomePage
        onSignupPassword={vi.fn(async () => signupResult())}
        onVerifyEmail={vi.fn(async () => session())}
        onLoginPassword={vi.fn(async () => session())}
        onRequestPasswordReset={onRequestPasswordReset}
        onConfirmPasswordReset={onConfirmPasswordReset}
        onStartGoogleOAuth={vi.fn(async () => ({ authUrl: "https://accounts.google.com/", expiresAt: timestamp }))}
      />,
    );
    expect(screen.getByRole("heading", { name: "Choose New Password" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("reset-from-email")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("New password"), "new correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(onConfirmPasswordReset).toHaveBeenCalledWith("reset-from-email", "new correct horse battery staple");
    expect(screen.getByText("Password reset. Log in with your new password.")).toBeInTheDocument();
  });
});
