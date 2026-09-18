/* SpaceFit cart page wiring. Replaces the localStorage cart with the API. */
(function () {
  'use strict';
  var API = window.SpaceFitAPI;
  if (!API) { console.warn('SpaceFitAPI not loaded'); return; }

  var currency = '\u20a6';
  var state = { cart: null };

  function money(n) { return API.formatPrice(n, currency); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function itemHtml(item, index) {
    var img = item.image
      ? '<img src="' + esc(item.image) + '" alt="' + esc(item.name) + '" class="w-full h-full object-cover">'
      : '<span class="material-symbols-outlined text-4xl text-outline">chair</span>';
    return '' +
      '<div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 md:p-5">' +
        '<div class="flex gap-4">' +
          '<div class="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center">' + img + '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="flex justify-between gap-3">' +
              '<div>' +
                '<h3 class="font-headline-sm text-headline-sm text-on-surface">' + esc(item.name) + '</h3>' +
                '<p class="font-body-sm text-body-sm text-on-surface-variant mt-1">' + esc(item.size || '') + (item.color ? ' \u2022 ' + esc(item.color) : '') + '</p>' +
              '</div>' +
              '<button class="text-outline hover:text-error transition-colors" title="Remove" onclick="removeItem(' + index + ')"><span class="material-symbols-outlined">delete</span></button>' +
            '</div>' +
            '<div class="flex items-center justify-between mt-4">' +
              '<div class="flex items-center gap-2">' +
                '<button class="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center hover:border-primary" onclick="changeQuantity(' + index + ', -1)"><span class="material-symbols-outlined text-base">remove</span></button>' +
                '<span class="w-8 text-center font-label-md">' + item.quantity + '</span>' +
                '<button class="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center hover:border-primary" onclick="changeQuantity(' + index + ', 1)"><span class="material-symbols-outlined text-base">add</span></button>' +
              '</div>' +
              '<span class="font-price-md text-price-md text-on-surface font-bold">' + money(item.price * item.quantity) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function render() {
    var cart = state.cart;
    var itemsEl = document.getElementById('cartItems');
    var emptyEl = document.getElementById('emptyCart');
    var subtotalEl = document.getElementById('subtotal');
    var totalEl = document.getElementById('total');
    var deliveryEl = document.getElementById('delivery');
    var vatEl = document.getElementById('vat');
    var badge = document.getElementById('cartBadge');

    if (badge) badge.textContent = cart ? cart.itemCount : 0;

    if (!cart || cart.items.length === 0) {
      if (itemsEl) itemsEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (subtotalEl) subtotalEl.textContent = money(0);
      if (totalEl) totalEl.textContent = money(0);
      if (deliveryEl) deliveryEl.textContent = money(0);
      if (vatEl) vatEl.textContent = money(0);
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (itemsEl) itemsEl.innerHTML = cart.items.map(itemHtml).join('');
    if (subtotalEl) subtotalEl.textContent = money(cart.subtotal);
    if (deliveryEl) deliveryEl.textContent = cart.delivery === 0 ? 'Free' : money(cart.delivery);
    if (vatEl) vatEl.textContent = money(cart.vat);
    if (totalEl) totalEl.textContent = money(cart.total);
  }

  function refresh() {
    return API.ensureCart().then(function (cart) {
      // ensureCart returns either a full summary or a freshly created cart;
      // normalise by re-fetching the summary when needed.
      if (cart.items) { state.cart = cart; render(); return cart; }
      return API.getCart(cart.id).then(function (full) { state.cart = full; render(); return full; });
    });
  }

  window.changeQuantity = function (index, delta) {
    var item = state.cart && state.cart.items[index];
    if (!item) return;
    var next = item.quantity + delta;
    if (next <= 0) { window.removeItem(index); return; }
    API.updateCartItem(state.cart.id, item.key, next)
      .then(function (cart) { state.cart = cart; render(); })
      .catch(function (err) { alert('Could not update quantity: ' + err.message); });
  };

  window.removeItem = function (index) {
    var item = state.cart && state.cart.items[index];
    if (!item) return;
    API.removeCartItem(state.cart.id, item.key)
      .then(function (cart) { state.cart = cart; render(); })
      .catch(function (err) { alert('Could not remove item: ' + err.message); });
  };

  window.goToCheckout = function () {
    if (!state.cart || state.cart.items.length === 0) {
      alert('Your cart is empty.');
      return;
    }
    window.location.href = 'checkout.html';
  };

  function init() {
    API.getConfig().then(function (cfg) {
      if (cfg && cfg.currencySymbol) currency = cfg.currencySymbol;
    }).catch(function () {});
    refresh().catch(function (err) {
      console.error('Failed to load cart', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
