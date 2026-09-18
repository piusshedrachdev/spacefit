/**
 * SpaceFit API client.
 * Wraps fetch(), unwraps the backend { success, data, error } envelope, and
 * manages the server-side cart id (persisted in localStorage).
 * Exposed globally as SpaceFitAPI so plain script tags can use it.
 */
(function (global) {
  'use strict';

  var API_BASE =
    global.SPACEFIT_API_BASE !== undefined
      ? global.SPACEFIT_API_BASE
      : global.location && /^https?:$/.test(global.location.protocol)
        ? ''
        : 'http://localhost:4000';

  var CART_KEY = 'spacefitCartId';
  var LEGACY_KEY = 'spacefitCart';

  function getCartId() {
    try { return global.localStorage.getItem(CART_KEY); } catch (e) { return null; }
  }
  function setCartId(id) {
    try { global.localStorage.setItem(CART_KEY, id); } catch (e) {}
  }
  function clearCartId() {
    try { global.localStorage.removeItem(CART_KEY); } catch (e) {}
  }

  function request(path, options) {
    options = options || {};
    var headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    if (options.body) headers['Content-Type'] = 'application/json';
    return fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () {
        return { success: false, error: { message: 'Invalid server response' } };
      }).then(function (payload) {
        if (!res.ok || payload.success === false) {
          var err = new Error((payload.error && payload.error.message) || 'Request failed');
          err.status = res.status;
          err.details = payload.error && payload.error.details;
          throw err;
        }
        return payload.data;
      });
    });
  }

  function qs(params) {
    return params ? '?' + new URLSearchParams(params).toString() : '';
  }

  function getProducts(params) { return request('/api/products' + qs(params)); }
  function getFeaturedProducts() { return request('/api/products/featured'); }
  function getProduct(id) { return request('/api/products/' + encodeURIComponent(id)); }
  function getRelatedProducts(id, limit) {
    return request('/api/products/' + encodeURIComponent(id) + '/related' + qs(limit ? { limit: limit } : null));
  }
  function getCategories() { return request('/api/products/categories'); }

  function createCart() {
    return request('/api/cart', { method: 'POST' }).then(function (cart) {
      setCartId(cart.id);
      return cart;
    });
  }
  function getCart(id) { return request('/api/cart/' + encodeURIComponent(id)); }

  function ensureCart() {
    var id = getCartId();
    if (!id) return createCart();
    return getCart(id).catch(function (err) {
      if (err.status === 404) { clearCartId(); return createCart(); }
      throw err;
    });
  }

  function resolveProductId(productIdOrTitle) {
    if (!productIdOrTitle) return Promise.reject(new Error('Missing product id'));
    if (!/\s/.test(productIdOrTitle)) return Promise.resolve(productIdOrTitle);
    return getProducts({ search: productIdOrTitle }).then(function (items) {
      var match = items && items[0];
      if (!match) throw new Error('Product not found: ' + productIdOrTitle);
      return match.id;
    });
  }

  function addToCart(productIdOrTitle, quantity) {
    return ensureCart().then(function (cart) {
      return resolveProductId(productIdOrTitle).then(function (id) {
        return request('/api/cart/' + encodeURIComponent(cart.id) + '/items', {
          method: 'POST',
          body: { productId: id, quantity: quantity || 1 }
        });
      });
    });
  }

  function updateCartItem(cartId, itemKey, quantity) {
    return request('/api/cart/' + encodeURIComponent(cartId) + '/items/' + encodeURIComponent(itemKey), {
      method: 'PATCH', body: { quantity: quantity }
    });
  }
  function removeCartItem(cartId, itemKey) {
    return request('/api/cart/' + encodeURIComponent(cartId) + '/items/' + encodeURIComponent(itemKey), {
      method: 'DELETE'
    });
  }
  function validateCart(cartId) {
    return request('/api/cart/' + encodeURIComponent(cartId) + '/validate', { method: 'POST' });
  }

  function placeOrder(payload) { return request('/api/orders', { method: 'POST', body: payload }); }
  function getOrder(id) { return request('/api/orders/' + encodeURIComponent(id)); }
  function getConfig() { return request('/api/meta/config'); }
  function subscribe(email) { return request('/api/newsletter', { method: 'POST', body: { email: email } }); }
  function bookConsultation(payload) { return request('/api/consultations', { method: 'POST', body: payload }); }

  function formatPrice(amount, symbol) {
    return (symbol || '\u20a6') + Number(amount || 0).toLocaleString('en-NG');
  }

  global.SpaceFitAPI = {
    API_BASE: API_BASE,
    request: request,
    getProducts: getProducts,
    getFeaturedProducts: getFeaturedProducts,
    getProduct: getProduct,
    getRelatedProducts: getRelatedProducts,
    getCategories: getCategories,
    createCart: createCart,
    getCart: getCart,
    ensureCart: ensureCart,
    addToCart: addToCart,
    updateCartItem: updateCartItem,
    removeCartItem: removeCartItem,
    validateCart: validateCart,
    placeOrder: placeOrder,
    getOrder: getOrder,
    getConfig: getConfig,
    subscribe: subscribe,
    bookConsultation: bookConsultation,
    formatPrice: formatPrice,
    getCartId: getCartId,
    clearCartId: clearCartId
  };
})(window);
