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
  var SESSION_KEY = 'spacefitSession';
  var DEV_USER_KEY = 'spacefitDevUser';

  /* --------------------------------------------------------------- session */

  function getSession() {
    try {
      var raw = global.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setSession(session) {
    try {
      if (session) global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else global.localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
  function clearSession() { setSession(null); }

  /** Memory-mode dev identity (ignored by the server when Supabase is on). */
  function getDevUser() {
    try { return global.localStorage.getItem(DEV_USER_KEY); } catch (e) { return null; }
  }
  function setDevUser(id) {
    try {
      if (id) global.localStorage.setItem(DEV_USER_KEY, id);
      else global.localStorage.removeItem(DEV_USER_KEY);
    } catch (e) {}
  }

  function isAuthenticated() {
    var s = getSession();
    return Boolean(s && (s.accessToken || getDevUser()));
  }
  function getUser() { var s = getSession(); return (s && s.user) || null; }
  function getProfile() { var s = getSession(); return (s && s.profile) || null; }
  function getRole() {
    var p = getProfile();
    if (p && p.role) return p.role;
    if (getDevUser() === 'dev-user-admin') return 'admin';
    if (getDevUser() === 'dev-user-seller') return 'seller';
    return 'customer';
  }

  /**
   * Redirect to the auth page (preserving the current page as ?next=) unless
   * the caller is signed in. Returns true when a redirect was triggered.
   */
  function routeIfUnauthed() {
    if (isAuthenticated()) return false;
    var next = global.location.pathname.split('/').pop() + global.location.search;
    global.location.href = 'auth.html?next=' + encodeURIComponent(next);
    return true;
  }

  function getCartId() {
    try { return global.localStorage.getItem(CART_KEY); } catch (e) { return null; }
  }
  function setCartId(id) {
    try { global.localStorage.setItem(CART_KEY, id); } catch (e) {}
  }
  function clearCartId() {
    try { global.localStorage.removeItem(CART_KEY); } catch (e) {}
  }

  function buildHeaders(options) {
    var headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    if (options.body) headers['Content-Type'] = 'application/json';
    var session = getSession();
    if (session && session.accessToken) {
      headers['Authorization'] = 'Bearer ' + session.accessToken;
    }
    // Memory-mode dev identity — the server ignores this when Supabase is set.
    var devUser = getDevUser();
    if (devUser && !(session && session.accessToken)) {
      headers['X-Dev-User'] = devUser;
    }
    return headers;
  }

  function refreshAccessToken() {
    var session = getSession();
    if (!session || !session.refreshToken) return Promise.reject(new Error('No refresh token'));
    return fetch(API_BASE + '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    }).then(function (res) { return res.json(); }).then(function (payload) {
      if (!payload || payload.success === false) throw new Error('Refresh failed');
      var data = payload.data;
      setSession({
        accessToken: data.session.accessToken,
        refreshToken: data.session.refreshToken,
        user: data.user,
        profile: getProfile()
      });
      return data;
    });
  }

  function parseResponse(res) {
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
  }

  function request(path, options) {
    options = options || {};
    var retry = options._retry;
    return fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers: buildHeaders(options),
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(parseResponse).catch(function (err) {
      // One transparent refresh attempt on an expired session.
      if (err.status === 401 && !retry && getSession() && getSession().refreshToken) {
        return refreshAccessToken().then(function () {
          var next = Object.assign({}, options, { _retry: true });
          return request(path, next);
        }).catch(function () {
          clearSession();
          throw err;
        });
      }
      if (err.status === 401) clearSession();
      throw err;
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

  /* ------------------------------------------------------------------ auth */

  function login(email, password) {
    return request('/api/auth/login', { method: 'POST', body: { email: email, password: password } })
      .then(function (data) {
        setSession({
          accessToken: data.session.accessToken,
          refreshToken: data.session.refreshToken,
          user: data.user,
          profile: data.profile || null
        });
        return data;
      });
  }

  function signup(payload) {
    return request('/api/auth/signup', { method: 'POST', body: payload }).then(function (data) {
      if (data.session) {
        setSession({
          accessToken: data.session.accessToken,
          refreshToken: data.session.refreshToken,
          user: data.user,
          profile: null
        });
      }
      return data;
    });
  }

  function logout() {
    return request('/api/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
      clearSession();
    });
  }

  function getMe() {
    return request('/api/auth/me').then(function (data) {
      var session = getSession() || {};
      setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user: data.user,
        profile: data.profile
      });
      return data;
    });
  }

  /* --------------------------------------------------- seller applications */

  function submitSellerApplication(payload) {
    return request('/api/sellers/applications', { method: 'POST', body: payload });
  }
  function getMySellerContext() { return request('/api/sellers/me'); }
  function updateMySellerProfile(patch) {
    return request('/api/sellers/me', { method: 'PATCH', body: patch });
  }
  function getSellerDashboard() { return request('/api/sellers/me/dashboard'); }

  /* ------------------------------------------------------------ admin only */

  function getApplications(status) { return request('/api/sellers/applications' + qs(status ? { status: status } : null)); }
  function getApplication(id) { return request('/api/sellers/applications/' + encodeURIComponent(id)); }
  function reviewApplication(id, decision, reviewNotes) {
    return request('/api/sellers/applications/' + encodeURIComponent(id), {
      method: 'PATCH', body: { decision: decision, reviewNotes: reviewNotes }
    });
  }
  function getSellers() { return request('/api/sellers'); }
  function setSellerStatus(id, status, reason) {
    return request('/api/sellers/' + encodeURIComponent(id), { method: 'PATCH', body: { status: status, reason: reason } });
  }

  /* ------------------------------------------------------- product writes */

  function createProduct(payload) { return request('/api/products', { method: 'POST', body: payload }); }
  function updateProduct(id, patch) {
    return request('/api/products/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
  }
  function deleteProduct(id) {
    return request('/api/products/' + encodeURIComponent(id), { method: 'DELETE' });
  }

  /* --------------------------------------------------------- notifications */

  function getNotifications(limit) { return request('/api/notifications' + qs(limit ? { limit: limit } : null)); }
  function markNotificationRead(id) {
    return request('/api/notifications/' + encodeURIComponent(id) + '/read', { method: 'PATCH' });
  }
  function markAllNotificationsRead() {
    return request('/api/notifications/read-all', { method: 'POST' });
  }

  /* --------------------------------------------------------------- settings */

  function getSettings() { return request('/api/meta/settings'); }
  function saveSettings(patch) { return request('/api/meta/settings', { method: 'PUT', body: patch }); }

  /* ---------------------------------------------------- reviews and returns */

  function getProductReviews(productId) { return request('/api/products/' + encodeURIComponent(productId) + '/reviews'); }
  function createProductReview(productId, payload) {
    return request('/api/products/' + encodeURIComponent(productId) + '/reviews', { method: 'POST', body: payload });
  }
  function getReturns() { return request('/api/returns'); }
  function updateReturnStatus(id, status, resolutionNotes) {
    return request('/api/returns/' + encodeURIComponent(id), {
      method: 'PATCH', body: { status: status, resolutionNotes: resolutionNotes }
    });
  }

  function placeOrder(payload) { return request('/api/orders', { method: 'POST', body: payload }); }
  function getOrders(userId) { return request('/api/orders' + qs(userId ? { userId: userId } : null)); }
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
    getOrders: getOrders,
    getConfig: getConfig,
    subscribe: subscribe,
    bookConsultation: bookConsultation,
    login: login,
    signup: signup,
    logout: logout,
    getMe: getMe,
    submitSellerApplication: submitSellerApplication,
    getMySellerContext: getMySellerContext,
    updateMySellerProfile: updateMySellerProfile,
    getSellerDashboard: getSellerDashboard,
    getApplications: getApplications,
    getApplication: getApplication,
    reviewApplication: reviewApplication,
    getSellers: getSellers,
    setSellerStatus: setSellerStatus,
    createProduct: createProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,
    getNotifications: getNotifications,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getProductReviews: getProductReviews,
    createProductReview: createProductReview,
    getReturns: getReturns,
    updateReturnStatus: updateReturnStatus,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    getDevUser: getDevUser,
    setDevUser: setDevUser,
    isAuthenticated: isAuthenticated,
    getUser: getUser,
    getProfile: getProfile,
    getRole: getRole,
    routeIfUnauthed: routeIfUnauthed,
    formatPrice: formatPrice,
    getCartId: getCartId,
    clearCartId: clearCartId
  };
})(window);
