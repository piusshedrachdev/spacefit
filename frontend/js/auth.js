/**
 * Auth page controller: tabbed sign in / create account form.
 *
 * Talks to /api/auth/* through SpaceFitAPI and honours a ?next= redirect so
 * gated pages (e.g. seller-apply.html) can send users here and get them back.
 *
 * In memory mode the seeded demo accounts cannot actually be signed in via
 * /api/auth/login (no Supabase), so the demo chips set an X-Dev-User identity
 * instead and redirect straight to the requested page.
 */
(function (global) {
  'use strict';

  var API = global.SpaceFitAPI;
  if (!API) return;

  var params = new URLSearchParams(global.location.search);
  var next = params.get('next') || 'index.html';

  var form = document.getElementById('authForm');
  var titleEl = document.getElementById('authTitle');
  var subtitleEl = document.getElementById('authSubtitle');
  var errorEl = document.getElementById('authError');
  var noticeEl = document.getElementById('authNotice');
  var submitBtn = document.getElementById('authSubmit');
  var signupFields = document.getElementById('signupFields');
  var tabs = document.getElementById('authTabs');
  var mode = 'signin';

  /* -------------------------------------------------------------- helpers */

  function showError(message) {
    errorEl.textContent = message || '';
    errorEl.classList.toggle('hidden', !message);
  }

  function showNotice(message) {
    noticeEl.textContent = message || '';
    noticeEl.classList.toggle('hidden', !message);
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Please wait\u2026' : mode === 'signin' ? 'Sign in' : 'Create account';
  }

  function redirectNext() {
    global.location.href = next;
  }

  function setMode(value) {
    mode = value;
    var signingIn = value === 'signin';
    signupFields.classList.toggle('hidden', signingIn);
    titleEl.textContent = signingIn ? 'Welcome back' : 'Create your account';
    subtitleEl.textContent = signingIn
      ? 'Sign in to continue to SpaceFit.'
      : 'Join SpaceFit to shop, track orders and apply to sell.';
    submitBtn.textContent = signingIn ? 'Sign in' : 'Create account';
    document.getElementById('password').setAttribute(
      'autocomplete',
      signingIn ? 'current-password' : 'new-password'
    );
    showError('');
    showNotice('');

    Array.prototype.forEach.call(tabs.querySelectorAll('[data-tab]'), function (btn) {
      var active = btn.getAttribute('data-tab') === value;
      btn.classList.toggle('border-primary', active);
      btn.classList.toggle('text-primary', active);
      btn.classList.toggle('border-transparent', !active);
      btn.classList.toggle('text-on-surface-variant', !active);
    });
  }

  /* --------------------------------------------------------------- submit */

  function handleSignIn(email, password) {
    return API.login(email, password).then(function () {
      return API.getMe().catch(function () { return null; });
    }).then(redirectNext);
  }

  function handleSignUp(payload) {
    return API.signup(payload).then(function (data) {
      if (data.needsEmailConfirmation) {
        showNotice(
          'Account created. Check your email to confirm your address, then sign in.'
        );
        setMode('signin');
        showNotice('Account created. Check your email to confirm, then sign in.');
        return null;
      }
      return redirectNext();
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    showError('');

    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError('Enter a valid email address.');
    }
    if (!password || password.length < 8) {
      return showError('Password must be at least 8 characters.');
    }

    setBusy(true);
    var task;
    if (mode === 'signin') {
      task = handleSignIn(email, password);
    } else {
      task = handleSignUp({
        email: email,
        password: password,
        fullName: document.getElementById('fullName').value.trim() || undefined,
        phone: document.getElementById('phone').value.trim() || undefined,
        emailRedirectTo: global.location.origin + '/auth.html'
      });
    }

    task.catch(function (err) {
      showError((err && err.message) || 'Something went wrong. Please try again.');
    }).then(function () {
      setBusy(false);
    });
  });

  /* ------------------------------------------------------ demo dev accounts */

  var demo = document.getElementById('demoAccounts');
  if (demo) {
    demo.addEventListener('click', function (event) {
      var button = event.target.closest('[data-dev]');
      if (!button) return;
      API.setDevUser(button.getAttribute('data-dev'));
      API.clearSession();
      global.location.href = next;
    });
  }

  /* ------------------------------------------------------------------ init */

  if (tabs) {
    tabs.addEventListener('click', function (event) {
      var button = event.target.closest('[data-tab]');
      if (button) setMode(button.getAttribute('data-tab'));
    });
  }

  if (params.get('mode') === 'signup') setMode('signup');
  else setMode('signin');
})(window);
