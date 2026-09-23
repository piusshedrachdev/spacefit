/**
 * policies.html — renders the admin-maintained store policies and the active
 * discount information from GET /api/meta/settings (+ /api/meta/config for the
 * free-delivery threshold fallback).
 *
 * Sections are static markup with `data-policy` hooks so a missing/failed
 * settings call degrades to a friendly placeholder instead of a blank page.
 */
(function (global) {
  'use strict';

  var API = global.SpaceFitAPI;
  var Chrome = global.SpaceFitChrome || { escapeHtml: function (v) { return String(v == null ? '' : v); } };

  function esc(v) { return Chrome.escapeHtml(v); }

  function money(amount) {
    if (amount == null || isNaN(Number(amount))) return '';
    return API.formatPrice ? API.formatPrice(Number(amount)) : Number(amount);
  }

  var PLACEHOLDER = 'This policy has not been published yet. Check back soon or contact support@spacefit.ng.';

  function renderPolicies(policies) {
    var nodes = document.querySelectorAll('[data-policy]');
    Array.prototype.forEach.call(nodes, function (node) {
      var key = node.getAttribute('data-policy');
      var text = policies && policies[key];
      node.textContent = (text && String(text).trim()) || PLACEHOLDER;
    });
  }

  function renderFreeDeliveryNote(config) {
    var note = document.getElementById('freeDeliveryNote');
    if (!note) return;
    var threshold = (config && config.freeDeliveryThreshold) || 500000;
    note.innerHTML = 'Delivery is free on orders of <strong>' + esc(money(threshold)) + '</strong> and above.';
  }

  function renderDiscounts(discounts) {
    var panel = document.getElementById('discountsPanel');
    if (!panel) return;
    var d = discounts || {};
    var active = !!d.bannerEnabled && (Number(d.sitewidePercent) > 0 || !!d.promoCode);

    if (!active) {
      panel.innerHTML = '<p class="font-body-md text-body-md text-on-surface-variant">There are no active discounts right now. Subscribe to the footer newsletter to hear about the next one.</p>';
      return;
    }

    var items = [];
    if (Number(d.sitewidePercent) > 0) {
      items.push('<li class="flex items-center gap-space-sm"><span class="material-symbols-outlined text-primary">percent</span><span><strong>' + esc(d.sitewidePercent) + '% off</strong> sitewide</span></li>');
    }
    if (d.promoCode) {
      items.push('<li class="flex items-center gap-space-sm"><span class="material-symbols-outlined text-primary">confirmation_number</span><span>Use code <strong class="tracking-wide">' + esc(d.promoCode) + '</strong> at checkout</span></li>');
    }
    if (d.freeDeliveryThreshold) {
      items.push('<li class="flex items-center gap-space-sm"><span class="material-symbols-outlined text-primary">local_shipping</span><span>Free delivery above <strong>' + esc(money(d.freeDeliveryThreshold)) + '</strong></span></li>');
    }

    panel.innerHTML =
      '<div class="rounded-xl bg-primary/10 border border-primary/30 p-space-md">' +
        '<ul class="space-y-space-sm font-body-md text-body-md text-on-surface">' + items.join('') + '</ul>' +
      '</div>';
  }

  function renderUpdated(settings) {
    var node = document.getElementById('policiesUpdated');
    if (!node) return;
    var stamp = settings && (settings.updated_at || settings.updatedAt);
    node.textContent = stamp ? 'Last updated ' + new Date(stamp).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  }

  function fail(message) {
    var panel = document.getElementById('policiesPanel');
    if (panel) {
      panel.insertAdjacentHTML('afterbegin',
        '<div class="rounded-xl bg-error-container text-on-error-container px-space-md py-space-sm font-body-sm">' + esc(message) + '</div>');
    }
    if (Chrome.toast) Chrome.toast(message, true);
  }

  function init() {
    if (!API) return;

    API.getSettings().then(function (settings) {
      settings = settings || {};
      renderPolicies(settings.policies);
      renderDiscounts(settings.discounts);
      renderUpdated(settings);
      var threshold = settings.discounts && settings.discounts.freeDeliveryThreshold;
      if (threshold) renderFreeDeliveryNote({ freeDeliveryThreshold: threshold });
      else {
        API.getConfig().then(renderFreeDeliveryNote).catch(function () { renderFreeDeliveryNote(null); });
      }
    }).catch(function () {
      renderPolicies(null);
      renderDiscounts(null);
      fail('Could not load store policies. Please refresh the page.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
