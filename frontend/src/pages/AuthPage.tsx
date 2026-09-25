import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import { isSpaHref, routes } from '@/lib/routes';

type Mode = 'signin' | 'signup';
type FieldName = 'fullName' | 'email' | 'password' | 'confirmPassword' | 'terms';
type FieldErrors = Partial<Record<FieldName, string>>;

interface StatusMessage {
  kind: 'success' | 'error';
  message: string;
}

interface SignInValues {
  email: string;
  password: string;
}

interface SignUpValues {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

interface ValidationResult<T> {
  errors: FieldErrors;
  values: T | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const EMPTY_SIGN_IN: SignInValues = {
  email: '',
  password: ''
};

const EMPTY_SIGN_UP: SignUpValues = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false
};

const DEMO_ACCOUNTS = [
  { id: 'dev-user-admin', label: 'Admin' },
  { id: 'dev-user-seller', label: 'Seller' },
  { id: 'dev-user-customer', label: 'Customer' }
];

const INPUT_CLASS =
  'h-10 w-full rounded-md border bg-surface-container-lowest px-3 font-body-md ' +
  'text-body-md text-on-surface outline-none transition-colors placeholder:text-outline ' +
  'focus:ring-1';

const INPUT_FOCUS_CLASS = 'border-outline-variant/60 focus:border-primary focus:ring-primary';
const INPUT_ERROR_CLASS = 'border-error focus:border-error focus:ring-error';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Something went wrong. Please try again.';
}

function firstInvalidField(errors: FieldErrors): FieldName | null {
  const order: FieldName[] = ['fullName', 'email', 'password', 'confirmPassword', 'terms'];
  return order.find((field) => Boolean(errors[field])) ?? null;
}

function validateSignIn(values: SignInValues): ValidationResult<SignInValues> {
  const errors: FieldErrors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = 'Please enter your email address.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Please enter your password.';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) return { errors, values: null };
  return { errors, values: { email, password: values.password } };
}

