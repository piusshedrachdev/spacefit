/**
 * Seller application page controller.
 *
 * - Auth gate: signed-out visitors get a branded prompt back to auth.html.
 * - Renders a multi-section application form (contact, shop, delivery places,
 *   categories, bio, terms/disclaimers) and submits it to the API.
 * - Status states: none (form), pending, approved, rejected, blocked.
 *
 * All data access goes through SpaceFitAPI; feedback uses SpaceFitChrome.
 */
(function (global) {
  'use strict';

  var API = global.SpaceFitAPI;
  var Chrome = global.SpaceFitChrome || { toast: function () {} };
  if (!API) return;

  var main = document.getElementById('applyMain');
  if (!main) return;

  var state = { config: null, categories: [], deliveryPlaces: [] };

  /* -------------------------------------------------------------- helpers */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function inputClass() {
    return 'w-full text-sm border border-outline-variant rounded-lg px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary bg-surface text-on-surface shadow-sm placeholder-outline';
  }

  function sectionCard(title, body) {
    return '<section class="bg-surface rounded-xl border border-outline-variant/90 shadow-sm p-5 sm:p-6">' +
      '<h2 class="font-headline-sm text-headline-sm text-on-surface mb-4">' + esc(title) + '</h2>' +
      body + '</section>';
  }

  function field(label, inner) {
    return '<div><label class="block text-xs font-medium text-on-surface-variant mb-1">' + esc(label) +
      '</label>' + inner + '</div>';
  }

  function errorLine(message) {
    return '<p class="text-sm text-error font-body-md" id="formError">' + esc(message || '') + '</p>';
  }

  /* --------------------------------------------------------------- render */

  function renderAuthGate() {
    main.innerHTML =
      '<div class="max-w-lg mx-auto text-center bg-surface rounded-2xl border border-outline-variant/60 shadow-sm p-space-2xl">' +
      '<span class="material-symbols-outlined text-5xl text-primary" style="font-variation-settings:\'FILL\' 1;">storefront</span>' +
      '<h1 class="font-headline-lg text-headline-lg text-on-surface mt-space-md">Become a SpaceFit Seller</h1>' +
      '<p class="font-body-lg text-body-lg text-on-surface-variant mt-space-sm">Sign in or create an account to apply. Your application takes a couple of minutes.</p>' +
      '<a href="auth.html?next=' + encodeURIComponent('seller-apply.html') + '" class="inline-block mt-space-lg bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Sign in to continue</a>' +
      '</div>';
  }

  function renderLoading() {
    main.innerHTML = '<div class="text-center py-space-2xl text-on-surface-variant"><span class="material-symbols-outlined animate-spin">progress_activity</span></div>';
  }

  function cityOptions() {
    var cities = (state.config && state.config.serviceableCities) || ['Lagos', 'Abuja', 'Ibadan'];
    return cities.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
  }

  function categoryOptions() {
    return state.categories.map(function (c) {
      var name = typeof c === 'string' ? c : c.name;
      return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
    }).join('');
  }

  function renderForm(prefill) {
    prefill = prefill || {};
    var user = API.getUser() || {};
    var profile = API.getProfile() || {};

    var contact = sectionCard('1. Contact details',
      '<div class="space-y-4">' +
      field('Full name', '<input class="' + inputClass() + '" id="fullName" type="text" value="' + esc(prefill.fullName || profile.full_name || '') + '" />') +
      field('Email', '<input class="' + inputClass() + '" id="email" type="email" value="' + esc(prefill.email || user.email || '') + '" />') +
      field('Phone', '<input class="' + inputClass() + '" id="phone" type="tel" value="' + esc(prefill.phone || profile.phone || '') + '" placeholder="+234..." />') +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        field('City', '<select class="' + inputClass() + '" id="city">' + cityOptions() + '</select>') +
        field('State', '<input class="' + inputClass() + '" id="state" type="text" placeholder="e.g. Lagos" value="' + esc((prefill.location && prefill.location.state) || '') + '" />') +
      '</div>' +
      '</div>');

    var shop = sectionCard('2. Your shop',
      '<div class="space-y-4">' +
      field('Shop name', '<input class="' + inputClass() + '" id="shopName" type="text" value="' + esc(prefill.shopName || '') + '" placeholder="The name buyers will see" />') +
      field('What do you sell? (optional)', '<textarea class="' + inputClass() + '" id="bio" rows="3" placeholder="A short description of your craft and products">' + esc(prefill.bio || '') + '</textarea>') +
      '<div><label class="block text-xs font-medium text-on-surface-variant mb-1">Delivery places</label>' +
        '<div class="flex flex-wrap gap-2 mb-2" id="chipList"></div>' +
        '<div class="flex gap-2"><input class="' + inputClass() + '" id="chipInput" type="text" placeholder="Add a city or region" />' +
        '<button type="button" class="px-space-md rounded-lg border border-outline-variant hover:border-primary font-label-md" id="chipAdd">Add</button></div>' +
      '</div>' +
      field('Intended categories', '<select class="' + inputClass() + '" id="categorySelect" multiple size="4">' + categoryOptions() + '</select>') +
      '</div>');

    var terms = sectionCard('3. Terms & disclaimers',
      '<div class="space-y-4">' +
      '<details class="border border-outline-variant/60 rounded-lg p-3"><summary class="cursor-pointer font-label-lg">Seller terms &amp; conditions</summary>' +
        '<p class="font-body-sm text-on-surface-variant mt-2">By selling on SpaceFit you agree to list authentic, accurately described goods, honour the 7-day return window, respond to buyer enquiries within 48 hours, and comply with all applicable Nigerian consumer laws. Breaches may lead to suspension.</p></details>' +
      '<details class="border border-outline-variant/60 rounded-lg p-3"><summary class="cursor-pointer font-label-lg">Disclaimers</summary>' +
        '<p class="font-body-sm text-on-surface-variant mt-2">SpaceFit acts as a marketplace and is not the manufacturer or importer of listed goods. Sellers are responsible for the accuracy of their listings, product safety and applicable taxes.</p></details>' +
      '<label class="flex items-start gap-2 font-body-sm"><input id="termsAccepted" type="checkbox" class="mt-1" /> I accept the seller terms &amp; conditions.</label>' +
      '<label class="flex items-start gap-2 font-body-sm"><input id="disclaimersAccepted" type="checkbox" class="mt-1" /> I have read and accept the disclaimers.</label>' +
      '</div>');

    main.innerHTML =
      '<div class="max-w-3xl mx-auto">' +
      '<h1 class="font-headline-lg text-headline-lg text-on-surface mb-space-xs">Apply to sell on SpaceFit</h1>' +
      '<p class="font-body-lg text-body-lg text-on-surface-variant mb-space-lg">Tell us about your shop. Our team reviews applications within 2\u20133 business days.</p>' +
      errorLine('') +
      '<div class="flex flex-col gap-6 mt-space-md">' + contact + shop + terms + '</div>' +
      '<div class="mt-space-lg flex justify-end"><button type="button" id="submitApplication" class="bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95 disabled:opacity-60">Submit application</button></div>' +
      '</div>';

    document.getElementById('formError').classList.add('hidden');
    initChips(prefill.deliveryPlaces || []);
    document.getElementById('chipAdd').addEventListener('click', addChipFromInput);
    document.getElementById('chipInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addChipFromInput(); }
    });
    document.getElementById('submitApplication').addEventListener('click', submit);
  }

  /* ----------------------------------------------------------------- chips */

  function renderChips() {
    var host = document.getElementById('chipList');
    if (!host) return;
    host.innerHTML = state.deliveryPlaces.map(function (p) {
      return '<span class="inline-flex items-center gap-1 px-space-sm py-space-xs rounded-full bg-surface-container-high font-label-md">' +
        esc(p) + '<button type="button" data-chip="' + esc(p) + '" class="text-on-surface-variant hover:text-error"><span class="material-symbols-outlined text-sm">close</span></button></span>';
    }).join('');
    host.querySelectorAll('[data-chip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-chip');
        state.deliveryPlaces = state.deliveryPlaces.filter(function (p) { return p !== value; });
        renderChips();
      });
    });
  }

  function initChips(places) {
    state.deliveryPlaces = Array.isArray(places) ? places.slice() : [];
    renderChips();
  }

  function addChipFromInput() {
    var input = document.getElementById('chipInput');
    if (!input) return;
    var value = input.value.trim();
    if (!value) return;
    if (state.deliveryPlaces.indexOf(value) === -1) state.deliveryPlaces.push(value);
    input.value = '';
    renderChips();
  }

  /* ---------------------------------------------------------------- submit */

  function showFormError(message) {
    var el = document.getElementById('formError');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function selectedCategories() {
    var select = document.getElementById('categorySelect');
    if (!select) return [];
    return Array.prototype.filter.call(select.options, function (o) { return o.selected; })
      .map(function (o) { return o.value; });
  }

  function submit() {
    showFormError('');
    var fullName = document.getElementById('fullName').value.trim();
    var email = document.getElementById('email').value.trim();
    var phone = document.getElementById('phone').value.trim();
    var city = document.getElementById('city').value;
    var stateVal = document.getElementById('state').value.trim();
    var shopName = document.getElementById('shopName').value.trim();
    var bio = document.getElementById('bio').value.trim();
    var termsAccepted = document.getElementById('termsAccepted').checked;
    var disclaimersAccepted = document.getElementById('disclaimersAccepted').checked;

    if (fullName.length < 2) return showFormError('Enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFormError('Enter a valid email address.');
    if (phone.length < 7) return showFormError('Enter a valid phone number.');
    if (shopName.length < 2) return showFormError('Enter your shop name.');
    if (!termsAccepted || !disclaimersAccepted) return showFormError('Please accept the terms and disclaimers.');

    var button = document.getElementById('submitApplication');
    button.disabled = true;
    button.textContent = 'Submitting\u2026';

    API.submitSellerApplication({
      fullName: fullName,
      email: email,
      phone: phone,
      shopName: shopName,
      city: city,
      state: stateVal || city,
      deliveryPlaces: state.deliveryPlaces,
      categories: selectedCategories(),
      bio: bio || undefined,
      termsAccepted: termsAccepted,
      disclaimersAccepted: disclaimersAccepted
    }).then(function (application) {
      Chrome.toast('Application submitted \u2014 we\u2019ll be in touch soon.');
      renderStatus({ isSeller: false, application: application });
    }).catch(function (err) {
      showFormError((err && err.message) || 'Could not submit your application. Please try again.');
      button.disabled = false;
      button.textContent = 'Submit application';
    });
  }

  /* ----------------------------------------------------------- status states */

  function statusShell(icon, tone, title, bodyHtml, ctaHtml) {
    return '<div class="max-w-2xl mx-auto bg-surface rounded-2xl border border-outline-variant/60 shadow-sm p-space-2xl text-center">' +
      '<span class="material-symbols-outlined text-5xl ' + tone + '" style="font-variation-settings:\'FILL\' 1;">' + icon + '</span>' +
      '<h1 class="font-headline-lg text-headline-lg text-on-surface mt-space-md">' + esc(title) + '</h1>' +
      '<div class="font-body-lg text-body-lg text-on-surface-variant mt-space-sm space-y-space-sm text-left sm:text-center">' + bodyHtml + '</div>' +
      (ctaHtml ? '<div class="mt-space-lg">' + ctaHtml + '</div>' : '') +
      '</div>';
  }

  function detailRow(label, value) {
    return '<p><span class="font-label-md text-on-surface-variant">' + esc(label) + ':</span> ' + esc(value || '\u2014') + '</p>';
  }

  function renderStatus(context) {
    var application = context.application;

    if (context.isSeller) {
      main.innerHTML = statusShell('verified', 'text-primary',
        'You\u2019re a SpaceFit seller',
        '<p>Your shop' + (context.seller ? ' <strong>' + esc(context.seller.shopName) + '</strong>' : '') + ' is active. Head to your dashboard to list products and track sales.</p>',
        '<a href="seller-dashboard.html" class="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Open seller dashboard</a>');
      return;
    }

    if (!application) {
      renderForm();
      return;
    }

    if (application.status === 'pending') {
      main.innerHTML = statusShell('hourglass_top', 'text-secondary',
        'Application under review',
        '<p>Thanks, ' + esc(application.fullName) + '. We\u2019ve received your application for <strong>' + esc(application.shopName) + '</strong> and will review it within 2\u20133 business days.</p>' +
        detailRow('Reference', application.id) +
        detailRow('Delivery places', (application.deliveryPlaces || []).join(', ')) +
        detailRow('Categories', (application.categories || []).join(', ')),
        '<a href="index.html" class="inline-block border border-outline-variant px-space-xl py-space-md rounded-lg font-label-lg hover:border-primary">Continue shopping</a>');
      return;
    }

    if (application.status === 'approved') {
      main.innerHTML = statusShell('verified', 'text-primary',
        'Application approved',
        '<p>Congratulations \u2014 <strong>' + esc(application.shopName) + '</strong> has been approved. Open your seller dashboard to get started.</p>',
        '<a href="seller-dashboard.html" class="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Open seller dashboard</a>');
      return;
    }

    if (application.status === 'rejected') {
      main.innerHTML = statusShell('cancel', 'text-error',
        'Application not approved',
        '<p>Unfortunately your application for <strong>' + esc(application.shopName) + '</strong> was not approved at this time.</p>' +
        (application.reviewNotes ? '<p class="bg-error-container text-on-error-container rounded-lg p-space-md">Reviewer note: ' + esc(application.reviewNotes) + '</p>' : '') +
        '<p>You\u2019re welcome to reapply once the points above have been addressed.</p>',
        '<button type="button" id="reapply" class="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Reapply</button>');
      var reapply = document.getElementById('reapply');
      if (reapply) reapply.addEventListener('click', function () { renderForm(application); });
      return;
    }

    renderForm(application);
  }

  /* ------------------------------------------------------------------ init */

  function load() {
    if (API.routeIfUnauthed()) return;
    renderLoading();
    Promise.all([
      API.getConfig().catch(function () { return null; }),
      API.getCategories().catch(function () { return []; }),
      API.getMySellerContext().catch(function () { return null; })
    ]).then(function (results) {
      state.config = results[0];
      state.categories = Array.isArray(results[1]) ? results[1] : [];
      var context = results[2] || {};
      renderStatus(context);
    }).catch(function () {
      renderForm();
    });
  }

  load();
})(window);
