/* SpaceFit homepage wiring: product grid, add-to-cart, newsletter, consult. */
(function () {
  'use strict';
  var API = window.SpaceFitAPI;
  if (!API) { console.warn('SpaceFitAPI not loaded'); return; }

  var currency = '\u20a6';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cardHtml(p) {
    var img = p.images && p.images[0] ? p.images[0] : '';
    var inStock = /stock/i.test(p.availability || '') && !/low/i.test(p.availability || '');
    return '' +
      '<article class="product-card group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">' +
        '<div class="relative w-full aspect-[4/3] bg-surface-container-low overflow-hidden">' +
          '<img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="' + escapeHtml(p.title) + '" src="' + escapeHtml(img) + '" />' +
          (p.featured ? '<div class="absolute top-3 left-3"><span class="bg-primary text-on-primary font-label-sm text-[10px] tracking-wider uppercase font-bold px-2 py-0.5 rounded-full shadow-sm">Featured</span></div>' : '') +
          '<button aria-label="Add to wishlist" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-container-lowest/90 hover:bg-surface-container-lowest text-on-surface flex items-center justify-center transition-transform active:scale-90 shadow-sm" onclick="toggleFavorite(this)"><span class="material-symbols-outlined text-base">favorite</span></button>' +
        '</div>' +
        '<div class="p-space-md flex flex-col flex-1 justify-between gap-space-sm">' +
          '<div class="space-y-1">' +
            '<div class="flex items-center justify-between text-outline font-label-sm text-label-sm">' +
              '<span>' + escapeHtml(p.category) + '</span>' +
              '<div class="flex items-center text-secondary-container"><span class="material-symbols-outlined text-xs" style="font-variation-settings: \'FILL\' 1;">star</span><span class="font-bold text-on-surface ml-0.5 text-[11px]">' + escapeHtml(p.rating) + '</span><span class="text-outline text-[10px] ml-0.5">(' + escapeHtml(p.reviews) + ')</span></div>' +
            '</div>' +
            '<a class="block font-headline-sm text-[15px] leading-tight text-on-surface group-hover:text-primary transition-colors line-clamp-1" data-path="product-detail" href="product-details.html?id=' + encodeURIComponent(p.id) + '">' + escapeHtml(p.title) + '</a>' +
            '<p class="font-body-sm text-[11px] text-on-surface-variant line-clamp-1">' + escapeHtml(p.shortDescription || '') + '</p>' +
          '</div>' +
          '<div class="pt-space-xs flex items-center justify-between">' +
            '<div class="flex flex-col">' +
              '<span class="text-[10px] ' + (inStock ? 'text-emerald-700' : 'text-amber-700') + ' font-label-sm uppercase font-semibold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full ' + (inStock ? 'bg-emerald-600' : 'bg-amber-600') + '"></span> ' + escapeHtml(p.availability) + '</span>' +
              '<span class="font-price-md text-price-md text-on-surface font-bold">' + API.formatPrice(p.price, currency) + '</span>' +
            '</div>' +
            '<button class="bg-primary hover:bg-primary-container text-on-primary px-space-md py-space-xs rounded-lg font-label-md text-label-md shadow-sm transition-transform active:scale-95 flex items-center gap-1" onclick="triggerAddToCart(\'' + escapeHtml(p.id) + '\')"><span class="material-symbols-outlined text-sm">add</span><span>Add</span></button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function showToast(name) {
    var toast = document.getElementById('cartToast');
    var toastItemName = document.getElementById('toastItemName');
    if (!toast || !toastItemName) return;
    toastItemName.textContent = name + ' added';
    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(dismissToast, 3500);
  }

  function dismissToast() {
    var toast = document.getElementById('cartToast');
    if (!toast) return;
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
  }

  function updateCartBadge(count) {
    document.querySelectorAll('#cartBadge, [data-cart-badge]').forEach(function (el) {
      el.textContent = count;
    });
  }

  /* Global add-to-cart used by product cards. */
  window.triggerAddToCart = function (productId) {
    API.addToCart(productId, 1)
      .then(function (cart) {
        updateCartBadge(cart.itemCount);
        showToast(productId);
      })
      .catch(function (err) {
        console.error('Add to cart failed', err);
        alert('Could not add to cart: ' + err.message);
      });
  };

  window.dismissToast = dismissToast;

  window.toggleFavorite = function (btn) {
    var icon = btn.querySelector('.material-symbols-outlined');
    if (!icon) return;
    var filled = (icon.style.fontVariationSettings || '').indexOf("'FILL' 1") !== -1;
    icon.style.fontVariationSettings = filled ? "'FILL' 0" : "'FILL' 1";
    icon.classList.toggle('text-primary', !filled);
  };

  function renderProducts(products) {
    var grid = document.getElementById('stateGrid');
    if (!grid) return;
    if (!products || products.length === 0) {
      grid.innerHTML = '<p class="col-span-full text-center text-on-surface-variant py-12">No products found.</p>';
      return;
    }
    grid.innerHTML = products.map(cardHtml).join('');
  }

  function loadProducts() {
    var grid = document.getElementById('stateGrid');
    if (!grid) return Promise.resolve();
    return API.getProducts().then(renderProducts).catch(function (err) {
      console.error('Failed to load products', err);
    });
  }

  function loadCategories() {
    return API.getCategories().then(function (cats) {
      var containers = document.querySelectorAll('[data-category-filters]');
      containers.forEach(function (c) {
        c.innerHTML = cats.map(function (cat) {
          return '<button type="button" class="block w-full text-left px-space-sm py-space-xs rounded hover:bg-surface-container transition-colors text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface" data-category="' + escapeHtml(cat.name) + '">' + escapeHtml(cat.name) + ' <span class="text-outline">(' + cat.count + ')</span></button>';
        }).join('');
        c.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-category]');
          if (!btn) return;
          API.getProducts({ category: btn.getAttribute('data-category') }).then(renderProducts);
        });
      });
    }).catch(function (err) { console.error('Failed to load categories', err); });
  }

  function wireNewsletter() {
    var input = document.querySelector('[data-newsletter-input]');
    if (!input) return;
    var form = input.closest('form') || input.parentElement;
    form.addEventListener('submit', function (e) { e.preventDefault(); subscribe(input); });
    var btn = form.querySelector('button');
    if (btn) btn.addEventListener('click', function (e) {
      if (form.tagName !== 'FORM') { e.preventDefault(); subscribe(input); }
    });
  }

  function subscribe(input) {
    if (!input || !input.value) return;
      API.subscribe(input.value)
        .then(function () {
          input.value = '';
          alert('Thanks for subscribing!');
        })
        .catch(function (err) { alert('Subscription failed: ' + err.message); });
  }

  function wireConsultation() {
    document.querySelectorAll('[data-book-consultation]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fullName = prompt('Your full name:');
        if (!fullName) return;
        var email = prompt('Your email:');
        if (!email) return;
        var phone = prompt('Your phone:');
        if (!phone) return;
        var city = prompt('Your city:', 'Lagos') || 'Lagos';
        API.bookConsultation({ fullName: fullName, email: email, phone: phone, city: city })
          .then(function () { alert('Consultation booked! We will contact you within 24 hours.'); })
          .catch(function (err) { alert('Booking failed: ' + err.message); });
      });
    });
  }

  function init() {
    API.getConfig().then(function (cfg) {
      if (cfg && cfg.currencySymbol) currency = cfg.currencySymbol;
    }).catch(function () {});

    loadProducts();
    loadCategories();
    wireNewsletter();
    wireConsultation();

    // Refresh the cart badge from the server cart, if any.
    if (API.getCartId()) {
      API.getCart(API.getCartId()).then(function (cart) {
        updateCartBadge(cart.itemCount);
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