function validateSignUp(values: SignUpValues): ValidationResult<SignUpValues> {
  const errors: FieldErrors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = 'Please enter your email address.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Please create a password.';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (values.password && values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  // Consent is validated here for the visual flow; the current signup API
  // does not persist legal acceptance yet, so it is not sent in the payload.
  if (!values.termsAccepted) {
    errors.terms = 'Please accept the Terms of Service and Privacy Policy to continue.';
  }

  if (Object.keys(errors).length > 0) return { errors, values: null };
  return {
    errors,
    values: {
      fullName: values.fullName.trim(),
      phone: values.phone.trim(),
      email,
      password: values.password,
      confirmPassword: values.confirmPassword,
      termsAccepted: values.termsAccepted
    }
  };
}

interface AuthFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function AuthField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
  error,
  required
}: AuthFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label className="mb-1.5 block font-label-lg text-label-lg text-on-surface" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className={`${INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : INPUT_FOCUS_CLASS}`}
        id={id}
        name={id}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
      {hint ? (
        <p className="mt-1.5 font-body-sm text-body-sm text-outline" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1.5 font-body-sm text-body-sm text-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface AuthPasswordFieldProps extends Omit<AuthFieldProps, 'type'> {
  visible: boolean;
  onToggle: () => void;
}

function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  error,
  required,
  visible,
  onToggle
}: AuthPasswordFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block font-label-lg text-label-lg text-on-surface" htmlFor={id}>
          {label}
        </label>
        <button
          aria-controls={id}
          aria-pressed={visible}
          className="-my-1.5 -mr-2 min-h-10 min-w-10 rounded px-2 font-label-md text-label-md text-primary transition-colors hover:bg-primary-container/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
          onClick={onToggle}
          type="button"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="relative">
        <input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          className={`${INPUT_CLASS} pr-12 ${error ? INPUT_ERROR_CLASS : INPUT_FOCUS_CLASS}`}
          id={id}
          name={id}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          type={visible ? 'text' : 'password'}
          value={value}
        />
      </div>
      {hint ? (
        <p className="mt-1.5 font-body-sm text-body-sm text-outline" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1.5 font-body-sm text-body-sm text-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AuthStatusBanner({ status }: { status: StatusMessage | null }) {
  if (!status) return null;

  const tone =
    status.kind === 'success'
      ? 'border-primary bg-surface-container text-on-surface'
      : 'border-error bg-error-container text-on-error-container';

  return (
    <div
      aria-live="polite"
      className={`mb-4 rounded-md border px-3.5 py-3 font-body-sm text-body-sm ${tone}`}
      id="authStatus"
      role="status"
    >
      {status.message}
    </div>
  );
}

function AuthModePrompt({ signingIn, onSwitch }: { signingIn: boolean; onSwitch: () => void }) {
  return (
    <p className="pt-1 text-center font-body-sm text-body-sm text-on-surface-variant">
      {signingIn ? 'Don’t have an account?' : 'Already have an account?'}{' '}
      <button
        className="font-label-lg text-label-lg font-semibold text-primary transition-colors hover:text-primary-container"
        onClick={onSwitch}
        type="button"
      >
        {signingIn ? 'Create account' : 'Sign in'}
      </button>
    </p>
  );
}

/**
 * Auth — a React port of the reference auth.html visual structure, while
 * retaining the real AuthProvider/API flow and its deep-link/demo behavior.
 */
export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, signup, refresh, applyDevUser } = useAuth();

  const next = params.get('next') || routes.home;
  const [mode, setModeState] = useState<Mode>(
    params.get('mode') === 'signup' ? 'signup' : 'signin'
  );
  const [signInValues, setSignInValues] = useState<SignInValues>(EMPTY_SIGN_IN);
  const [signUpValues, setSignUpValues] = useState<SignUpValues>(EMPTY_SIGN_UP);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState({
    signIn: false,
    signUp: false,
    confirm: false
  });
  const [focusField, setFocusField] = useState<FieldName | null>(null);
  const hasMounted = useRef(false);

  const signingIn = mode === 'signin';

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    document.getElementById(signingIn ? 'email' : 'fullName')?.focus();
  }, [mode, signingIn]);

  useEffect(() => {
    if (!focusField) return;
    document.getElementById(focusField)?.focus();
    setFocusField(null);
  }, [focusField]);

  const setMode = (value: Mode) => {
    setModeState(value);
    setFieldErrors({});
    setFocusField(null);
    setStatus(null);
  };

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
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

  const handleSignIn = async (values: SignInValues) => {
    await login(values.email, values.password);
    await refresh();
    goNext();
  };

  const handleSignUp = async (values: SignUpValues) => {
    const data = await signup({
      email: values.email,
      password: values.password,
      fullName: values.fullName || undefined,
      phone: values.phone || undefined,
      // Legacy parity — Supabase redirects here after email confirmation;
      // the server still resolves /auth.html to this page.
      emailRedirectTo: `${window.location.origin}/auth.html`
    });

    if (data.needsEmailConfirmation) {
      setMode('signin');
      setStatus({
        kind: 'success',
        message: 'Account created. Check your email to confirm, then sign in.'
      });
      return;
    }

    goNext();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (signingIn) {
      const result = validateSignIn(signInValues);
      if (!result.values) {
        setFieldErrors(result.errors);
        setFocusField(firstInvalidField(result.errors));
        return;
      }

      setBusy(true);
      void handleSignIn(result.values)
        .catch((error: unknown) => {
          setStatus({ kind: 'error', message: errorMessage(error) });
        })
        .finally(() => setBusy(false));
      return;
    }

    const result = validateSignUp(signUpValues);
    if (!result.values) {
      setFieldErrors(result.errors);
      setFocusField(firstInvalidField(result.errors));
      return;
    }

    setBusy(true);
    void handleSignUp(result.values)
      .catch((error: unknown) => {
        setStatus({ kind: 'error', message: errorMessage(error) });
      })
      .finally(() => setBusy(false));
  };

  const onDemo = async (id: string) => {
    await applyDevUser(id);
    goNext();
  };

  const patchSignIn = (field: keyof SignInValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setSignInValues((current) => ({ ...current, [field]: event.target.value }));
    clearFieldError(field);
  };

  const patchSignUp = (
    field: Exclude<keyof SignUpValues, 'termsAccepted'>
  ) => (event: ChangeEvent<HTMLInputElement>) => {
    setSignUpValues((current) => ({ ...current, [field]: event.target.value }));
    if (field !== 'phone') clearFieldError(field);
  };

  const submitLabel = busy
    ? signingIn
      ? 'Signing in…'
      : 'Creating account…'
    : signingIn
      ? 'Sign In'
      : 'Create Account';

  return (
    <div className="w-full max-w-[400px]">
      <div className="rounded-lg border border-transparent bg-transparent p-5 sm:border-outline-variant/60 sm:bg-surface-container-lowest sm:p-8 sm:shadow-[0_1px_3px_rgba(27,28,26,0.06)]">
        <header className="mb-6">
          <h1
            className="font-headline-md text-headline-md font-bold leading-tight text-on-surface"
            id="authTitle"
          >
            {signingIn ? 'Welcome back' : 'Create your account'}
          </h1>
          <p
            className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant"
            id="authSubtitle"
          >
            {signingIn
              ? 'Sign in to your account to continue.'
              : 'Join SpaceFit to buy and sell furniture with confidence.'}
          </p>
        </header>

        <AuthStatusBanner status={status} />

        <form
          autoComplete="on"
          className="auth-form-panel space-y-4"
          id="authForm"
          key={mode}
          noValidate
          onSubmit={onSubmit}
        >
          {signingIn ? (
            <>
              <AuthField
                autoComplete="email"
                error={fieldErrors.email}
                id="email"
                label="Email address"
                onChange={patchSignIn('email')}
                placeholder="you@example.com"
                required
                type="email"
                value={signInValues.email}
              />
              <AuthPasswordField
                autoComplete="current-password"
                error={fieldErrors.password}
                hint="At least 8 characters."
                id="password"
                label="Password"
                onChange={patchSignIn('password')}
                onToggle={() =>
                  setPasswordVisible((current) => ({ ...current, signIn: !current.signIn }))
                }
                placeholder="••••••••"
                required
                value={signInValues.password}
                visible={passwordVisible.signIn}
              />

              <div className="flex justify-end">
                <button
                  className="font-label-lg text-label-lg font-medium text-primary transition-colors hover:text-primary-container"
                  onClick={() =>
                    setStatus({
                      kind: 'success',
                      message: 'Password reset is not connected yet — check back soon.'
                    })
                  }
                  type="button"
                >
                  Forgot password?
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <AuthField
                autoComplete="name"
                error={fieldErrors.fullName}
                id="fullName"
                label="Full name"
                onChange={patchSignUp('fullName')}
                placeholder="Chidinma Okafor"
                type="text"
                value={signUpValues.fullName}
              />
              <AuthField
                autoComplete="tel"
                id="phone"
                label="Phone"
                onChange={patchSignUp('phone')}
                placeholder="+234..."
                type="tel"
                value={signUpValues.phone}
              />
              <AuthField
                autoComplete="email"
                error={fieldErrors.email}
                id="email"
                label="Email address"
                onChange={patchSignUp('email')}
                placeholder="you@example.com"
                required
                type="email"
                value={signUpValues.email}
              />
              <AuthPasswordField
                autoComplete="new-password"
                error={fieldErrors.password}
                hint="Use at least 8 characters."
                id="password"
                label="Password"
                onChange={patchSignUp('password')}
                onToggle={() =>
                  setPasswordVisible((current) => ({ ...current, signUp: !current.signUp }))
                }
                placeholder="At least 8 characters"
                required
                value={signUpValues.password}
                visible={passwordVisible.signUp}
              />
              <AuthPasswordField
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
                id="confirmPassword"
                label="Confirm password"
                onChange={patchSignUp('confirmPassword')}
                onToggle={() =>
                  setPasswordVisible((current) => ({ ...current, confirm: !current.confirm }))
                }
                placeholder="Re-enter your password"
                required
                value={signUpValues.confirmPassword}
                visible={passwordVisible.confirm}
              />
              <div>
                <div className="flex items-start gap-2">
                  <input
                    aria-describedby={fieldErrors.terms ? 'terms-error' : undefined}
                    aria-invalid={fieldErrors.terms ? true : undefined}
                    aria-labelledby="terms-copy"
                    checked={signUpValues.termsAccepted}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline-variant accent-primary"
                    id="terms"
                    name="terms"
                    onChange={(event) => {
                      setSignUpValues((current) => ({
                        ...current,
                        termsAccepted: event.target.checked
                      }));
                      clearFieldError('terms');
                    }}
                    type="checkbox"
                  />
                  <p
                    className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant"
                    id="terms-copy"
                  >
                    I agree to the{' '}
                    <Link
                      className="font-medium text-primary transition-colors hover:text-primary-container"
                      to={routes.policies}
                    >
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      className="font-medium text-primary transition-colors hover:text-primary-container"
                      to={`${routes.policies}#privacy`}
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
                {fieldErrors.terms ? (
                  <p
                    className="ml-6 mt-1.5 font-body-sm text-body-sm text-error"
                    id="terms-error"
                    role="alert"
                  >
                    {fieldErrors.terms}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <button
            className="h-10 w-full rounded-md bg-primary font-label-lg text-label-lg font-semibold text-on-primary transition-colors hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            id="authSubmit"
            type="submit"
          >
            {submitLabel}
          </button>

          <AuthModePrompt
            onSwitch={() => setMode(signingIn ? 'signup' : 'signin')}
            signingIn={signingIn}
          />
        </form>

        {signingIn ? (
          <>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 font-body-sm text-body-sm text-outline sm:bg-surface-container-lowest">
                  or
                </span>
              </div>
            </div>
            <button
              aria-describedby="google-auth-note"
              className="h-10 w-full rounded-md border border-outline-variant/60 bg-surface-container-lowest font-label-lg text-label-lg font-semibold text-on-surface opacity-60"
              disabled
              type="button"
            >
              Continue with Google
            </button>
            <p className="sr-only" id="google-auth-note">
              Google sign-in is coming soon.
            </p>
          </>
        ) : null}

        <div className="mt-6 border-t border-outline-variant/50 pt-4">
          <p className="mb-2 font-label-md text-label-md text-on-surface-variant">
            Demo accounts (memory mode)
          </p>
          <div className="flex flex-wrap gap-2" id="demoAccounts">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                className="rounded-full border border-outline-variant/70 px-3 py-1 font-label-md text-label-md text-on-surface transition-colors hover:border-primary hover:text-primary"
                data-dev={account.id}
                key={account.id}
                onClick={() => void onDemo(account.id)}
                type="button"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
