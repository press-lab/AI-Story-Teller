import { useEffect, useState } from "react";
import type { BackendCapabilities, BackendPasswordSignupResult, BackendSessionState } from "../runtime/backendApi";
import { Field } from "./shared";

type AuthMode = "start" | "signup" | "login" | "forgot" | "reset";

interface WelcomePageProps {
  capabilities?: BackendCapabilities;
  onSignupPassword: (input: { inviteToken: string; email: string; password: string; displayName?: string }) => Promise<BackendPasswordSignupResult>;
  onVerifyEmail: (token: string) => Promise<BackendSessionState>;
  onLoginPassword: (input: { email: string; password: string }) => Promise<BackendSessionState>;
  onRequestPasswordReset: (email: string) => Promise<{ ok: true; message: string }>;
  onConfirmPasswordReset: (token: string, password: string) => Promise<{ ok: true }>;
  onStartGoogleOAuth: (input: { inviteToken?: string; returnTo?: string }) => Promise<{ authUrl: string; expiresAt: string }>;
}

export function WelcomePage({
  capabilities = {
    passwordLogin: true,
    passwordSignup: true,
    passwordReset: true,
    emailVerificationDelivery: true,
    googleOAuth: true,
  },
  onSignupPassword,
  onVerifyEmail,
  onLoginPassword,
  onRequestPasswordReset,
  onConfirmPasswordReset,
  onStartGoogleOAuth,
}: WelcomePageProps) {
  const [inviteToken, setInviteToken] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AuthMode>("start");
  const [passwordResetToken, setPasswordResetToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const verificationToken = params.get("verifyEmail");
    const resetToken = params.get("passwordReset");
    if (!verificationToken && !resetToken) return;
    history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}`);
    if (verificationToken) {
      void run("Verifying email", async () => {
        await onVerifyEmail(verificationToken);
        setStatus("Email verified. Signed in.");
      });
      return;
    }
    setPasswordResetToken(resetToken ?? "");
    setPassword("");
    setMode("reset");
    setStatus("Enter a new password for your account.");
  // The auth action fragment is consumed once when the welcome screen mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    setStatus(`${label}...`);
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  function requireFields(message: string, values: string[]): boolean {
    if (values.every((value) => value.trim())) return true;
    setStatus(message);
    return false;
  }

  function chooseMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStatus("");
  }

  return (
    <main className="welcome-page">
      <section className="welcome-shell">
        <div className="welcome-copy">
          <p className="eyebrow">AI Story Teller</p>
          <h1>Sign in to continue.</h1>
          <p>
            This build requires an account. Use an invite code to create an account on the owner-hosted backend,
            then open Explore, publish scenarios, and play saved adventures from your profile.
          </p>
          <div className="welcome-checks" aria-label="Account features">
            <span>Invite-only signup</span>
            <span>Google or email login</span>
            <span>Backend-saved adventures</span>
            <span>Scenario publishing</span>
          </div>
          <p className="muted">
            Hosted adventures and model context are stored by the service and sent to the configured model provider for generation. They are not end-to-end encrypted correspondence.
          </p>
        </div>

        <section className="welcome-panel panel" aria-label="Sign in">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Account</p>
              <h2>{mode === "login" ? "Log In" : mode === "signup" ? "Sign Up" : mode === "forgot" ? "Reset Password" : mode === "reset" ? "Choose New Password" : "Welcome"}</h2>
              <p className="muted">
                {mode === "login"
                  ? "Use your existing account email and password, or continue with Google."
                  : mode === "signup"
                    ? "Create an invited account with email and password, or use the invite token with Google."
                    : mode === "forgot"
                      ? "Enter your account email. The response is the same whether or not an account exists."
                    : mode === "reset"
                      ? "Choose a new password. Completing the reset signs out every existing session."
                    : "Log in to an existing account or create a new account with an invite token."}
              </p>
            </div>
          </div>

          {status && <p className="notice">{status}</p>}
          {!capabilities.passwordSignup && (
            <p className="notice">New account signup and email recovery are disabled during controlled UAT. Existing verified users can still log in.</p>
          )}

          {mode === "signup" && (
            <div className="grid two">
              <Field label="Invite token">
                <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              <Field label="Display name">
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </Field>
              <Field label="Password">
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </Field>
            </div>
          )}

          {(mode === "login" || mode === "forgot") && (
            <div className="grid two">
              <Field label="Email">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              {mode === "login" && (
                <Field label="Password">
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </Field>
              )}
            </div>
          )}

          {mode === "reset" && (
            <Field label="New password">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
          )}

          <div className="welcome-actions">
            {mode === "start" && (
              <>
                <button type="button" className="primary-action" disabled={busy} onClick={() => chooseMode("login")}>
                  Log in
                </button>
                {capabilities.passwordSignup && <button type="button" disabled={busy} onClick={() => chooseMode("signup")}>Sign up</button>}
                <button
                  type="button"
                  disabled={busy || !capabilities.googleOAuth}
                  onClick={() => void run("Opening Google", async () => {
                    const result = await onStartGoogleOAuth({ returnTo: window.location.href });
                    window.location.assign(result.authUrl);
                  })}
                >
                  Continue with Google
                </button>
              </>
            )}

            {mode === "signup" && (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={busy}
                  onClick={() => void run("Signing up", async () => {
                    if (!requireFields("Enter an invite token, email, and password to sign up.", [inviteToken, email, password])) return;
                    const result = await onSignupPassword({
                      inviteToken: inviteToken.trim(),
                      email: email.trim(),
                      password,
                      displayName: displayName.trim() || undefined,
                    });
                    setStatus(result.message);
                  })}
                >
                  Create account
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run("Opening Google", async () => {
                    if (!requireFields("Enter an invite token to continue with Google.", [inviteToken])) return;
                    const result = await onStartGoogleOAuth({
                      inviteToken: inviteToken.trim(),
                      returnTo: window.location.href,
                    });
                    window.location.assign(result.authUrl);
                  })}
                >
                  Continue with Google
                </button>
                <button type="button" disabled={busy} onClick={() => chooseMode("start")}>
                  Back
                </button>
              </>
            )}

            {mode === "login" && (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={busy}
                  onClick={() => void run("Logging in", async () => {
                    if (!requireFields("Enter your email and password to log in.", [email, password])) return;
                    await onLoginPassword({ email: email.trim(), password });
                    setStatus("Signed in.");
                  })}
                >
                  Log in
                </button>
                {capabilities.passwordReset && <button type="button" disabled={busy} onClick={() => chooseMode("forgot")}>Forgot password?</button>}
                <button
                  type="button"
                  disabled={busy || !capabilities.googleOAuth}
                  onClick={() => void run("Opening Google", async () => {
                    const result = await onStartGoogleOAuth({ returnTo: window.location.href });
                    window.location.assign(result.authUrl);
                  })}
                >
                  Continue with Google
                </button>
                <button type="button" disabled={busy} onClick={() => chooseMode("start")}>
                  Back
                </button>
              </>
            )}

            {mode === "forgot" && (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={busy}
                  onClick={() => void run("Requesting password reset", async () => {
                    if (!requireFields("Enter your email to request a password reset.", [email])) return;
                    const result = await onRequestPasswordReset(email.trim());
                    setStatus(result.message);
                  })}
                >
                  Send reset link
                </button>
                <button type="button" disabled={busy} onClick={() => chooseMode("login")}>Back</button>
              </>
            )}

            {mode === "reset" && (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={busy}
                  onClick={() => void run("Resetting password", async () => {
                    if (!requireFields("Enter a new password.", [password])) return;
                    await onConfirmPasswordReset(passwordResetToken, password);
                    setPassword("");
                    setMode("login");
                    setStatus("Password reset. Log in with your new password.");
                  })}
                >
                  Reset password
                </button>
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
