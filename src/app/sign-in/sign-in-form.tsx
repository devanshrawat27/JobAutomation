"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export default function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });

    if (result.error) {
      setError(result.error.message ?? "That did not work. Check your details and try again.");
      setPending(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">
          {mode === "sign-in" ? "Welcome back" : "Create an account"}
        </span>
      </header>

      <section aria-labelledby="auth-title" className="onboarding-content auth-content">
        <p className="section-kicker">Your account</p>
        <h1 id="auth-title">
          {mode === "sign-in" ? "Sign in to save your profile." : "Create your account."}
        </h1>
        <p className="onboarding-intro">
          Reviewed facts are stored per account, so one candidate can never see another’s profile.
        </p>

        <div className="auth-switch" role="tablist" aria-label="Sign in or create an account">
          <button
            aria-selected={mode === "sign-in"}
            className={`auth-switch-button${mode === "sign-in" ? " is-active" : ""}`}
            onClick={() => {
              setMode("sign-in");
              setError(null);
            }}
            role="tab"
            type="button"
          >
            Sign in
          </button>
          <button
            aria-selected={mode === "sign-up"}
            className={`auth-switch-button${mode === "sign-up" ? " is-active" : ""}`}
            onClick={() => {
              setMode("sign-up");
              setError(null);
            }}
            role="tab"
            type="button"
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "sign-up" ? (
            <label className="auth-field">
              <span>Full name</span>
              <input
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
                required
                type="text"
                value={name}
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}

          <div className="auth-actions">
            <button className="onboarding-submit" disabled={pending} type="submit">
              {pending
                ? "Working…"
                : mode === "sign-in"
                  ? "Sign in"
                  : "Create account"}
              <span aria-hidden="true">→</span>
            </button>
            <p className="auth-note">
              Prototype accounts have no email verification yet. You can delete your data from the profile page.
            </p>
          </div>
        </form>
      </section>

      <footer className="onboarding-footer">
        <Link href="/">← Back to home</Link>
        <span>Your facts stay yours. You review what gets used.</span>
      </footer>
    </main>
  );
}
