/* SpaceFit product-details wiring: loads product + related from the API. */
(function () {
  'use strict';
  var API = window.SpaceFitAPI;
  if (!API) { console.warn('SpaceFitAPI not loaded'); return; }

  var currency = '\u20a6';
  var currentProductId = null;

  function hexToBg(hex) {
    return hex ? 'bg-[' + hex + ']' : 'bg-surface-container-high';
  }

  function transform(product, related) {
    var images = product.images && product.images.length ? product.images : [''];
    return {
      id: product.id,
      title: product.title,
      fullTitle: product.title,
      category: product.category,
      rating: String(product.rating),
      reviews: '(' + product.reviews + ' reviews)',
      price: API.formatPrice(product.price, currency),
      origPrice: product.origPrice ? API.formatPrice(product.origPrice, currency) : null,
      availability: product.availability,
      description: product.description,
      features: product.features || [],
      specs: product.specs || [],
      colors: (product.colors || []).map(function (c) { return { name: c.name, bg: hexToBg(c.hex) }; }),
      sizes: product.sizes || [],
      mainImage: images[0],
      gallery: images,
      related: (related || []).map(function (r) {
        return {
          id: r.id,
          title: r.title,
          image: r.image || '',
          price: API.formatPrice(r.price, currency)
        };
      })
    };
  }

  function load(productId) {
    currentProductId = productId;
    return Promise.all([
      API.getProduct(productId),
      API.getRelatedProducts(productId, 4).catch(function () { return []; })
    ]).then(function (res) {
      var transformed = transform(res[0], res[1]);
      if (typeof window.renderProductDetails === 'function') {
        window.renderProductDetails(transformed);
      } else {
        console.error('renderProductDetails not available');
      }
    }).catch(function (err) {
      console.error('Failed to load product', err);
    });
  }

  function showToast(name) {
    var toast = document.getElementById('cartToast');
    var toastItemName = document.getElementById('toastItemName');
    if (!toast || !toastItemName) return;
    toastItemName.textContent = name + ' added';
    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(window.dismissToast, 3500);
  }

  // Override the inline localStorage-based add-to-cart with an API call.
  window.triggerAddToCart = function (arg) {
    // Accepts a product id, or a legacy title string like "Name (x2)".
    var id = currentProductId;
    var qty = 1;
    if (arg && typeof arg === 'string') {
      var m = arg.match(/\(x(\d+)\)/);
      if (m) qty = parseInt(m[1], 10);
      if (!/\s/.test(arg)) id = arg;
    }
    API.addToCart(id, qty)
      .then(function (cart) {
        document.querySelectorAll('#cartBadge, [data-cart-badge]').forEach(function (el) {
          el.textContent = cart.itemCount;
        });
        showToast(arg || id);
      })
      .catch(function (err) {
        console.error('Add to cart failed', err);
        alert('Could not add to cart: ' + err.message);
      });
  };

  window.dismissToast = function () {
    var toast = document.getElementById('cartToast');
    if (!toast) return;
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
  };

  function init() {
    API.getConfig().then(function (cfg) {
      if (cfg && cfg.currencySymbol) currency = cfg.currencySymbol;
    }).catch(function () {});

    var params = new URLSearchParams(window.location.search);
    var productId = params.get('id') || 'luna-bed';
    load(productId);

    if (API.getCartId()) {
      API.getCart(API.getCartId()).then(function (cart) {
        document.querySelectorAll('#cartBadge, [data-cart-badge]').forEach(function (el) {
          el.textContent = cart.itemCount;
        });
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
