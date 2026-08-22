/**
 * Codix Wellness — Main JavaScript
 * Handles all interactive features: sliders, modals, cart, search, etc.
 */

document.addEventListener("DOMContentLoaded", () => {
  // =============================================
  // 1. HERO SLIDER
  // =============================================
  let heroIndex = 0;
  const heroSlides = document.querySelectorAll(".hero-slide");
  const heroDots = document.querySelectorAll(".hero-dot");

  function showHeroSlide(index) {
    heroSlides.forEach((s, i) => {
      s.classList.toggle("active", i === index);
    });
    if (heroDots.length) {
      heroDots.forEach((d, i) => d.classList.toggle("bg-white", i === index));
      heroDots.forEach((d, i) => {
        if (i !== index) d.classList.add("bg-white/50");
        else d.classList.remove("bg-white/50");
      });
    }
  }

  function nextHero() {
    heroIndex = (heroIndex + 1) % heroSlides.length;
    showHeroSlide(heroIndex);
  }
  function prevHero() {
    heroIndex = (heroIndex - 1 + heroSlides.length) % heroSlides.length;
    showHeroSlide(heroIndex);
  }

  const heroNext = document.getElementById("hero-next");
  const heroPrev = document.getElementById("hero-prev");
  if (heroNext) heroNext.addEventListener("click", nextHero);
  if (heroPrev) heroPrev.addEventListener("click", prevHero);

  // Auto-advance hero every 5s
  let heroInterval = setInterval(nextHero, 5000);
  const heroSection = document.querySelector(".hero-slider");
  if (heroSection) {
    heroSection.addEventListener("mouseenter", () => clearInterval(heroInterval));
    heroSection.addEventListener("mouseleave", () => {
      heroInterval = setInterval(nextHero, 5000);
    });
  }

  // =============================================
  // 2. CATEGORY TABS (Popular Categories)
  // =============================================
  const catTabs = document.querySelectorAll(".cat-tab");
  const catGrid = document.getElementById("category-products");

  function renderCategoryProducts(category) {
    if (!catGrid) return;
    const filtered = PRODUCTS.all.filter((p) => p.category === category);
    catGrid.innerHTML = filtered.map((p) => createProductCard(p)).join("");
  }

  catTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      catTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      renderCategoryProducts(tab.dataset.category);
    });
  });

  // =============================================
  // 3. BEST SELLING CATEGORY TABS
  // =============================================
  const bsTabs = document.querySelectorAll(".bs-tab");
  const bsGrid = document.getElementById("bestselling-products");

  function renderBestSellingProducts(category) {
    if (!bsGrid) return;
    const filtered =
      category === "All"
        ? PRODUCTS.bestSelling
        : PRODUCTS.bestSelling.filter((p) => p.category === category);
    bsGrid.innerHTML = filtered.map((p) => createProductCard(p)).join("");
  }

  bsTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      bsTabs.forEach((t) => {
        t.classList.remove("active");
        t.classList.remove("bg-slate-900", "text-white");
        t.classList.add("bg-slate-100", "text-slate-700");
      });
      tab.classList.add("active");
      tab.classList.remove("bg-slate-100", "text-slate-700");
      tab.classList.add("bg-slate-900", "text-white");
      renderBestSellingProducts(tab.dataset.category);
    });
  });

  // =============================================
  // 4. PRODUCT CARD GENERATOR
  // =============================================
  function createProductCard(product) {
    const stars = Array.from(
      { length: 5 },
      (_, i) =>
        `<i class="fas fa-star ${i < product.rating ? "star-filled" : "star-empty"} text-xs"></i>`
    ).join("");

    const badgeClass = product.label === "Sale" ? "badge-sale" : "badge-new";

    return `
      <article class="product-card bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer group">
        <div class="relative bg-[#f6f5fa] h-[220px] flex items-center justify-center overflow-hidden">
          <span class="absolute left-3 top-3 ${badgeClass} px-2.5 py-0.5 text-xs font-bold rounded-full z-10">${product.label}</span>
          <img src="${product.image}" alt="${product.name}" class="product-img h-[160px] w-auto object-contain" loading="lazy">
        </div>
        <div class="p-4">
          <p class="text-xs text-[#514aa4] font-medium">${product.category || ""}</p>
          <h3 class="mt-1 text-sm font-semibold text-[#211c68] leading-5 min-h-[40px]">${product.name}</h3>
          <div class="mt-2 flex items-center gap-0.5">
            ${stars}
            <span class="ml-1.5 text-xs text-[#514aa4]">(${product.reviews})</span>
          </div>
          <p class="mt-2 text-sm font-bold text-[#211c68]">${product.price}</p>
          <button onclick="addToCart('${product.id}', '${product.name.replace(/'/g, "\\'")}', 18)" class="mt-3 w-full flex items-center justify-center gap-2 rounded-full bg-[#edf7ee] text-[#211c68] text-sm font-semibold py-2.5 hover:bg-[#dff1e1] transition">
            <i class="fas fa-shopping-cart text-xs"></i> Select options
          </button>
        </div>
      </article>
    `;
  }

  // =============================================
  // 5. SHOPPING CART
  // =============================================
  let cart = [{ id: "p1", name: "Codix Vitamin C+D Boost", price: 18.0, quantity: 1 }];

  function updateCartUI() {
    const cartCount = document.querySelectorAll(".cart-count");
    const cartTotal = document.querySelectorAll(".cart-total");
    const cartItems = document.getElementById("cart-items");
    const cartSubtotal = document.getElementById("cart-subtotal");
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    cartCount.forEach((el) => {
      el.textContent = totalQty;
      el.style.display = totalQty > 0 ? "flex" : "none";
    });
    cartTotal.forEach((el) => (el.textContent = `$${totalPrice.toFixed(2)}`));
    if (cartSubtotal) cartSubtotal.textContent = `$${totalPrice.toFixed(2)}`;

    if (cartItems) {
      if (cart.length === 0) {
        cartItems.innerHTML = `
          <div class="py-12 text-center text-slate-400">
            <i class="fas fa-shopping-bag text-4xl text-slate-300 mb-3"></i>
            <p class="text-sm">Your shopping cart is empty.</p>
          </div>`;
      } else {
        cartItems.innerHTML = cart
          .map(
            (item) => `
          <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <h4 class="text-sm font-semibold text-slate-800">${item.name}</h4>
              <p class="text-xs text-[#45B853] font-bold">$${item.price.toFixed(2)}</p>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex items-center bg-white rounded-lg border border-slate-200">
                <button onclick="updateQty('${item.id}', -1)" class="p-1.5 text-slate-500 hover:text-slate-800"><i class="fas fa-minus text-xs"></i></button>
                <span class="px-2 text-xs font-bold text-slate-700">${item.quantity}</span>
                <button onclick="updateQty('${item.id}', 1)" class="p-1.5 text-slate-500 hover:text-slate-800"><i class="fas fa-plus text-xs"></i></button>
              </div>
              <button onclick="removeFromCart('${item.id}')" class="text-slate-400 hover:text-red-500 transition p-1">
                <i class="fas fa-trash-alt text-sm"></i>
              </button>
            </div>
          </div>
        `
          )
          .join("");
      }
    }
  }

  window.addToCart = function (id, name, price) {
    const existing = cart.find((item) => item.id === id);
    if (existing) {
      existing.quantity++;
    } else {
      cart.push({ id, name, price, quantity: 1 });
    }
    updateCartUI();
    openCart();
  };

  window.updateQty = function (id, delta) {
    const item = cart.find((i) => i.id === id);
    if (item) {
      item.quantity += delta;
      if (item.quantity <= 0) cart = cart.filter((i) => i.id !== id);
    }
    updateCartUI();
  };

  window.removeFromCart = function (id) {
    cart = cart.filter((i) => i.id !== id);
    updateCartUI();
  };

  // =============================================
  // 6. CART DRAWER
  // =============================================
  const cartOverlay = document.getElementById("cart-overlay");

  function openCart() {
    if (cartOverlay) cartOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    if (cartOverlay) cartOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  window.openCart = openCart;
  window.closeCart = closeCart;

  document
    .querySelectorAll(".cart-trigger")
    .forEach((el) => el.addEventListener("click", openCart));
  if (cartOverlay) {
    cartOverlay.addEventListener("click", (e) => {
      if (e.target === cartOverlay) closeCart();
    });
  }

  // =============================================
  // 7. WISHLIST MODAL
  // =============================================
  let wishlist = ["Your Gummie Fish Oil", "Codix Everose"];
  const wishlistOverlay = document.getElementById("wishlist-overlay");

  function openWishlist() {
    updateWishlistUI();
    if (wishlistOverlay) wishlistOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeWishlist() {
    if (wishlistOverlay) wishlistOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  function updateWishlistUI() {
    const wishlistItems = document.getElementById("wishlist-items");
    const wishlistCount = document.querySelectorAll(".wishlist-count");
    wishlistCount.forEach((el) => {
      el.textContent = wishlist.length;
      el.style.display = wishlist.length > 0 ? "flex" : "none";
    });

    if (wishlistItems) {
      if (wishlist.length === 0) {
        wishlistItems.innerHTML =
          '<p class="text-sm text-slate-400 text-center py-6">Your wishlist is empty.</p>';
      } else {
        wishlistItems.innerHTML = wishlist
          .map(
            (item, i) => `
          <div class="flex items-center justify-between p-3 rounded-xl bg-red-50/50 border border-red-100 text-sm">
            <span class="font-medium text-slate-800">${item}</span>
            <button onclick="removeWishlistItem(${i})" class="text-red-400 hover:text-red-600 text-xs font-semibold">Remove</button>
          </div>
        `
          )
          .join("");
      }
    }
  }

  window.removeWishlistItem = function (index) {
    wishlist.splice(index, 1);
    updateWishlistUI();
  };

  window.openWishlist = openWishlist;
  window.closeWishlist = closeWishlist;

  document
    .querySelectorAll(".wishlist-trigger")
    .forEach((el) => el.addEventListener("click", openWishlist));

  // =============================================
  // 8. ACCOUNT MODAL
  // =============================================
  const accountOverlay = document.getElementById("account-overlay");

  function openAccount() {
    if (accountOverlay) accountOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeAccount() {
    if (accountOverlay) accountOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  window.openAccount = openAccount;
  window.closeAccount = closeAccount;

  document
    .querySelectorAll(".account-trigger")
    .forEach((el) => el.addEventListener("click", openAccount));

  const signInForm = document.getElementById("signin-form");
  if (signInForm) {
    signInForm.addEventListener("submit", (e) => {
      e.preventDefault();
      closeAccount();
      alert("Signed in successfully!");
    });
  }

  // =============================================
  // 9. SEARCH FUNCTIONALITY
  // =============================================
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const searchClear = document.getElementById("search-clear");
  const searchForm = document.getElementById("search-form");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLowerCase();
      if (query.length > 0) {
        const filtered = SAMPLE_SEARCH_PRODUCTS.filter((p) => p.toLowerCase().includes(query));
        if (filtered.length > 0 && searchResults) {
          searchResults.innerHTML = `
            <div class="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Suggested Products</div>
            ${filtered
              .map(
                (item) => `
              <button onclick="selectSearchResult('${item}')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50/70 text-slate-700 flex items-center justify-between group transition">
                <span class="group-hover:text-[#45B853] font-medium">${item}</span>
                <i class="fas fa-arrow-right text-xs text-slate-300 group-hover:text-[#45B853]"></i>
              </button>
            `
              )
              .join("")}
          `;
          searchResults.classList.add("open");
        } else if (searchResults) {
          searchResults.classList.remove("open");
        }
        if (searchClear) searchClear.style.display = "block";
      } else {
        if (searchResults) searchResults.classList.remove("open");
        if (searchClear) searchClear.style.display = "none";
      }
    });

    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim().length > 0) {
        searchInput.dispatchEvent(new Event("input"));
      }
    });
  }

  window.selectSearchResult = function (item) {
    if (searchInput) searchInput.value = item;
    if (searchResults) searchResults.classList.remove("open");
  };

  if (searchClear) {
    searchClear.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (searchResults) searchResults.classList.remove("open");
      searchClear.style.display = "none";
    });
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (searchResults) searchResults.classList.remove("open");
    });
  }

  // Close search on outside click
  document.addEventListener("click", (e) => {
    const searchWrapper = document.getElementById("search-wrapper");
    if (searchWrapper && !searchWrapper.contains(e.target) && searchResults) {
      searchResults.classList.remove("open");
    }
  });

  // =============================================
  // 10. TESTIMONIAL CAROUSEL
  // =============================================
  let testimonialIndex = 0;
  const testimonialCards = document.querySelectorAll(".testimonial-card");

  function showTestimonial(index) {
    testimonialCards.forEach((card, i) => {
      card.style.opacity = i === index ? "1" : "0.35";
      card.style.transform = i === index ? "scale(1)" : "scale(0.95)";
    });
  }

  const testPrev = document.getElementById("testimonial-prev");
  const testNext = document.getElementById("testimonial-next");
  if (testPrev)
    testPrev.addEventListener("click", () => {
      testimonialIndex = (testimonialIndex - 1 + testimonialCards.length) % testimonialCards.length;
      showTestimonial(testimonialIndex);
    });
  if (testNext)
    testNext.addEventListener("click", () => {
      testimonialIndex = (testimonialIndex + 1) % testimonialCards.length;
      showTestimonial(testimonialIndex);
    });

  if (testimonialCards.length) showTestimonial(0);

  // =============================================
  // 11. LANGUAGE & CURRENCY DROPDOWNS
  // =============================================
  const langBtn = document.getElementById("lang-btn");
  const langMenu = document.getElementById("lang-menu");
  const currBtn = document.getElementById("curr-btn");
  const currMenu = document.getElementById("curr-menu");

  function closeAllDropdowns() {
    document.querySelectorAll(".dropdown-menu").forEach((m) => m.classList.remove("open"));
  }

  if (langBtn && langMenu) {
    langBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = langMenu.classList.contains("open");
      closeAllDropdowns();
      if (!isOpen) langMenu.classList.add("open");
    });
  }
  if (currBtn && currMenu) {
    currBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = currMenu.classList.contains("open");
      closeAllDropdowns();
      if (!isOpen) currMenu.classList.add("open");
    });
  }

  document.querySelectorAll(".lang-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.getElementById("lang-text").textContent = opt.dataset.value;
      closeAllDropdowns();
    });
  });
  document.querySelectorAll(".curr-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.getElementById("curr-text").textContent = opt.dataset.value;
      closeAllDropdowns();
    });
  });

  document.addEventListener("click", closeAllDropdowns);

  // =============================================
  // 11b. MEGA MENU
  // =============================================
  const megaBtn = document.getElementById("mega-menu-btn");
  const megaMenu = document.getElementById("mega-menu");
  if (megaBtn && megaMenu) {
    megaBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = megaMenu.classList.contains("open");
      document.querySelectorAll(".mega-menu").forEach((m) => m.classList.remove("open"));
      if (!isOpen) {
        megaMenu.classList.add("open");
        megaBtn.setAttribute("aria-expanded", "true");
      } else {
        megaBtn.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("click", (e) => {
      if (!megaBtn.contains(e.target) && !megaMenu.contains(e.target)) {
        megaMenu.classList.remove("open");
        megaBtn.setAttribute("aria-expanded", "false");
      }
    });
    megaMenu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        megaMenu.classList.remove("open");
        megaBtn.setAttribute("aria-expanded", "false");
      })
    );
  }

  // =============================================
  // 12. MOBILE MENU
  // =============================================
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileMenuOverlay = document.getElementById("mobile-menu-overlay");
  const mobileMenuClose = document.getElementById("mobile-menu-close");

  function openMobileMenu() {
    if (mobileMenu) mobileMenu.classList.add("open");
    if (mobileMenuOverlay) mobileMenuOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeMobileMenu() {
    if (mobileMenu) mobileMenu.classList.remove("open");
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileMenu);
  if (mobileMenuClose) mobileMenuClose.addEventListener("click", closeMobileMenu);
  if (mobileMenuOverlay) mobileMenuOverlay.addEventListener("click", closeMobileMenu);

  // =============================================
  // 13. NEWSLETTER FORM
  // =============================================
  const newsletterForm = document.getElementById("newsletter-form");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('input[type="email"]');
      if (email && email.value) {
        alert("Thank you for subscribing!");
        email.value = "";
      }
    });
  }

  // =============================================
  // 14. SMOOTH SCROLL FOR NAV LINKS
  // =============================================
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          closeMobileMenu();
        }
      }
    });
  });

  // =============================================
  // 15. INIT
  // =============================================
  updateCartUI();
  updateWishlistUI();
  if (heroSlides.length) showHeroSlide(0);
  renderCategoryProducts("Supplements");
});
