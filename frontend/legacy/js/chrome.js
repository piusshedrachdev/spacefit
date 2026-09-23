/**
 * Shared page chrome: auth-aware account control, notifications bell and
 * policy/discount footer. Included on every storefront page after api.js.
 *
 * It decorates the existing header (looks for [data-path="account"]) rather
 * than replacing page markup, so pages keep working if this script is absent.
 */
(function (global) {
  'use strict';

  var API = global.SpaceFitAPI;
  if (!API) return;

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    if (html != null) node.innerHTML = html;
    return node;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(message, isError) {
    var existing = document.getElementById('chromeToast');
    if (existing) existing.remove();
    var node = el('div', {
      id: 'chromeToast',
      class: 'fixed top-24 right-8 z-[60] flex items-center gap-space-sm px-space-lg py-space-md rounded-xl shadow-xl transition-all duration-300 ' +
        (isError ? 'bg-error text-on-error' : 'bg-inverse-surface text-inverse-on-surface')
    }, '<span class="material-symbols-outlined text-xl">' +
        (isError ? 'error' : 'check_circle') + '</span><span class="font-body-sm">' +
        escapeHtml(message) + '</span>');
    document.body.appendChild(node);
    setTimeout(function () { node.remove(); }, 3200);
  }

  global.SpaceFitChrome = { toast: toast, escapeHtml: escapeHtml };

  /* --------------------------------------------------------- account menu */

  function dashboardLink(role) {
    if (role === 'admin') return { href: 'admin.html', label: 'Admin dashboard' };
    if (role === 'seller') return { href: 'seller-dashboard.html', label: 'Seller dashboard' };
    return null;
  }

  function renderAccountControl() {
    var slot = document.querySelector('[data-path="account"]');
    if (!slot) return;

    if (!API.isAuthenticated()) {
      slot.setAttribute('href', 'auth.html');
      slot.setAttribute('title', 'Sign in');
      slot.innerHTML = '<span class="material-symbols-outlined text-2xl">person</span>';
      return;
    }

    var user = API.getUser() || {};
    var role = API.getRole();
    var dash = dashboardLink(role);
    var label = (API.getProfile() && API.getProfile().full_name) || user.email || 'Account';

    var wrapper = el('div', { class: 'relative' });
    var button = el('button', {
      type: 'button',
      'aria-label': 'Account menu',
      class: 'p-0.5 rounded-full ring-1 ring-outline-variant/50 hover:ring-primary transition-all flex items-center justify-center'
    }, '<span class="material-symbols-outlined text-2xl text-on-surface-variant">account_circle</span>');

    var menu = el('div', {
      class: 'hidden absolute right-0 mt-space-sm w-56 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/40 py-space-sm z-50'
    });
    menu.innerHTML =
      '<div class="px-space-md py-space-sm border-b border-outline-variant/30">' +
        '<p class="font-label-md text-on-surface truncate">' + escapeHtml(label) + '</p>' +
        '<p class="font-body-sm text-on-surface-variant capitalize">' + escapeHtml(role) + '</p>' +
      '</div>' +
      (dash ? '<a href="' + dash.href + '" class="flex items-center gap-space-sm px-space-md py-space-sm hover:bg-surface-container-high"><span class="material-symbols-outlined text-xl">dashboard</span>' + dash.label + '</a>' : '') +
      '<a href="seller-apply.html" class="flex items-center gap-space-sm px-space-md py-space-sm hover:bg-surface-container-high"><span class="material-symbols-outlined text-xl">storefront</span>Become a Seller</a>' +
      '<button type="button" data-action="logout" class="w-full text-left flex items-center gap-space-sm px-space-md py-space-sm hover:bg-surface-container-high text-error"><span class="material-symbols-outlined text-xl">logout</span>Sign out</button>';

    button.addEventListener('click', function (e) {
      e.preventDefault();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) menu.classList.add('hidden');
    });
    menu.querySelector('[data-action="logout"]').addEventListener('click', function () {
      API.logout().then(function () { global.location.href = 'index.html'; });
    });

    wrapper.appendChild(button);
    wrapper.appendChild(menu);
    slot.replaceWith(wrapper);
  }

  /* ----------------------------------------------------- notifications bell */

  function renderBell() {
    if (!API.isAuthenticated()) return;
    var accountSlot = document.querySelector('[data-path="account"]') ||
      document.querySelector('[data-path="cart"]');
    var host = accountSlot && accountSlot.parentNode;
    if (!host || document.getElementById('chromeBell')) return;

    var link = el('a', {
      id: 'chromeBell',
      'aria-label': 'Notifications',
      href: 'seller-dashboard.html#notifications',
      class: 'relative p-space-sm rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all flex items-center justify-center'
    }, '<span class="material-symbols-outlined text-2xl">notifications</span>' +
       '<span id="chromeBellBadge" class="hidden absolute top-1 right-1 min-w-4 h-4 px-1 bg-primary text-on-primary font-label-sm text-[10px] rounded-full items-center justify-center font-bold"></span>');

    host.insertBefore(link, accountSlot);

    API.getNotifications(20).then(function (data) {
      var badge = document.getElementById('chromeBellBadge');
      if (!badge || !data) return;
      if (data.unreadCount > 0) {
        badge.textContent = data.unreadCount > 9 ? '9+' : String(data.unreadCount);
        badge.classList.remove('hidden');
        badge.classList.add('flex');
      }
    }).catch(function () {});
  }

  /* ------------------------------------------------------------- footer bits */

  function renderFooter() {
    API.getSettings().then(function (settings) {
      if (!settings) return;
      // Discount banner
      if (settings.discounts && settings.discounts.bannerEnabled) {
        var d = settings.discounts;
        var text = [];
        if (d.sitewidePercent) text.push(d.sitewidePercent + '% off sitewide');
        if (d.promoCode) text.push('code ' + d.promoCode);
        if (!text.length) text.push('Limited-time offer');
        var banner = el('div', {
          class: 'w-full bg-primary text-on-primary text-center py-space-sm px-margin font-label-lg'
        }, '<span class="material-symbols-outlined align-middle text-base">sell</span> ' + escapeHtml(text.join(' \u2022 ')));
        var header = document.querySelector('header');
        if (header && !document.getElementById('chromeBanner')) {
          banner.id = 'chromeBanner';
          header.parentNode.insertBefore(banner, header);
        }
      }
      // Policy links into the footer
      var footer = document.querySelector('footer');
      if (footer && !document.getElementById('chromePolicies')) {
        var row = el('div', { id: 'chromePolicies', class: 'text-center py-space-md' },
          '<a class="mx-space-sm text-on-surface-variant hover:text-primary" href="policies.html">Policies</a>' +
          '<a class="mx-space-sm text-on-surface-variant hover:text-primary" href="policies.html#returns">Returns</a>' +
          '<a class="mx-space-sm text-on-surface-variant hover:text-primary" href="policies.html#delivery">Delivery</a>' +
          '<a class="mx-space-sm text-on-surface-variant hover:text-primary" href="policies.html#privacy">Privacy</a>');
        footer.appendChild(row);
      }
    }).catch(function () {});
  }

  function init() {
    try {
      renderAccountControl();
      renderBell();
      renderFooter();
    } catch (e) {
      // Never let chrome decoration break the page.
      if (global.console) console.warn('[chrome]', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
