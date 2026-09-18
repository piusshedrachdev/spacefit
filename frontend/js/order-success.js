/* SpaceFit order confirmation: renders order details from the API by ?id=. */
(function () {
  'use strict';
  var API = window.SpaceFitAPI;
  if (!API) { console.warn('SpaceFitAPI not loaded'); return; }

  var currency = '\u20a6';

  function money(n) { return API.formatPrice(n, currency); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(order) {
    var refEl = document.querySelector('[data-purpose="order-details-card"] .font-price-md');
    var totalEl = document.querySelector('[data-purpose="order-details-card"] .text-primary');
    if (refEl) refEl.textContent = '#' + (order.reference || order.id);
    if (totalEl) totalEl.textContent = money(order.total);

    var itemsWrap = document.querySelector('[data-purpose="order-items-list"] .grid');
    if (itemsWrap && order.items && order.items.length) {
      itemsWrap.innerHTML = order.items.map(function (item) {
        var img = item.image
          ? '<img alt="' + esc(item.name) + '" class="w-full h-full object-cover object-center" src="' + esc(item.image) + '" />'
          : '';
        var meta = [item.color, item.size].filter(Boolean).join(' \u2022 ');
        return '<div class="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm hover:shadow transition-shadow">' +
          '<div class="w-full h-32 rounded-lg bg-surface-container overflow-hidden mb-3">' + img + '</div>' +
          '<h3 class="text-sm font-bold text-on-surface tracking-tight">' + esc(item.name) + '</h3>' +
          '<p class="text-xs text-on-surface-variant mt-0.5 font-medium">' + esc(meta || ('Qty: ' + item.quantity)) + '</p>' +
          '<p class="text-xs text-on-surface-variant mt-1">' + money(item.price * item.quantity) + '</p></div>';
      }).join('');
    }
  }

  function init() {
    API.getConfig().then(function (cfg) {
      if (cfg && cfg.currencySymbol) currency = cfg.currencySymbol;
    }).catch(function () {});

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) return; // keep the static default confirmation

    API.getOrder(id)
      .then(render)
      .catch(function (err) {
        console.error('Failed to load order', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
