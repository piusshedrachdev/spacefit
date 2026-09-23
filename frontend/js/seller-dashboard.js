/**
 * Seller dashboard controller.
 *
 * Tabs: Overview, My Products, Reviews, Returns, Notifications, Shop profile.
 * Gating (per the plan):
 *   - signed out            -> auth prompt
 *   - applied, pending      -> "under review"
 *   - blocked seller        -> "contact support"
 *   - approved seller       -> dashboard
 *
 * All data flows through SpaceFitAPI; feedback uses SpaceFitChrome.toast.
 */
(function (global) {
  'use strict';

  var API = global.SpaceFitAPI;
  var Chrome = global.SpaceFitChrome || { toast: function () {}, escapeHtml: function (v) { return v; } };
  if (!API) return;

  var main = document.getElementById('sellerMain');
  if (!main) return;

  var state = {
    tab: 'overview',
    context: null,
    stats: null,
    products: [],
    reviews: [],
    returns: [],
    notifications: [],
    categories: [],
    failures: []
  };

  var TABS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'products', label: 'My Products', icon: 'inventory_2' },
    { id: 'reviews', label: 'Reviews', icon: 'star' },
    { id: 'returns', label: 'Returns', icon: 'assignment_return' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'profile', label: 'Shop profile', icon: 'storefront' }
  ];

  /* -------------------------------------------------------------- helpers */

  function esc(v) { return Chrome.escapeHtml(v); }
  function money(amount) { return API.formatPrice(amount); }

  function fmtDate(value) {
    if (!value) return '\u2014';
    try { return new Date(value).toLocaleString('en-NG'); } catch (e) { return value; }
  }

  function statusPill(status) {
    var tones = {
      requested: 'bg-secondary-container text-on-secondary-container',
      approved: 'bg-primary/10 text-primary',
      rejected: 'bg-error-container text-on-error-container',
      completed: 'bg-primary/10 text-primary'
    };
    return '<span class="inline-block px-space-sm py-space-xs rounded-full font-label-md capitalize ' +
      (tones[status] || 'bg-surface-container-high') + '">' + esc(status) + '</span>';
  }

  function stars(rating) {
    var n = Math.round(Number(rating) || 0);
    var out = '';
    for (var i = 1; i <= 5; i += 1) {
      out += '<span class="material-symbols-outlined text-base ' + (i <= n ? 'text-secondary-container' : 'text-outline-variant') +
        '" style="font-variation-settings:\'FILL\' ' + (i <= n ? 1 : 0) + ';">star</span>';
    }
    return out;
  }

  function card(label, value) {
    return '<div class="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg">' +
      '<p class="font-label-md text-on-surface-variant">' + esc(label) + '</p>' +
      '<p class="font-headline-md text-headline-md text-on-surface mt-space-xs">' + value + '</p></div>';
  }

  /** Accepts an array of <tr> strings or a single joined string. */
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

  function modal(title, bodyHtml, onConfirm, confirmLabel) {
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[70] bg-inverse-surface/40 flex items-center justify-center p-margin';
    overlay.innerHTML =
      '<div class="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">' +
      '<div class="px-space-lg py-space-md border-b border-outline-variant/40 flex items-center justify-between">' +
      '<h3 class="font-headline-sm">' + esc(title) + '</h3>' +
      '<button type="button" data-close class="text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined">close</span></button></div>' +
      '<div class="p-space-lg space-y-space-md">' + bodyHtml + '</div>' +
      '<div class="px-space-lg py-space-md border-t border-outline-variant/40 flex justify-end gap-space-sm">' +
      '<button type="button" data-cancel class="px-space-lg py-space-sm rounded-lg border border-outline-variant font-label-lg hover:border-primary">Cancel</button>' +
      '<button type="button" data-confirm class="px-space-lg py-space-sm rounded-lg bg-primary text-on-primary font-label-lg hover:opacity-95">' + esc(confirmLabel || 'Confirm') + '</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close]').addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('[data-cancel]').addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('[data-confirm]').addEventListener('click', function () {
      onConfirm(overlay).then(function () { overlay.remove(); }).catch(function (err) {
        Chrome.toast((err && err.message) || 'Action failed', true);
      });
    });
    return overlay;
  }

  function panel() { return document.getElementById('sellerPanel'); }

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
      '<section class="flex-1 min-w-0" id="sellerPanel"></section>' +
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

  function renderTab() {
    setActiveTab(state.tab);
    if (state.tab === 'overview') renderOverview();
    else if (state.tab === 'products') renderProducts();
    else if (state.tab === 'reviews') renderReviews();
    else if (state.tab === 'returns') renderReturns();
    else if (state.tab === 'notifications') renderNotifications();
    else renderProfile();
    renderFailures();
  }

  function renderFailures() {
    if (!state.failures.length) return;
    var host = panel();
    var banner = document.createElement('div');
    banner.className = 'mb-space-md rounded-xl border border-error/40 bg-error-container text-on-error-container p-space-md font-body-sm';
    banner.innerHTML = '<strong>Some data could not be loaded.</strong> ' + esc(state.failures.join('  \u00b7  '));
    host.insertBefore(banner, host.firstChild);
  }

  /* ------------------------------------------------------------ overview */

  function renderOverview() {
    var s = state.stats || {};
    var ret = s.returns || {};
    var orders = (s.recentOrders || []).map(function (o) {
      return '<tr class="border-t border-outline-variant/40"><td class="px-space-md py-space-sm">' + esc(o.reference || o.id) +
        '</td><td class="px-space-md py-space-sm">' + esc(o.status) + '</td><td class="px-space-md py-space-sm">' + esc(o.units) +
        '</td><td class="px-space-md py-space-sm">' + money(o.value) + '</td><td class="px-space-md py-space-sm">' + fmtDate(o.createdAt) + '</td></tr>';
    });

    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">' + esc((state.context.seller && state.context.seller.shopName) || 'Your shop') + '</h1>' +
      '<div class="grid grid-cols-2 lg:grid-cols-3 gap-space-md">' +
        card('Products listed', esc(s.products || 0)) +
        card('Units sold', esc(s.unitsSold || 0)) +
        card('Revenue', money(s.revenue || 0)) +
        card('Avg rating', (esc(s.avgRating || 0)) + ' ' + stars(s.avgRating)) +
        card('Reviews', esc(s.reviewsCount || 0)) +
        card('Returns', esc(ret.total || 0) + (ret.requested ? ' <span class="text-secondary text-body-sm">(' + ret.requested + ' open)</span>' : '')) +
      '</div>' +
      '<div class="mt-space-lg">' +
        '<h2 class="font-headline-sm mb-space-sm">Recent orders</h2>' +
        table(['Reference', 'Status', 'Units', 'Value', 'Placed'], orders.length ? orders :
          '<tr><td class="px-space-md py-space-md text-on-surface-variant" colspan="5">No orders yet.</td></tr>') +
      '</div>';
  }

  /* ------------------------------------------------------------ products */

  function renderProducts() {
    var rows = state.products.map(function (p) {
      return '<tr class="border-t border-outline-variant/40"><td class="px-space-md py-space-sm">' + esc(p.title) +
        '<br/><span class="text-on-surface-variant">' + esc(p.category) + '</span></td>' +
        '<td class="px-space-md py-space-sm">' + money(p.price) + '</td>' +
        '<td class="px-space-md py-space-sm">' + esc(p.availability || '') + (p.featured ? ' \u00b7 <span class="text-primary">Featured</span>' : '') + '</td>' +
        '<td class="px-space-md py-space-sm">' + esc(p.reviews || 0) + ' @ ' + esc(p.rating || 0) + '</td>' +
        '<td class="px-space-md py-space-sm"><button type="button" data-edit="' + esc(p.id) + '" class="text-primary font-label-md hover:underline mr-space-sm">Edit</button>' +
        '<button type="button" data-delete="' + esc(p.id) + '" class="text-error font-label-md hover:underline">Delete</button></td></tr>';
    });

    panel().innerHTML =
      '<div class="flex items-center justify-between mb-space-md">' +
        '<h1 class="font-headline-lg text-headline-lg">My Products</h1>' +
        '<button type="button" id="addProduct" class="bg-primary text-on-primary px-space-lg py-space-sm rounded-lg font-label-lg hover:opacity-95">Add product</button>' +
      '</div>' +
      table(['Product', 'Price', 'Availability', 'Reviews', ''], rows.length ? rows :
        '<tr><td class="px-space-md py-space-md text-on-surface-variant" colspan="5">No products yet. Click \u201cAdd product\u201d to list your first item.</td></tr>');

    document.getElementById('addProduct').addEventListener('click', function () { openProductModal(null); });
    panel().querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit');
        openProductModal(state.products.find(function (p) { return p.id === id; }));
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

  /* ------------------------------------------------------- product modal */

  function inputCls() {
    return 'w-full text-sm border border-outline-variant rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary bg-surface';
  }

  function field(label, id, value, type) {
    return '<div><label class="font-label-md text-on-surface-variant">' + esc(label) + '</label>' +
      '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '" class="' + inputCls() + '" /></div>';
  }

  function area(label, id, value) {
    return '<div><label class="font-label-md text-on-surface-variant">' + esc(label) + '</label>' +
      '<textarea id="' + id + '" rows="3" class="' + inputCls() + '">' + esc(value || '') + '</textarea></div>';
  }

  function linesToList(value) {
    return String(value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function openProductModal(product) {
    var p = product || {};
    var categoryOptions = state.categories.map(function (c) {
      var name = typeof c === 'string' ? c : c.name;
      return '<option value="' + esc(name) + '"' + (name === p.category ? ' selected' : '') + '>' + esc(name) + '</option>';
    }).join('');

    var body =
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">' +
        field('Title', 'pfTitle', p.title) +
        '<div><label class="font-label-md text-on-surface-variant">Category</label>' +
          '<select id="pfCategory" class="' + inputCls() + '">' + (categoryOptions || '<option value="Uncategorised">Uncategorised</option>') + '</select></div>' +
        field('Price (\u20a6)', 'pfPrice', p.price, 'number') +
        field('Original price (\u20a6)', 'pfOrigPrice', p.origPrice, 'number') +
        field('Availability', 'pfAvailability', p.availability || 'In stock') +
        '<label class="flex items-center gap-space-sm font-body-sm mt-space-lg"><input id="pfFeatured" type="checkbox" ' + (p.featured ? 'checked' : '') + ' /> Featured</label>' +
      '</div>' +
      area('Short description', 'pfShort', p.shortDescription) +
      area('Description', 'pfDescription', p.description) +
      area('Features (one per line)', 'pfFeatures', (p.features || []).join('\n')) +
      area('Sizes (one per line)', 'pfSizes', (p.sizes || []).join('\n')) +
      area('Image URLs (one per line)', 'pfImages', (p.images || []).join('\n'));

    modal(product ? 'Edit product' : 'Add product', body, function (overlay) {
      var title = overlay.querySelector('#pfTitle').value.trim();
      if (title.length < 2) return Promise.reject(new Error('Enter a product title.'));
      var price = Number(overlay.querySelector('#pfPrice').value);
      if (Number.isNaN(price) || price < 0) return Promise.reject(new Error('Enter a valid price.'));

      var payload = {
        title: title,
        category: overlay.querySelector('#pfCategory').value,
        price: price,
        origPrice: overlay.querySelector('#pfOrigPrice').value ? Number(overlay.querySelector('#pfOrigPrice').value) : undefined,
        availability: overlay.querySelector('#pfAvailability').value.trim(),
        shortDescription: overlay.querySelector('#pfShort').value.trim(),
        description: overlay.querySelector('#pfDescription').value.trim(),
        features: linesToList(overlay.querySelector('#pfFeatures').value),
        sizes: linesToList(overlay.querySelector('#pfSizes').value),
        images: linesToList(overlay.querySelector('#pfImages').value),
        featured: overlay.querySelector('#pfFeatured').checked
      };

      var task = product ? API.updateProduct(product.id, payload) : API.createProduct(payload);
      return task.then(function () { Chrome.toast(product ? 'Product updated.' : 'Product added.'); return refresh(); });
    }, product ? 'Save changes' : 'Add product');
  }

  /* ------------------------------------------------------------- reviews */

  function renderReviews() {
    var cards = state.reviews.map(function (r) {
      return '<div class="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg">' +
        '<div class="flex items-center justify-between"><p class="font-label-lg">' + esc(r.productTitle || 'Product') + '</p>' + stars(r.rating) + '</div>' +
        '<p class="font-body-md text-on-surface-variant mt-space-xs">' + esc(r.comment || '(no comment)') + '</p>' +
        '<p class="font-body-sm text-outline mt-space-sm">' + fmtDate(r.createdAt) + '</p></div>';
    });

    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Reviews</h1>' +
      (cards.length ? '<div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">' + cards.join('') + '</div>'
        : '<p class="text-on-surface-variant">No reviews yet.</p>');
  }

  /* ------------------------------------------------------------- returns */

  function renderReturns() {
    var rows = state.returns.map(function (r) {
      var actions = r.status === 'requested'
        ? '<button type="button" data-approve="' + esc(r.id) + '" class="text-primary font-label-md hover:underline mr-space-sm">Approve</button>' +
          '<button type="button" data-reject="' + esc(r.id) + '" class="text-error font-label-md hover:underline">Reject</button>'
        : '<span class="text-on-surface-variant">' + esc(r.status) + '</span>';
      return '<tr class="border-t border-outline-variant/40"><td class="px-space-md py-space-sm">' + esc(r.productTitle || r.productId) +
        '</td><td class="px-space-md py-space-sm">' + esc(r.reason) + '</td><td class="px-space-md py-space-sm">' + statusPill(r.status) +
        '</td><td class="px-space-md py-space-sm">' + fmtDate(r.createdAt) + '</td><td class="px-space-md py-space-sm">' + actions + '</td></tr>';
    });

    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Returns</h1>' +
      table(['Product', 'Reason', 'Status', 'Requested', ''], rows.length ? rows :
        '<tr><td class="px-space-md py-space-md text-on-surface-variant" colspan="5">No return requests.</td></tr>');

    function act(id, status) {
      return API.updateReturnStatus(id, status).then(function () {
        Chrome.toast('Return ' + status + '.');
        return refresh();
      }).catch(function (err) { Chrome.toast((err && err.message) || 'Update failed', true); });
    }
    panel().querySelectorAll('[data-approve]').forEach(function (b) {
      b.addEventListener('click', function () { act(b.getAttribute('data-approve'), 'approved'); });
    });
    panel().querySelectorAll('[data-reject]').forEach(function (b) {
      b.addEventListener('click', function () { act(b.getAttribute('data-reject'), 'rejected'); });
    });
  }

  /* ------------------------------------------------------- notifications */

  function renderNotifications() {
    var items = state.notifications || [];
    var list = items.map(function (n) {
      return '<div class="flex items-start gap-space-md bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-md' +
        (n.readAt ? '' : ' border-l-4 border-l-primary') + '">' +
        '<span class="material-symbols-outlined text-primary mt-0.5">notifications</span>' +
        '<div class="flex-1 min-w-0"><p class="font-label-lg">' + esc(n.title) + '</p>' +
        (n.body ? '<p class="font-body-sm text-on-surface-variant">' + esc(n.body) + '</p>' : '') +
        '<p class="font-body-sm text-outline mt-space-xs">' + fmtDate(n.createdAt) + '</p></div>' +
        (n.readAt ? '' : '<button type="button" data-read="' + esc(n.id) + '" class="text-primary font-label-md hover:underline shrink-0">Mark read</button>') +
        '</div>';
    });

    panel().innerHTML =
      '<div class="flex items-center justify-between mb-space-md">' +
        '<h1 class="font-headline-lg text-headline-lg">Notifications</h1>' +
        '<button type="button" id="readAll" class="border border-outline-variant px-space-lg py-space-sm rounded-lg font-label-lg hover:border-primary">Mark all read</button>' +
      '</div>' +
      (list.length ? '<div class="space-y-space-sm">' + list.join('') + '</div>'
        : '<p class="text-on-surface-variant">No notifications.</p>');

    document.getElementById('readAll').addEventListener('click', function () {
      API.markAllNotificationsRead().then(function () { Chrome.toast('All caught up.'); return refresh(); })
        .catch(function (err) { Chrome.toast((err && err.message) || 'Failed', true); });
    });
    panel().querySelectorAll('[data-read]').forEach(function (b) {
      b.addEventListener('click', function () {
        API.markNotificationRead(b.getAttribute('data-read')).then(function () { return refresh(); })
          .catch(function (err) { Chrome.toast((err && err.message) || 'Failed', true); });
      });
    });
  }

  /* ------------------------------------------------------------- profile */

  function renderProfile() {
    var seller = state.context.seller || {};
    panel().innerHTML =
      '<h1 class="font-headline-lg text-headline-lg mb-space-md">Shop profile</h1>' +
      '<div class="max-w-xl bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg space-y-space-md">' +
        field('Shop name', 'spShopName', seller.shopName) +
        area('About your shop', 'spBio', seller.bio) +
        area('Delivery places (one per line)', 'spPlaces', (seller.deliveryPlaces || []).join('\n')) +
        '<div class="flex justify-end"><button type="button" id="saveProfile" class="bg-primary text-on-primary px-space-xl py-space-sm rounded-lg font-label-lg hover:opacity-95">Save profile</button></div>' +
      '</div>';

    document.getElementById('saveProfile').addEventListener('click', function () {
      var patch = {
        shopName: document.getElementById('spShopName').value.trim(),
        bio: document.getElementById('spBio').value.trim(),
        deliveryPlaces: linesToList(document.getElementById('spPlaces').value)
      };
      if (patch.shopName.length < 2) return Chrome.toast('Enter a shop name.', true);
      API.updateMySellerProfile(patch).then(function () {
        Chrome.toast('Shop profile saved.');
        return refresh();
      }).catch(function (err) { Chrome.toast((err && err.message) || 'Could not save profile', true); });
    });
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
      label(API.getSellerDashboard, 'dashboard'),
      label(API.getReturns, 'returns'),
      label(function () { return API.getNotifications(30); }, 'notifications')
    ]).then(function (results) {
      state.failures = [];
      results.forEach(function (r) {
        if (r.error) { state.failures.push(r.name + ': ' + r.error); return; }
        if (r.name === 'dashboard') {
          state.stats = r.value.stats || null;
          state.products = (r.value.products && r.value.products.length ? r.value.products : state.products) || [];
          state.reviews = r.value.reviews || [];
          if (r.value.seller) state.context.seller = r.value.seller;
        } else if (r.name === 'returns') {
          state.returns = Array.isArray(r.value) ? r.value : [];
        } else if (r.name === 'notifications') {
          state.notifications = (r.value && r.value.items) || [];
        }
      });
      renderTab();
    });
  }

  /** Load the seller's own products (dashboard stats do not include full rows). */
  function loadProducts() {
    var sellerId = state.context.seller && state.context.seller.id;
    if (!sellerId) return Promise.resolve();
    return API.getProducts({ sellerId: sellerId, limit: 200 })
      .then(function (items) { state.products = Array.isArray(items) ? items : []; })
      .catch(function () {});
  }

  /* ------------------------------------------------------------------- gate */

  function shell(title, icon, tone, bodyHtml, ctaHtml) {
    main.innerHTML =
      '<div class="max-w-lg mx-auto text-center bg-surface rounded-2xl border border-outline-variant/60 shadow-sm p-space-2xl">' +
      '<span class="material-symbols-outlined text-5xl ' + tone + '" style="font-variation-settings:\'FILL\' 1;">' + icon + '</span>' +
      '<h1 class="font-headline-lg text-headline-lg mt-space-md">' + esc(title) + '</h1>' +
      '<div class="font-body-lg text-body-lg text-on-surface-variant mt-space-sm">' + bodyHtml + '</div>' +
      (ctaHtml ? '<div class="mt-space-lg">' + ctaHtml + '</div>' : '') + '</div>';
  }

  function renderLoading() {
    main.innerHTML = '<div class="text-center py-space-2xl text-on-surface-variant"><span class="material-symbols-outlined animate-spin">progress_activity</span></div>';
  }

  function boot() {
    renderLoading();
    if (!API.isAuthenticated()) {
      return shell('Sign in to sell on SpaceFit', 'storefront', 'text-primary',
        '<p>Open your seller dashboard to manage listings, orders, reviews and returns.</p>',
        '<a href="auth.html?next=seller-dashboard.html" class="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Sign in</a>');
    }

    API.getMySellerContext()
      .catch(function (err) { return { error: (err && err.message) || 'Could not load your seller profile' }; })
      .then(function (context) {
        if (context && context.error) {
          return shell('Could not load your profile', 'error', 'text-error', '<p>' + esc(context.error) + '</p>');
        }
        state.context = context || {};

        if (!context.isSeller) {
          var app = context.application;
          if (app && app.status === 'pending') {
            return shell('Application under review', 'hourglass_top', 'text-secondary',
              '<p>Your application for <strong>' + esc(app.shopName) + '</strong> is being reviewed. We\u2019ll be in touch within 2\u20133 business days.</p>');
          }
          if (app && app.status === 'rejected') {
            return shell('Application not approved', 'cancel', 'text-error',
              '<p>Your application was not approved.</p>' + (app.reviewNotes ? '<p class="mt-space-sm">Reviewer note: ' + esc(app.reviewNotes) + '</p>' : ''),
              '<a href="seller-apply.html" class="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Reapply</a>');
          }
          return shell('Become a SpaceFit seller', 'storefront', 'text-primary',
            '<p>Apply to start selling your pieces on SpaceFit.</p>',
            '<a href="seller-apply.html" class="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95">Apply to sell</a>');
        }

        if (context.seller && context.seller.status === 'blocked') {
          return shell('Seller account suspended', 'block', 'text-error',
            '<p>Your seller account is currently suspended. Please contact support@spacefit.ng for assistance.</p>');
        }

        Promise.all([loadProducts(), API.getCategories().catch(function () { return []; })]).then(function (r) {
          state.categories = Array.isArray(r[1]) ? r[1] : [];
          renderShell();
          applyHash();
          return refresh();
        });
      });
  }

  function applyHash() {
    var hash = (global.location.hash || '').replace('#', '');
    state.tab = TABS.some(function (t) { return t.id === hash; }) ? hash : 'overview';
    renderTab();
  }

  global.addEventListener('hashchange', function () {
    if (panel()) applyHash();
  });
  boot();
})(window);
