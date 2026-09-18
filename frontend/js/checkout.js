/* SpaceFit checkout wiring: order summary from cart + place order via API. */
(function () {
  'use strict';
  var API = window.SpaceFitAPI;
  if (!API) { console.warn('SpaceFitAPI not loaded'); return; }

  var currency = '\u20a6';
  var cart = null;

  function money(n) { return API.formatPrice(n, currency); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderSummary() {
    var itemsEl = document.getElementById('checkoutItems');
    var subtotalEl = document.getElementById('checkoutSubtotal');
    var deliveryEl = document.getElementById('checkoutDelivery');
    var totalEl = document.getElementById('checkoutTotal');
    if (!cart) return;

    if (itemsEl) {
      if (cart.items.length === 0) {
        itemsEl.innerHTML = '<p class="py-3.5 text-sm text-on-surface-variant">Your cart is empty.</p>';
      } else {
        itemsEl.innerHTML = cart.items.map(function (item) {
          var img = item.image
            ? '<img alt="' + esc(item.name) + '" class="w-16 h-16 rounded-lg object-cover border border-outline-variant flex-shrink-0" src="' + esc(item.image) + '">'
            : '';
          return '<div class="py-3.5 first:pt-0 flex items-center justify-between gap-4">' +
            '<div class="flex items-center gap-3 min-w-0">' + img +
            '<div class="min-w-0"><h3 class="text-sm font-semibold text-on-surface truncate">' + esc(item.name) + '</h3>' +
            '<p class="text-xs text-on-surface-variant mt-0.5">Qty: ' + item.quantity + '</p></div></div>' +
            '<div class="text-right flex-shrink-0"><span class="font-price-md text-price-md text-on-surface">' + money(item.price * item.quantity) + '</span></div></div>';
        }).join('');
      }
    }

    if (subtotalEl) subtotalEl.textContent = money(cart.subtotal);
    if (deliveryEl) deliveryEl.textContent = cart.delivery === 0 ? 'Free' : money(cart.delivery);
    if (totalEl) totalEl.textContent = money(cart.total);
  }

  function fieldValue(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function selectedPayment() {
    var el = document.querySelector('input[name="payment_method"]:checked');
    return el ? el.value : 'card';
  }

  function placeOrder() {
    if (!cart || cart.items.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    var payload = {
      cartId: cart.id,
      customer: {
        fullName: fieldValue('fullName'),
        email: fieldValue('email'),
        phone: fieldValue('phone')
      },
      delivery: {
        address: fieldValue('address'),
        city: fieldValue('city'),
        state: fieldValue('state'),
        instructions: fieldValue('instructions')
      },
      paymentMethod: selectedPayment()
    };

    var btn = document.querySelector('[data-purpose="place-order-button"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Placing order...'; }

    API.placeOrder(payload)
      .then(function (order) {
        API.clearCartId();
        window.location.href = 'order-succes.html?id=' + encodeURIComponent(order.id);
      })
      .catch(function (err) {
        console.error('Order failed', err);
        var msg = err.message;
        if (err.details) {
          msg += '\n' + Object.keys(err.details).map(function (k) { return '- ' + k + ': ' + err.details[k]; }).join('\n');
        }
        alert('Could not place order:\n' + msg);
        if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }
      });
  }

  function init() {
    API.getConfig().then(function (cfg) {
      if (cfg && cfg.currencySymbol) currency = cfg.currencySymbol;
    }).catch(function () {});

    API.ensureCart()
      .then(function (c) {
        if (c.items) { cart = c; renderSummary(); return; }
        return API.getCart(c.id).then(function (full) { cart = full; renderSummary(); });
      })
      .catch(function (err) {
        console.error('Failed to load cart', err);
      });

    var btn = document.querySelector('[data-purpose="place-order-button"]');
    if (btn) btn.addEventListener('click', placeOrder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
