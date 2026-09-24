import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import { isSpaHref, routes } from '@/lib/routes';
import { Input } from '@/ui';

/**
 * Auth — port of legacy auth.html + js/auth.js: tabbed sign in / create
 * account form honouring ?next= (SPA navigate for SPA targets, a full
 * page load for legacy `.html` targets) and ?mode=signup.
 *
 * In memory mode the seeded demo accounts can't sign in through
 * /api/auth/login, so the demo chips set the X-Dev-User identity instead
 * (AuthProvider.applyDevUser) and continue to the requested page.
 */

type Mode = 'signin' | 'signup';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO_ACCOUNTS = [
  { id: 'dev-user-admin', label: 'Admin' },
  { id: 'dev-user-seller', label: 'Seller' },
  { id: 'dev-user-customer', label: 'Customer' }
];

export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, signup, refresh, applyDevUser } = useAuth();

  const next = params.get('next') || routes.home;

  const [mode, setModeState] = useState<Mode>(
    params.get('mode') === 'signup' ? 'signup' : 'signin'
  );
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const signingIn = mode === 'signin';

  /** Tab switch — legacy setMode() also cleared error + notice. */
  const setMode = (value: Mode) => {
    setModeState(value);
    setError('');
    setNotice('');
  };

  const goNext = () => {
    if (isSpaHref(next)) {
      navigate(next);
    } else {
      // Legacy `.html` target (e.g. ?next=seller-apply.html from old links):
      // full page load; the server resolves it to the SPA + redirect.
      window.location.assign(next);
    }
  };

  const signIn = async (emailValue: string, passwordValue: string) => {
    await login(emailValue, passwordValue);
    await refresh();
    goNext();
  };

  const signUp = async (emailValue: string, passwordValue: string) => {
    const data = await signup({
      email: emailValue,
      password: passwordValue,
      fullName: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
      // Legacy parity — Supabase redirects here after email confirmation;
      // the server still resolves /auth.html to this page.
      emailRedirectTo: `${window.location.origin}/auth.html`
    });
    if (data.needsEmailConfirmation) {
      setMode('signin');
      setNotice('Account created. Check your email to confirm, then sign in.');
      return;
    }
    goNext();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const emailValue = email.trim();
    if (!emailValue || !EMAIL_RE.test(emailValue)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    const task = signingIn
      ? signIn(emailValue, password)
      : signUp(emailValue, password);
    task
      .catch((err: unknown) => {
        setError(
          (err as Error)?.message || 'Something went wrong. Please try again.'
        );
      })
      .finally(() => setBusy(false));
  };

  const onDemo = async (id: string) => {
    await applyDevUser(id);
    goNext();
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 overflow-hidden">
        <div className="bg-primary px-space-lg py-space-md">
          <h1 className="font-headline-md text-on-primary" id="authTitle">
            {signingIn ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="font-body-sm text-primary-fixed-dim" id="authSubtitle">
            {signingIn
              ? 'Sign in to continue to SpaceFit.'
              : 'Join SpaceFit to shop, track orders and apply to sell.'}
          </p>
        </div>

        {/* Segmented tabs — ported from the legacy #authTabs markup. */}
        <div className="grid grid-cols-2 border-b border-outline-variant/40" id="authTabs">
          <button
            type="button"
            data-tab="signin"
            onClick={() => setMode('signin')}
            className={[
              'py-space-md font-label-lg border-b-2',
              signingIn
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            ].join(' ')}
          >
            Sign in
          </button>
          <button
            type="button"
            data-tab="signup"
            onClick={() => setMode('signup')}
            className={[
              'py-space-md font-label-lg border-b-2',
              !signingIn
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            ].join(' ')}
          >
            Create account
          </button>
        </div>

        <form
          className="p-space-lg space-y-space-md"
          id="authForm"
          noValidate
          onSubmit={onSubmit}
        >
          {!signingIn ? (
            <div className="space-y-space-md" id="signupFields">
              <Input
                label="Full name"
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="Phone"
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+234..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          ) : null}

          <Input
            label="Email"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <Input
              label="Password"
              id="password"
              name="password"
              type="password"
              autoComplete={signingIn ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* Legacy keeps the hint outside the label — preserves exact
                getByLabelText('Password') matching. */}
            <p className="font-body-sm text-on-surface-variant mt-space-xs">
              At least 8 characters.
            </p>
          </div>

          {error ? (
            <p className="font-body-sm text-error" id="authError">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="font-body-sm text-secondary" id="authNotice">
              {notice}
            </p>
          ) : null}

          <button
            className="w-full bg-primary text-on-primary py-space-md rounded-lg font-label-lg hover:opacity-95 transition-opacity disabled:opacity-60"
            id="authSubmit"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Please wait\u2026' : signingIn ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="px-space-lg pb-space-lg">
          <div className="border-t border-outline-variant/40 pt-space-md">
            <p className="font-label-md text-on-surface-variant mb-space-sm">
              Demo accounts (memory mode)
            </p>
            <div className="flex flex-wrap gap-space-sm" id="demoAccounts">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  data-dev={account.id}
                  onClick={() => void onDemo(account.id)}
                  className="text-label-md px-space-sm py-space-xs rounded-full border border-outline-variant hover:border-primary"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
