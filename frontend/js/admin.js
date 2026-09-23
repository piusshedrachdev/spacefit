/**
 * Admin dashboard controller.
 *
 * Tabs: Overview, Applications, Sellers, Products, Orders, Settings.
 * Gated on the caller having the `admin` role (memory-mode demo admin is
 * supported via the X-Dev-User header set on the auth page).
 *
 * All data flows through SpaceFitAPI; feedback uses SpaceFitChrome.toast.
 */
(function (global) {
  'use strict';

  var API = global.SpaceFitAPI;
  var Chrome = global.SpaceFitChrome || { toast: function () {}, escapeHtml: function (v) { return v; } };
  if (!API) return;

  var main = document.getElementById('adminMain');
  if (!main) return;

  var state = { tab: 'overview', applications: [], sellers: [], products: [], orders: [], settings: null, failures: [] };

  var TABS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'applications', label: 'Applications', icon: 'assignment' },
    { id: 'sellers', label: 'Sellers', icon: 'storefront' },
    { id: 'products', label: 'Products', icon: 'inventory_2' },
    { id: 'orders', label: 'Orders', icon: 'receipt_long' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  /* -------------------------------------------------------------- helpers */

  function esc(v) { return Chrome.escapeHtml(v); }

  function money(amount) { return API.formatPrice(amount); }

  function statusPill(status) {
    var tones = {
      pending: 'bg-secondary-container text-on-secondary-container',
      approved: 'bg-primary/10 text-primary',
      rejected: 'bg-error-container text-on-error-container',
      active: 'bg-primary/10 text-primary',
      blocked: 'bg-error-container text-on-error-container',
      requested: 'bg-secondary-container text-on-secondary-container',
      completed: 'bg-primary/10 text-primary'
    };
    return '<span class="inline-block px-space-sm py-space-xs rounded-full font-label-md capitalize ' +
      (tones[status] || 'bg-surface-container-high') + '">' + esc(status) + '</span>';
  }

  function fmtDate(value) {
    if (!value) return '\u2014';
    try { return new Date(value).toLocaleString('en-NG'); } catch (e) { return value; }
  }

  function card(label, value) {
    return '<div class="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg">' +
      '<p class="font-label-md text-on-surface-variant">' + esc(label) + '</p>' +
      '<p class="font-headline-md text-headline-md text-on-surface mt-space-xs">' + value + '</p></div>';
  }

  function modal(title, bodyHtml, onConfirm, confirmLabel) {
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[70] bg-inverse-surface/40 flex items-center justify-center p-margin';
    overlay.innerHTML =
      '<div class="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg">' +
      '<div class="px-space-lg py-space-md border-b border-outline-variant/40"><h3 class="font-headline-sm">' + esc(title) + '</h3></div>' +
      '<div class="p-space-lg space-y-space-md">' + bodyHtml + '</div>' +
      '<div class="px-space-lg py-space-md border-t border-outline-variant/40 flex justify-end gap-space-sm">' +
      '<button type="button" data-cancel class="px-space-lg py-space-sm rounded-lg border border-outline-variant font-label-lg hover:border-primary">Cancel</button>' +
      '<button type="button" data-confirm class="px-space-lg py-space-sm rounded-lg bg-primary text-on-primary font-label-lg hover:opacity-95">' + esc(confirmLabel || 'Confirm') + '</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('[data-cancel]').addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('[data-confirm]').addEventListener('click', function () {
      onConfirm(overlay).then(function () { overlay.remove(); }).catch(function (err) {
        Chrome.toast((err && err.message) || 'Action failed', true);
      });
    });
    return overlay;
  }

  /**
   * Render a data table. `rows` may be an array of `<tr>` strings or a single
   * already-joined string — both are accepted so callers can pass either.
   */
  function table(headers, rows) {
    var body;
    if (Array.isArray(rows)) body = rows.join('');
    else if (typeof rows === 'string') body = rows;
    else body = '';
    return '<div class="overflow-x-auto bg-surface rounded-xl border border-outline-variant/60">' +
      '<table class="w-full text-left font-body-sm"><thead class="bg-surface-container-low"><tr>' +
      headers.map(function (h) { return '<th class="px-space-md py-space-sm font-label-md text-on-surface-variant">' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  /* --------------------------------------------------------------- shell */

  function renderShell() {
    main.innerHTML =
      '<div class="flex flex-col lg:flex-row gap-space-lg">' +
      '<aside class="lg:w-56 shrink-0">' +
        '<nav class="flex lg:flex-col gap-space-xs overflow-x-auto bg-surface rounded-xl border border-outline-variant/60 p-space-sm">' +
          TABS.map(function (t) {
            return '<a href="#" data-tab="' + t.id + '" class="flex items-center gap-space-sm px-space-md py-space-sm rounded-lg font-label-lg whitespace-nowrap hover:bg-surface-container-high">' +
              '<span class="material-symbols-outlined text-xl">' + t.icon + '</span>' + t.label + '</a>';
          }).join('') +
        '</nav>' +
      '</aside>' +
      '<section class="flex-1 min-w-0" id="adminPanel"></section>' +
      '</div>';

    main.querySelectorAll('[data-tab]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        global.location.hash = link.getAttribute('data-tab');
      });
    });
  }

  function setActiveTab(tab) {
    main.querySelectorAll('[data-tab]').forEach(function (link) {
      var active = link.getAttribute('data-tab') === tab;
      link.classList.toggle('bg-primary', active);
      link.classList.toggle('text-on-primary', active);
    });
  }

  function panel() { return document.getElementById('adminPanel'); }

  /* ------------------------------------------------------------ overview */

  function renderOverview() {
    var pending = state.applications.filter(function (a) { return a.status === 'pending'; }).length;
    var revenue = state.orders.reduce(function (n, o) { return n + (o.total || 0); }, 0);
    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Overview</h1>' +
      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-space-md">' +
        card('Pending applications', esc(pending)) +
        card('Sellers', esc(state.sellers.length)) +
        card('Products', esc(state.products.length)) +
        card('Orders', esc(state.orders.length)) +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md mt-space-md">' +
        card('Recorded revenue', money(revenue)) +
        card('Blocked sellers', esc(state.sellers.filter(function (s) { return s.status === 'blocked'; }).length)) +
      '</div>' +
      '<div class="mt-space-lg">' +
        '<h2 class="font-headline-sm mb-space-sm">Latest applications</h2>' +
        table(['Shop', 'Applicant', 'Status', 'Submitted'],
          state.applications.slice(0, 5).map(function (a) {
            return '<tr class="border-t border-outline-variant/40"><td class="px-space-md py-space-sm">' + esc(a.shopName) +
              '</td><td class="px-space-md py-space-sm">' + esc(a.fullName) + '</td><td class="px-space-md py-space-sm">' + statusPill(a.status) +
              '</td><td class="px-space-md py-space-sm">' + fmtDate(a.createdAt) + '</td></tr>';
          }).join('') || '<tr><td class="px-space-md py-space-md text-on-surface-variant" colspan="4">No applications yet.</td></tr>') +
      '</div>';
  }

  /* -------------------------------------------------------- applications */

  function renderApplications() {
    var rows = state.applications.map(function (a) {
      return '<tr class="border-t border-outline-variant/40"><td class="px-space-md py-space-sm">' + esc(a.shopName) +
        '</td><td class="px-space-md py-space-sm">' + esc(a.fullName) + '<br/><span class="text-on-surface-variant">' + esc(a.email) + '</span></td>' +
        '<td class="px-space-md py-space-sm">' + statusPill(a.status) + '</td>' +
        '<td class="px-space-md py-space-sm">' + fmtDate(a.createdAt) + '</td>' +
        '<td class="px-space-md py-space-sm"><button type="button" data-review="' + esc(a.id) + '" class="text-primary font-label-md hover:underline">Review</button></td></tr>';
    }).join('');

    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Applications</h1>' +
      table(['Shop', 'Applicant', 'Status', 'Submitted', ''], rows ||
        '<tr><td class="px-space-md py-space-md text-on-surface-variant" colspan="5">No applications.</td></tr>');

    panel().querySelectorAll('[data-review]').forEach(function (btn) {
      btn.addEventListener('click', function () { openApplication(btn.getAttribute('data-review')); });
    });
  }

  function openApplication(id) {
    var app = state.applications.find(function (a) { return a.id === id; });
    if (!app) return;

    var detail =
      '<div class="space-y-space-sm">' +
      '<p><span class="font-label-md text-on-surface-variant">Applicant:</span> ' + esc(app.fullName) + ' (' + esc(app.email) + ')</p>' +
      '<p><span class="font-label-md text-on-surface-variant">Phone:</span> ' + esc(app.phone) + '</p>' +
      '<p><span class="font-label-md text-on-surface-variant">Location:</span> ' + esc((app.location && (app.location.city + ', ' + app.location.state)) || '\u2014') + '</p>' +
      '<p><span class="font-label-md text-on-surface-variant">Delivery places:</span> ' + esc((app.deliveryPlaces || []).join(', ') || '\u2014') + '</p>' +
      '<p><span class="font-label-md text-on-surface-variant">Categories:</span> ' + esc((app.categories || []).join(', ') || '\u2014') + '</p>' +
      (app.bio ? '<p><span class="font-label-md text-on-surface-variant">Bio:</span> ' + esc(app.bio) + '</p>' : '') +
      '<p><span class="font-label-md text-on-surface-variant">Terms accepted:</span> ' + (app.termsAccepted ? 'Yes' : 'No') + '</p>' +
      '<p><span class="font-label-md text-on-surface-variant">Disclaimers accepted:</span> ' + (app.disclaimersAccepted ? 'Yes' : 'No') + '</p>' +
      (app.reviewNotes ? '<p><span class="font-label-md text-on-surface-variant">Previous notes:</span> ' + esc(app.reviewNotes) + '</p>' : '') +
      '</div>';

    var body = detail +
      (app.status === 'pending'
        ? '<div><label class="font-label-md text-on-surface-variant">Review notes (optional)</label>' +
          '<textarea id="reviewNotes" rows="2" class="w-full mt-space-xs text-sm border border-outline-variant rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary"></textarea></div>' +
          '<div class="flex gap-space-sm">' +
          '<button type="button" data-approve class="flex-1 bg-primary text-on-primary py-space-sm rounded-lg font-label-lg hover:opacity-95">Approve</button>' +
          '<button type="button" data-reject class="flex-1 border border-error text-error py-space-sm rounded-lg font-label-lg hover:bg-error-container">Reject</button></div>'
        : '<p class="font-body-sm text-on-surface-variant">This application has already been ' + esc(app.status) + '.</p>');

    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[70] bg-inverse-surface/40 flex items-center justify-center p-margin';
    overlay.innerHTML =
      '<div class="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">' +
      '<div class="px-space-lg py-space-md border-b border-outline-variant/40 flex items-center justify-between">' +
      '<h3 class="font-headline-sm">' + esc(app.shopName) + '</h3>' +
      '<button type="button" data-close class="text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined">close</span></button></div>' +
      '<div class="p-space-lg space-y-space-md">' + body + '</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close]').addEventListener('click', function () { overlay.remove(); });

    var notes = function () { var el = overlay.querySelector('#reviewNotes'); return el ? el.value.trim() : ''; };

    function decide(decision) {
      return API.reviewApplication(app.id, decision, notes() || undefined).then(function () {
        Chrome.toast('Application ' + decision + '.');
        overlay.remove();
        return refresh();
      }).catch(function (err) {
        Chrome.toast((err && err.message) || 'Could not update application', true);
      });
    }

    var approve = overlay.querySelector('[data-approve]');
    var reject = overlay.querySelector('[data-reject]');
    if (approve) approve.addEventListener('click', function () { decide('approved'); });
    if (reject) reject.addEventListener('click', function () { decide('rejected'); });
  }

  /* -------------------------------------------------------------- sellers */

  function renderSellers() {
    var rows = state.sellers.map(function (s) {
      var action = s.status === 'blocked' ? 'Unblock' : 'Block';
      var nextStatus = s.status === 'blocked' ? 'active' : 'blocked';
      return '<tr class="border-t border-outline-variant/40"><td class="px-space-md py-space-sm">' + esc(s.shopName) +
        '</td><td class="px-space-md py-space-sm">' + statusPill(s.status) + '</td>' +
        '<td class="px-space-md py-space-sm">' + esc(s.products || 0) + '</td>' +
        '<td class="px-space-md py-space-sm">' + fmtDate(s.createdAt) + '</td>' +
        '<td class="px-space-md py-space-sm"><button type="button" data-seller="' + esc(s.id) + '" data-next="' + nextStatus + '" class="font-label-md ' +
        (s.status === 'blocked' ? 'text-primary hover:underline' : 'text-error hover:underline') + '">' + action + '</button></td></tr>';
    }).join('');

    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Sellers</h1>' +
      table(['Shop', 'Status', 'Products', 'Joined', ''], rows ||
        '<tr><td class="px-space-md py-space-md text-on-surface-variant" colspan="5">No sellers.</td></tr>');

    panel().querySelectorAll('[data-seller]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-seller');
        var nextStatus = btn.getAttribute('data-next');
        var seller = state.sellers.find(function (s) { return s.id === id; });
        modal(
          (nextStatus === 'blocked' ? 'Block ' : 'Unblock ') + (seller ? seller.shopName : 'seller') + '?',
          '<p class="font-body-sm text-on-surface-variant">' + (nextStatus === 'blocked'
            ? 'The seller\u2019s listings will be hidden from the storefront and they will be notified.'
            : 'The seller will regain access and their listings will be visible again.') + '</p>' +
          '<input id="blockReason" class="w-full text-sm border border-outline-variant rounded-lg px-3 py-2" placeholder="Reason (optional)" />',
          function () {
            var reasonEl = document.getElementById('blockReason');
            return API.setSellerStatus(id, nextStatus, reasonEl ? reasonEl.value.trim() : undefined).then(function () {
              Chrome.toast('Seller ' + (nextStatus === 'blocked' ? 'blocked' : 'unblocked') + '.');
              return refresh();
            });
          },
          nextStatus === 'blocked' ? 'Block seller' : 'Unblock seller'
        );
      });
    });
  }

  /* ------------------------------------------------------------- products */

  function renderProducts() {
    var rows = state.products.map(function (p) {
      return '<tr class="border-t border-outline-variant/40"><td class="px-space-md py-space-sm">' + esc(p.title) +
        '<br/><span class="text-on-surface-variant">' + esc(p.category) + '</span></td>' +
        '<td class="px-space-md py-space-sm"><input type="number" value="' + Number(p.price || 0) + '" data-price="' + esc(p.id) + '" class="w-28 text-sm border border-outline-variant rounded-lg px-2 py-1" /></td>' +
        '<td class="px-space-md py-space-sm"><input type="text" value="' + esc(p.availability || '') + '" data-availability="' + esc(p.id) + '" class="w-32 text-sm border border-outline-variant rounded-lg px-2 py-1" /></td>' +
        '<td class="px-space-md py-space-sm"><label class="flex items-center gap-1"><input type="checkbox" data-featured="' + esc(p.id) + '" ' + (p.featured ? 'checked' : '') + ' /> Featured</label></td>' +
        '<td class="px-space-md py-space-sm"><button type="button" data-save="' + esc(p.id) + '" class="text-primary font-label-md hover:underline mr-space-sm">Save</button>' +
        '<button type="button" data-delete="' + esc(p.id) + '" class="text-error font-label-md hover:underline">Delete</button></td></tr>';
    }).join('');

    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Products</h1>' +
      table(['Product', 'Price', 'Availability', 'Featured', ''], rows ||
        '<tr><td class="px-space-md py-space-md text-on-surface-variant" colspan="5">No products.</td></tr>');

    panel().querySelectorAll('[data-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-save');
        var priceEl = panel().querySelector('[data-price="' + id + '"]');
        var availEl = panel().querySelector('[data-availability="' + id + '"]');
        var featuredEl = panel().querySelector('[data-featured="' + id + '"]');
        API.updateProduct(id, {
          price: Number(priceEl.value),
          availability: availEl.value.trim(),
          featured: featuredEl.checked
        }).then(function () { Chrome.toast('Product updated.'); return refresh(); })
          .catch(function (err) { Chrome.toast((err && err.message) || 'Update failed', true); });
      });
    });

    panel().querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete');
        var product = state.products.find(function (p) { return p.id === id; });
        modal('Delete product?', '<p class="font-body-sm text-on-surface-variant">' + esc(product ? product.title : id) + ' will be permanently removed.</p>',
          function () {
            return API.deleteProduct(id).then(function () { Chrome.toast('Product deleted.'); return refresh(); });
          }, 'Delete');
      });
    });
  }

  /* --------------------------------------------------------------- orders */

  function renderOrders() {
    var rows = state.orders.map(function (o) {
      return '<tr class="border-t border-outline-variant/40"><td class="px-space-md py-space-sm">' + esc(o.reference || o.id) +
        '</td><td class="px-space-md py-space-sm">' + esc((o.customer && o.customer.fullName) || '\u2014') +
        '</td><td class="px-space-md py-space-sm">' + statusPill(o.status) + '</td>' +
        '<td class="px-space-md py-space-sm">' + money(o.total || 0) + '</td>' +
        '<td class="px-space-md py-space-sm">' + fmtDate(o.createdAt) + '</td></tr>';
    }).join('');

    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Orders</h1>' +
      table(['Reference', 'Customer', 'Status', 'Total', 'Placed'], rows ||
        '<tr><td class="px-space-md py-space-md text-on-surface-variant" colspan="5">No orders.</td></tr>');
  }

  /* ------------------------------------------------------------- settings */

  function renderSettings() {
    var s = state.settings || { policies: {}, discounts: {} };
    var p = s.policies || {};
    var d = s.discounts || {};

    function field(id, label, value, type) {
      return '<div><label class="font-label-md text-on-surface-variant">' + esc(label) + '</label>' +
        '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value) + '" class="w-full mt-space-xs text-sm border border-outline-variant rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary" /></div>';
    }
    function area(id, label, value) {
      return '<div><label class="font-label-md text-on-surface-variant">' + esc(label) + '</label>' +
        '<textarea id="' + id + '" rows="3" class="w-full mt-space-xs text-sm border border-outline-variant rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary">' + esc(value) + '</textarea></div>';
    }

    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Settings</h1>' +
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">' +
        '<section class="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg space-y-space-md">' +
          '<h2 class="font-headline-sm">Policies</h2>' +
          area('policyReturn', 'Return policy', p.returnPolicy) +
          area('policySeller', 'Seller policy', p.sellerPolicy) +
          area('policyDelivery', 'Delivery policy', p.deliveryPolicy) +
          area('policyPrivacy', 'Privacy policy', p.privacyPolicy) +
        '</section>' +
        '<section class="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg space-y-space-md">' +
          '<h2 class="font-headline-sm">Discounts</h2>' +
          field('discountPercent', 'Sitewide discount (%)', d.sitewidePercent, 'number') +
          field('discountCode', 'Promo code', d.promoCode) +
          field('discountThreshold', 'Free-delivery threshold', d.freeDeliveryThreshold, 'number') +
          '<label class="flex items-center gap-space-sm font-body-sm"><input id="discountBanner" type="checkbox" ' + (d.bannerEnabled ? 'checked' : '') + ' /> Show discount banner</label>' +
        '</section>' +
      '</div>' +
      '<div class="mt-space-lg flex justify-end"><button type="button" id="saveSettings" class="bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Save settings</button></div>';

    document.getElementById('saveSettings').addEventListener('click', function () {
      var payload = {
        policies: {
          returnPolicy: document.getElementById('policyReturn').value,
          sellerPolicy: document.getElementById('policySeller').value,
          deliveryPolicy: document.getElementById('policyDelivery').value,
          privacyPolicy: document.getElementById('policyPrivacy').value
        },
        discounts: {
          sitewidePercent: Number(document.getElementById('discountPercent').value) || 0,
          promoCode: document.getElementById('discountCode').value.trim(),
          freeDeliveryThreshold: Number(document.getElementById('discountThreshold').value) || 0,
          bannerEnabled: document.getElementById('discountBanner').checked
        }
      };
      API.saveSettings(payload).then(function (data) {
        state.settings = data;
        Chrome.toast('Settings saved.');
      }).catch(function (err) {
        Chrome.toast((err && err.message) || 'Could not save settings', true);
      });
    });
  }

  /* ---------------------------------------------------------------- routing */

  function renderTab() {
    setActiveTab(state.tab);
    if (state.tab === 'overview') renderOverview();
    else if (state.tab === 'applications') renderApplications();
    else if (state.tab === 'sellers') renderSellers();
    else if (state.tab === 'products') renderProducts();
    else if (state.tab === 'orders') renderOrders();
    else renderSettings();
    renderFailures();
  }

  /**
   * Surface any fetch failures that `refresh()` collected. Without this the
   * dashboard silently renders empty tables when the API calls fail (e.g. a
   * cross-origin/file:// session, an expired token, or a non-admin role).
   */
  function renderFailures() {
    if (!state.failures || !state.failures.length) return;
    var host = panel();
    var banner = document.createElement('div');
    banner.className = 'mb-space-md rounded-xl border border-error/40 bg-error-container text-on-error-container p-space-md font-body-sm';
    banner.innerHTML = '<strong>Some data could not be loaded.</strong> ' +
      esc(state.failures.join('  \u00b7  ')) +
      '  \u2014  open this page via http://localhost:4000/admin.html (not file://) and make sure you are signed in as an admin.';
    host.insertBefore(banner, host.firstChild);
  }

  function applyHash() {
    var hash = (global.location.hash || '').replace('#', '');
    state.tab = TABS.some(function (t) { return t.id === hash; }) ? hash : 'overview';
    renderTab();
  }

  /* ------------------------------------------------------------------- data */

  function label(fn, name) {
    return fn().then(
      function (value) { return { name: name, value: value }; },
      function (err) { return { name: name, error: (err && err.message) || 'request failed' }; }
    );
  }

  function refresh() {
    return Promise.all([
      label(API.getApplications, 'applications'),
      label(API.getSellers, 'sellers'),
      label(function () { return API.getProducts({ limit: 200 }); }, 'products'),
      label(API.getOrders, 'orders'),
      label(API.getSettings, 'settings')
    ]).then(function (results) {
      var byName = {};
      state.failures = [];
      results.forEach(function (r) {
        if (r.error) {
          state.failures.push(r.name + ': ' + r.error);
          byName[r.name] = r.name === 'settings' ? null : [];
        } else {
          byName[r.name] = r.value;
        }
      });
      state.applications = Array.isArray(byName.applications) ? byName.applications : [];
      state.sellers = Array.isArray(byName.sellers) ? byName.sellers : [];
      state.products = Array.isArray(byName.products) ? byName.products : [];
      state.orders = Array.isArray(byName.orders) ? byName.orders : [];
      state.settings = byName.settings || null;
      renderTab();
    });
  }

  /* ------------------------------------------------------------------- gate */

  function renderDenied(message) {
    main.innerHTML =
      '<div class="max-w-lg mx-auto text-center bg-surface rounded-2xl border border-outline-variant/60 shadow-sm p-space-2xl">' +
      '<span class="material-symbols-outlined text-5xl text-error">lock</span>' +
      '<h1 class="font-headline-lg text-headline-lg mt-space-md">Admin access required</h1>' +
      '<p class="font-body-lg text-body-lg text-on-surface-variant mt-space-sm">' + esc(message || 'Sign in with an administrator account to open the dashboard.') + '</p>' +
      '<a href="auth.html?next=admin.html" class="inline-block mt-space-lg bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Sign in</a></div>';
  }

  function renderLoading() {
    main.innerHTML = '<div class="text-center py-space-2xl text-on-surface-variant">' +
      '<span class="material-symbols-outlined animate-spin">progress_activity</span>' +
      '<p class="mt-space-sm font-body-sm">Loading dashboard\u2026</p></div>';
  }

  function boot() {
    renderLoading();

    if (!API.isAuthenticated()) {
      return renderDenied('You are not signed in on this page\u2019s origin. Open http://localhost:4000/admin.html and sign in there \u2014 a session saved under file:// or a different port is not visible here.');
    }

    // Always refresh the profile first: `profiles.role` is the source of truth,
    // so a freshly-promoted admin is recognised without a re-login.
    API.getMe()
      .catch(function (err) {
        return { error: (err && err.message) || 'Could not load your profile' };
      })
      .then(function (result) {
        if (result && result.error) {
          return renderDenied('Could not load your profile (' + result.error + '). Your session may have expired \u2014 please sign in again.');
        }
        var role = API.getRole();
        var devAdmin = API.getDevUser() === 'dev-user-admin';
        if (role !== 'admin' && !devAdmin) {
          return renderDenied('Your account role is "' + role + '". An administrator account is required.');
        }
        renderShell();
        applyHash();
        return refresh();
      });
  }

  global.addEventListener('hashchange', applyHash);
  boot();
})(window);
