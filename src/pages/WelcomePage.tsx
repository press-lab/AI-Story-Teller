import { useState } from "react";
import type { BackendSessionState } from "../runtime/backendApi";
import { Field } from "./shared";

type AuthMode = "start" | "signup" | "login";

interface WelcomePageProps {
  onSignupPassword: (input: { inviteToken: string; email: string; password: string; displayName?: string }) => Promise<{ verificationToken: string }>;
  onVerifyEmail: (token: string) => Promise<BackendSessionState>;
  onLoginPassword: (input: { email: string; password: string }) => Promise<BackendSessionState>;
  onStartGoogleOAuth: (input: { inviteToken?: string; returnTo?: string }) => Promise<{ authUrl: string; expiresAt: string }>;
}

export function WelcomePage({
  onSignupPassword,
  onVerifyEmail,
  onLoginPassword,
  onStartGoogleOAuth,
}: WelcomePageProps) {
  const [inviteToken, setInviteToken] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AuthMode>("start");

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
        </div>

        <section className="welcome-panel panel" aria-label="Sign in">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Account</p>
              <h2>{mode === "login" ? "Log In" : mode === "signup" ? "Sign Up" : "Welcome"}</h2>
              <p className="muted">
                {mode === "login"
                  ? "Use your existing account email and password, or continue with Google."
                  : mode === "signup"
                    ? "Create an invited account with email and password, or use the invite token with Google."
                    : "Log in to an existing account or create a new account with an invite token."}
              </p>
            </div>
          </div>

          {status && <p className="notice">{status}</p>}

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

          {mode === "login" && (
            <div className="grid two">
              <Field label="Email">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              <Field label="Password">
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </Field>
            </div>
          )}

          <div className="welcome-actions">
            {mode === "start" && (
              <>
                <button type="button" className="primary-action" disabled={busy} onClick={() => chooseMode("login")}>
                  Log in
                </button>
                <button type="button" disabled={busy} onClick={() => chooseMode("signup")}>
                  Sign up
                </button>
                <button
                  type="button"
                  disabled={busy}
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
                    await onVerifyEmail(result.verificationToken);
                    setStatus("Signed in.");
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
                <button
                  type="button"
                  disabled={busy}
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
          </div>
        </section>
      </section>
    </main>
  );
}
