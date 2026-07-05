import { useState } from "react";
import type { BackendSessionState } from "../runtime/backendApi";
import type { RuntimeConfig } from "../runtime/runtimeConfig";
import { Field } from "./shared";

interface WelcomePageProps {
  runtimeConfig: RuntimeConfig;
  onRuntimeConfigChange: (config: RuntimeConfig) => void;
  onSignupPassword: (input: { inviteToken: string; email: string; password: string; displayName?: string }) => Promise<{ verificationToken: string }>;
  onVerifyEmail: (token: string) => Promise<BackendSessionState>;
  onLoginPassword: (input: { email: string; password: string }) => Promise<BackendSessionState>;
  onStartGoogleOAuth: (input: { inviteToken?: string; returnTo?: string }) => Promise<{ authUrl: string; expiresAt: string }>;
}

export function WelcomePage({
  runtimeConfig,
  onRuntimeConfigChange,
  onSignupPassword,
  onVerifyEmail,
  onLoginPassword,
  onStartGoogleOAuth,
}: WelcomePageProps) {
  const [inviteToken, setInviteToken] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <main className="welcome-page">
      <section className="welcome-shell">
        <div className="welcome-copy">
          <p className="eyebrow">AI Story Teller</p>
          <h1>Sign in to continue.</h1>
          <p>
            This build requires an account. Use an invite code to create a backend account, then open Explore,
            publish scenarios, and play saved adventures from your profile.
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
              <h2>Welcome</h2>
              <p className="muted">Enter the local backend URL and sign in with an invited account.</p>
            </div>
          </div>

          {status && <p className="notice">{status}</p>}

          <div className="grid two">
            <Field label="Backend API URL">
              <input
                value={runtimeConfig.apiBaseUrl}
                onChange={(event) => onRuntimeConfigChange({
                  ...runtimeConfig,
                  mode: runtimeConfig.mode === "local" ? "backendLocal" : runtimeConfig.mode,
                  apiBaseUrl: event.target.value,
                })}
                placeholder="http://127.0.0.1:8787"
              />
            </Field>
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
            <Field label="Verification token">
              <input value={verificationToken} onChange={(event) => setVerificationToken(event.target.value)} />
            </Field>
          </div>

          <div className="welcome-actions">
            <button
              type="button"
              className="primary-action"
              disabled={busy || !inviteToken.trim() || !email.trim() || !password}
              onClick={() => void run("Signing up", async () => {
                const result = await onSignupPassword({
                  inviteToken,
                  email,
                  password,
                  displayName: displayName.trim() || undefined,
                });
                setVerificationToken(result.verificationToken);
                setStatus("Signup created. Verify the account to continue.");
              })}
            >
              Sign up
            </button>
            <button
              type="button"
              disabled={busy || !verificationToken.trim()}
              onClick={() => void run("Verifying", async () => {
                await onVerifyEmail(verificationToken);
                setStatus("Signed in.");
              })}
            >
              Verify
            </button>
            <button
              type="button"
              disabled={busy || !email.trim() || !password}
              onClick={() => void run("Logging in", async () => {
                await onLoginPassword({ email, password });
                setStatus("Signed in.");
              })}
            >
              Log in
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("Opening Google", async () => {
                const result = await onStartGoogleOAuth({
                  inviteToken: inviteToken.trim() || undefined,
                  returnTo: window.location.href,
                });
                window.location.assign(result.authUrl);
              })}
            >
              Continue with Google
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
