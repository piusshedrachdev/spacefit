// JavaScript: Simple Interactivity & Search Quick-Fills
document.addEventListener('DOMContentLoaded', function () {
  // Mobile Drawer Toggle
  var mobileBtn = document.getElementById('mobileMenuBtn');
  var drawer = document.getElementById('mobileDrawer');
  if (mobileBtn && drawer) {
    mobileBtn.addEventListener('click', function () {
      drawer.classList.toggle('hidden');
    });
  }

  // Quick Pill Search Population
  var searchInput = document.getElementById('mainHeroSearch');
  var pills = document.querySelectorAll('.suggestion-pill');

  pills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      var text = pill.innerText.replace('e.g.', '').replace('✦', '').trim();
      if (searchInput) {
        searchInput.value = text;
        searchInput.focus();
      }
    });
  });

  // Quick visual action on search button
  var searchBtn = document.getElementById('searchExecuteBtn');
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', function () {
      if (!searchInput.value.trim()) {
        searchInput.placeholder = 'Please type a piece or budget...';
        searchInput.focus();
      } else {
        // Scroll smoothly down to product listing
        var target = document.getElementById('categories-section');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  // Hero carousel auto-rotation with manual controls
  var slides = Array.from(document.querySelectorAll('.hero-slide'));
  var dots = Array.from(document.querySelectorAll('.hero-dot'));
  var prevBtn = document.getElementById('heroPrevBtn');
  var nextBtn = document.getElementById('heroNextBtn');

  if (slides.length > 0) {
    var currentSlide = 0;
    var autoplayInterval = null;

    function updateCarousel(nextIndex) {
      currentSlide = (nextIndex + slides.length) % slides.length;

      slides.forEach(function (slide, index) {
        var isActive = index === currentSlide;
        slide.classList.toggle('opacity-100', isActive);
        slide.classList.toggle('opacity-0', !isActive);
        slide.classList.toggle('z-10', isActive);
        slide.classList.toggle('z-0', !isActive);
        slide.classList.toggle('pointer-events-none', !isActive);
      });

      dots.forEach(function (dot, index) {
        var isActive = index === currentSlide;
        dot.classList.toggle('bg-[#543A23]', isActive);
        dot.classList.toggle('bg-stone-300', !isActive);
        dot.classList.toggle('w-6', isActive);
        dot.classList.toggle('w-2', !isActive);
      });
    }

    function startAutoplay() {
      clearInterval(autoplayInterval);
      autoplayInterval = setInterval(function () {
        updateCarousel(currentSlide + 1);
      }, 4000);
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        updateCarousel(currentSlide - 1);
        startAutoplay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        updateCarousel(currentSlide + 1);
        startAutoplay();
      });
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var dotIndex = Number(dot.dataset.dotIndex);
        updateCarousel(dotIndex);
        startAutoplay();
      });
    });

    updateCarousel(0);
    startAutoplay();
  }
});