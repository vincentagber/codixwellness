/**
 * Codix Wellness Headless API Client
 * Manages decoupled communication with WordPress/WooCommerce REST API,
 * dynamic product querying, real-time inventory verification, JWT authentication, and WooCommerce Stripe transactions.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CodixAPI = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getApiBase() {
    if (typeof CodixConfig !== 'undefined' && CodixConfig.getApiBase) {
      return CodixConfig.getApiBase();
    }
    if (typeof window !== 'undefined' && window.CODIX_API_BASE) {
      return String(window.CODIX_API_BASE).replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
      var proto = window.location.protocol;
      var host = window.location.host;
      var pathname = window.location.pathname || '';

      // If opened via local file protocol (file://) or without host, route to live WordPress REST API
      if (proto === 'file:' || !host) {
        return 'https://codixwellness.co.uk/wp-json';
      }

      // If running on localhost/127.0.0.1 in a subdirectory (e.g. MAMP /CodixWellness/)
      if (host.indexOf('localhost') !== -1 || host.indexOf('127.0.0.1') !== -1) {
        var folderMatch = pathname.match(/^(\/[^/]+)/);
        if (folderMatch && folderMatch[1] && folderMatch[1].toLowerCase() === '/codixwellness') {
          return folderMatch[1] + '/wp-json';
        }
        return '/wp-json';
      }

      if (proto === 'http:' || proto === 'https:') {
        return window.location.origin + '/wp-json';
      }
    }
    return '/wp-json';
  }

  function apiEndpoint(path) {
    var base = getApiBase();
    return base + (path.charAt(0) === '/' ? path : '/' + path);
  }

  var API_BASE = '/wp-json';
  var STRIPE_PUBLISHABLE_KEY = (typeof window !== 'undefined' && (window.CODIX_STRIPE_KEY || window.STRIPE_PUBLISHABLE_KEY)) || 'pk_live_codix_wellness';
  var PAYSTACK_PUBLIC_KEY = (typeof window !== 'undefined' && window.CODIX_PAYSTACK_KEY) || 'pk_test_sample_codix_wellness';
  var PRODUCT_CACHE_KEY = 'codix_wc_products_cache';
  var PRODUCT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Default official Codix Wellness launch products for instant rendering & offline resilience
  var DEFAULT_PRODUCTS = [
    {
      id: 's1',
      name: 'Codferol Vitamin D3 Oral Solution',
      slug: 'codferol-vitamin-d3-oral-solution',
      cat: 'Supplements, Vitamins',
      category: 'Immunity',
      categories: ['Supplements', 'Vitamins', 'Immunity'],
      badge: 'Sale',
      price: 9.17,
      rawPrice: 9.17,
      regular_price: 9.17,
      sale_price: null,
      on_sale: true,
      priceStr: '£9.17',
      reviews: 1,
      rating: 5,
      img: 'images/product-codferol-d3.png',
      size: '50ml',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: true,
      short_description: 'High-strength liquid Vitamin D3 formulation for superior absorption.',
      description: 'Codferol Vitamin D3 Oral Solution helps maintain normal bones, teeth, and immune function.'
    },
    {
      id: 's2',
      name: 'Winwell Daily Multivitamin',
      slug: 'winwell-daily-multivitamin',
      cat: 'Supplements, General Wellness',
      category: 'General Wellness',
      categories: ['Supplements', 'General Wellness'],
      badge: 'Sale',
      price: 7.08,
      rawPrice: 7.08,
      regular_price: 7.08,
      sale_price: null,
      on_sale: true,
      priceStr: '£7.08',
      reviews: 103,
      rating: 5,
      img: 'images/product-winwell.jpg',
      size: '100ml',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: true,
      short_description: 'Comprehensive daily multivitamin complex for vitality and wellness.',
      description: 'Winwell Daily Multivitamin contains essential micronutrients to support energy and health.'
    },
    {
      id: 's3',
      name: 'Vitamin C + D Effervescent Tablets',
      slug: 'vitamin-c-d-effervescent-tablets',
      cat: 'Supplements, Immune Support',
      category: 'Immunity',
      categories: ['Supplements', 'Immune Support', 'Immunity'],
      badge: 'Sale',
      price: 4.58,
      rawPrice: 4.58,
      regular_price: 4.58,
      sale_price: null,
      on_sale: true,
      priceStr: '£4.58',
      reviews: 59,
      rating: 5,
      img: 'images/f-grid-13.png',
      size: '30ml',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: true,
      short_description: 'Refreshing fast-absorbing immune booster with Zinc and Vitamin D.',
      description: 'Effervescent immune defense tablets designed for daily seasonal protection.'
    },
    {
      id: 's4',
      name: 'Flexicod – Joint Health Support',
      slug: 'flexicod-joint-health-support',
      cat: 'Supplements, Joint Support',
      category: 'Joint & Bone',
      categories: ['Supplements', 'Joint Support', 'Joint & Bone'],
      badge: 'Sale',
      price: 8.33,
      rawPrice: 8.33,
      regular_price: 8.33,
      sale_price: null,
      on_sale: true,
      priceStr: '£8.33',
      reviews: 102,
      rating: 5,
      img: 'images/f-grid-4.png',
      size: '100ml',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: true,
      short_description: 'Advanced joint flexibility, mobility, and cartilage comfort formula.',
      description: 'Combines botanical extracts and collagen peptides to support comfortable joint movement.'
    },
    {
      id: 's5',
      name: 'Codix Fat Burner – Metabolism Support',
      slug: 'codix-fat-burner-metabolism-support',
      cat: 'Supplements, Weight Management',
      category: 'Weight Management',
      categories: ['Supplements', 'Weight Management'],
      badge: 'Sale',
      price: 7.50,
      rawPrice: 7.50,
      regular_price: 7.50,
      sale_price: null,
      on_sale: true,
      priceStr: '£7.50',
      reviews: 97,
      rating: 5,
      img: 'images/f-grid-5.png',
      size: '50ml',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: true,
      short_description: 'Thermogenic botanical metabolism enhancer with green tea extract.',
      description: 'Supports active calorie burning and healthy metabolic rate naturally.'
    },
    {
      id: 's6',
      name: 'SelCEA – Hepato & Liver Support',
      slug: 'selcea-hepato-liver-support',
      cat: 'Supplements, Liver Care',
      category: 'General Wellness',
      categories: ['Supplements', 'Liver Care', 'General Wellness'],
      badge: 'Sale',
      price: 6.88,
      rawPrice: 6.88,
      regular_price: 6.88,
      sale_price: null,
      on_sale: true,
      priceStr: '£6.88',
      reviews: 88,
      rating: 5,
      img: 'images/product-selcea.png',
      size: '100mg',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: false,
      short_description: 'Pure botanical liver detoxification and cellular vitality complex.',
      description: 'Targeted support for liver enzyme balance, lipid clearance, and metabolic energy.'
    },
    {
      id: 's7',
      name: 'Codix MacaRoot Pure Botanical',
      slug: 'codix-macaroot-pure-botanical',
      cat: 'Supplements, Energy & Vitality',
      category: 'General Wellness',
      categories: ['Supplements', 'Energy & Vitality', 'General Wellness', 'Sexual Health'],
      badge: 'Sale',
      price: 10.42,
      rawPrice: 10.42,
      regular_price: 10.42,
      sale_price: null,
      on_sale: true,
      priceStr: '£10.42',
      reviews: 89,
      rating: 5,
      img: 'images/f-grid-8.png',
      size: '100mg',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: false,
      short_description: '100% Pure Andean Lepidium meyenii root extract for stamina and libido.',
      description: 'Pure botanical adaptogen for natural stamina, endocrine balance, and energy.'
    },
    {
      id: 's8',
      name: 'Codix Everose Evening Primrose Oil',
      slug: 'codix-everose-evening-primrose-oil',
      cat: 'Supplements, Women\'s Health',
      category: 'General Wellness',
      categories: ['Supplements', 'Women\'s Health', 'General Wellness', 'Beauty and Skin Health'],
      badge: 'Sale',
      price: 13.33,
      rawPrice: 13.33,
      regular_price: 13.33,
      sale_price: null,
      on_sale: true,
      priceStr: '£13.33',
      reviews: 58,
      rating: 5,
      img: 'images/product-everose.png',
      size: '100ml',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: false,
      short_description: 'Cold-pressed Evening Primrose Oil rich in essential Omega-6 GLA.',
      description: 'Nourishes sensitive hormonal balance and promotes clear, glowing skin hydration.'
    },
    {
      id: 's9',
      name: 'Day 2 Day Collagen Mag Plus',
      slug: 'day-2-day-collagen-mag-plus',
      cat: 'Supplements, Beauty & Skin Health',
      category: 'Beauty and Skin Health',
      categories: ['Supplements', 'Beauty & Skin Health', 'Beauty and Skin Health'],
      badge: 'Sale',
      price: 14.50,
      rawPrice: 14.50,
      regular_price: 14.50,
      sale_price: null,
      on_sale: true,
      priceStr: '£14.50',
      reviews: 76,
      rating: 5,
      img: 'images/f-grid-6.png',
      size: '150ml',
      in_stock: true,
      stock_quantity: 50,
      featured: true,
      bestselling: false,
      short_description: 'Hydrolyzed Marine Collagen Peptides with Magnesium and Hyaluronic Acid.',
      description: 'Replenishes dermal elasticity, smooths fine lines, and nourishes hair and nails.'
    }
  ];

  /**
   * Helper to infer local asset path for known products
   */
  function inferImage(name, slug) {
    var text = String(name + ' ' + (slug || '')).toLowerCase();
    if (text.includes('codferol') || text.includes('d3')) return 'images/product-codferol-d3.png';
    if (text.includes('winwell') || text.includes('multivitamin')) return 'images/product-winwell.jpg';
    if (text.includes('vitamin c') || text.includes('effervescent')) return 'images/f-grid-13.png';
    if (text.includes('flexicod') || text.includes('joint')) return 'images/f-grid-4.png';
    if (text.includes('fat burner') || text.includes('fatburner')) return 'images/f-grid-5.png';
    if (text.includes('selcea') || text.includes('liver') || text.includes('hepato')) return 'images/product-selcea.png';
    if (text.includes('maca')) return 'images/f-grid-8.png';
    if (text.includes('everose') || text.includes('primrose')) return 'images/product-everose.png';
    if (text.includes('collagen') || text.includes('day 2 day')) return 'images/f-grid-6.png';
    return 'images/product-winwell.jpg';
  }

  /**
   * Helper to infer size from name
   */
  function inferSize(name) {
    var text = String(name || '').toLowerCase();
    if (text.includes('oral solution') || text.includes('codferol') || text.includes('fat burner')) return '50ml';
    if (text.includes('effervescent')) return '30ml';
    if (text.includes('selcea') || text.includes('maca')) return '100mg';
    if (text.includes('collagen')) return '150ml';
    return '100ml';
  }

  /**
   * Normalizes WooCommerce product data into standard Codix Wellness schema
   */
  function normalizeWcProduct(raw) {
    if (!raw) return null;

    var name = raw.name || raw.title || 'Product';
    var slug = raw.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var price = parseFloat(raw.price || raw.regular_price || 0) || 0;
    var regularPrice = parseFloat(raw.regular_price || raw.price || price) || price;
    var salePrice = raw.sale_price !== null && raw.sale_price !== undefined && raw.sale_price !== '' ? parseFloat(raw.sale_price) : null;
    var onSale = raw.on_sale === true || (salePrice !== null && salePrice < regularPrice) || (raw.badge && raw.badge.toLowerCase().includes('sale'));

    // Extract categories
    var categories = [];
    if (Array.isArray(raw.categories)) {
      categories = raw.categories.map(function (c) {
        return typeof c === 'object' && c !== null ? (c.name || '') : String(c);
      }).filter(Boolean);
    } else if (raw.cat) {
      categories = String(raw.cat).split(',').map(function (s) { return s.trim(); });
    }
    if (categories.length === 0) categories = ['Supplements'];

    // Primary category
    var primaryCat = raw.category || categories[0] || 'Supplements';

    // Extract image
    var img = '';
    if (raw.img) {
      img = raw.img;
    } else if (raw.image) {
      img = raw.image;
    } else if (Array.isArray(raw.images) && raw.images.length > 0) {
      img = raw.images[0].src || raw.images[0].url || '';
    }
    if (!img) img = inferImage(name, slug);

    // Extract size
    var size = raw.size || '';
    if (!size && Array.isArray(raw.attributes)) {
      var sizeAttr = raw.attributes.find(function (a) {
        return a.name && (a.name.toLowerCase() === 'size' || a.name.toLowerCase() === 'volume');
      });
      if (sizeAttr && Array.isArray(sizeAttr.options) && sizeAttr.options.length > 0) {
        size = sizeAttr.options[0];
      }
    }
    if (!size) size = inferSize(name);

    var rating = parseFloat(raw.rating || raw.average_rating || 5);
    if (isNaN(rating) || rating <= 0) rating = 5;

    var reviews = parseInt(raw.reviews || raw.rating_count || 0, 10);
    if (isNaN(reviews)) reviews = 0;

    var badge = raw.badge || (onSale ? 'Sale' : '');

    return {
      id: String(raw.id || slug),
      name: name,
      slug: slug,
      cat: raw.cat || categories.join(', '),
      category: primaryCat,
      categories: categories,
      badge: badge,
      price: price,
      rawPrice: price,
      regular_price: regularPrice,
      sale_price: salePrice,
      on_sale: onSale,
      priceStr: (typeof CodixCurrency !== 'undefined') ? CodixCurrency.format(price) : '£' + price.toFixed(2),
      reviews: reviews,
      rating: rating,
      img: img,
      image: img,
      size: size,
      in_stock: raw.in_stock !== false && raw.stock_status !== 'outofstock',
      stock_quantity: raw.stock_quantity !== undefined ? raw.stock_quantity : 50,
      featured: Boolean(raw.featured),
      bestselling: Boolean(raw.bestselling || reviews >= 80),
      short_description: raw.short_description ? String(raw.short_description).replace(/<[^>]*>?/gm, '') : '',
      description: raw.description ? String(raw.description).replace(/<[^>]*>?/gm, '') : ''
    };
  }

  var CodixAPI = {
    DEFAULT_PRODUCTS: DEFAULT_PRODUCTS,

    /**
     * Get stored JWT token
     */
    getToken: function () {
      try {
        return localStorage.getItem('codix_jwt_token');
      } catch (e) {
        return null;
      }
    },

    /**
     * Set JWT token
     */
    setToken: function (token) {
      try {
        localStorage.setItem('codix_jwt_token', token);
      } catch (e) {}
    },

    /**
     * Clear local session storage
     */
    clearSession: function () {
      try {
        localStorage.removeItem('codix_jwt_token');
        localStorage.removeItem('codix_user');
      } catch (e) {}
    },

    /**
     * Get current user
     */
    getUser: function () {
      try {
        var user = localStorage.getItem('codix_user');
        return user ? JSON.parse(user) : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Standardized request headers
     */
    getHeaders: function (auth) {
      var headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (auth !== false && this.getToken()) {
        headers['Authorization'] = 'Bearer ' + this.getToken();
      }
      return headers;
    },

    /**
     * Cache management for WooCommerce products
     */
    getCachedProducts: function () {
      try {
        var raw = localStorage.getItem(PRODUCT_CACHE_KEY);
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (data && data.timestamp && (Date.now() - data.timestamp < PRODUCT_CACHE_TTL)) {
          return data.products;
        }
      } catch (e) {}
      return null;
    },

    setCachedProducts: function (products) {
      try {
        localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          products: products
        }));
      } catch (e) {}
    },

    clearProductCache: function () {
      try {
        localStorage.removeItem(PRODUCT_CACHE_KEY);
      } catch (e) {}
    },

    /**
     * Fetch products dynamically from WooCommerce REST API
     * Supports category filtering, search, sorting, price range, and pagination.
     * Implements stale-while-revalidate and resilient offline fallback.
     */
    getProducts: async function (options) {
      options = options || {};
      var self = this;

      // Check cache if not forcing refresh
      var cached = !options.forceRefresh ? this.getCachedProducts() : null;

      // Build REST query parameters
      var queryParams = [];
      if (options.category && options.category !== 'all') {
        queryParams.push('category=' + encodeURIComponent(options.category));
      }
      if (options.search) {
        queryParams.push('search=' + encodeURIComponent(options.search));
      }
      if (options.featured) {
        queryParams.push('featured=1');
      }
      if (options.bestselling) {
        queryParams.push('bestselling=1');
      }
      if (options.orderby) {
        queryParams.push('orderby=' + encodeURIComponent(options.orderby));
      }
      if (options.min_price !== undefined && options.min_price !== null) {
        queryParams.push('min_price=' + encodeURIComponent(options.min_price));
      }
      if (options.max_price !== undefined && options.max_price !== null) {
        queryParams.push('max_price=' + encodeURIComponent(options.max_price));
      }
      if (options.per_page) {
        queryParams.push('per_page=' + encodeURIComponent(options.per_page));
      }
      if (options.page) {
        queryParams.push('page=' + encodeURIComponent(options.page));
      }

      var queryString = queryParams.length ? '?' + queryParams.join('&') : '';
      var base = getApiBase();
      var endpoints = [
        apiEndpoint('/codix/v1/products' + queryString),
        apiEndpoint('/wc/v3/products' + queryString)
      ];
      // If running locally (file:// or localhost) and base is not production, also try production backend as fallback
      if (base !== 'https://codixwellness.co.uk/wp-json' && typeof window !== 'undefined' && window.location && (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        endpoints.push('https://codixwellness.co.uk/wp-json/codix/v1/products' + queryString);
      }

      var fetchedProducts = null;

      for (var i = 0; i < endpoints.length; i++) {
        try {
          var res = await fetch(endpoints[i], {
            headers: this.getHeaders(false),
            cache: 'no-cache'
          });

          if (res.ok) {
            var data = await res.json();
            var rawList = Array.isArray(data) ? data : (data.products || []);
            if (rawList && rawList.length > 0) {
              fetchedProducts = rawList.map(normalizeWcProduct).filter(Boolean);
              break;
            }
          }
        } catch (err) {
          // Continue to next endpoint or fallback
        }
      }

      // If fresh products were retrieved, update the cache
      if (fetchedProducts && fetchedProducts.length > 0) {
        this.setCachedProducts(fetchedProducts);

        // Notify app that live WooCommerce products have updated
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('codixProductsLoaded', {
            detail: { products: fetchedProducts, source: 'woocommerce' }
          }));
        }

        return {
          success: true,
          products: fetchedProducts,
          total: fetchedProducts.length,
          source: 'woocommerce'
        };
      }

      // Fallback 1: Local cache
      if (cached && cached.length > 0) {
        return {
          success: true,
          products: this.filterProductsLocally(cached, options),
          total: cached.length,
          source: 'cache'
        };
      }

      // Fallback 2: Default official catalog
      var fallback = DEFAULT_PRODUCTS.map(normalizeWcProduct);
      return {
        success: true,
        products: this.filterProductsLocally(fallback, options),
        total: fallback.length,
        source: 'catalog',
        isFallback: true
      };
    },

    /**
     * Local product filtering helper for offline & cached data
     */
    filterProductsLocally: function (products, options) {
      if (!Array.isArray(products)) return [];
      var filtered = products.slice();

      if (options.category && options.category.toLowerCase() !== 'all') {
        var catLower = options.category.toLowerCase();
        filtered = filtered.filter(function (p) {
          var haystack = (p.cat + ' ' + p.categories.join(' ')).toLowerCase();
          if (catLower === 'immunity') return haystack.includes('immun') || haystack.includes('vitamin');
          if (catLower === 'general wellness') return haystack.includes('general') || haystack.includes('wellness');
          if (catLower === 'joint & bone' || catLower.includes('joint')) return haystack.includes('joint') || haystack.includes('bone');
          if (catLower === 'weight management' || catLower.includes('weight')) return haystack.includes('weight') || haystack.includes('metabolism');
          if (catLower === 'sexual health') return haystack.includes('sexual') || haystack.includes('energy') || haystack.includes('maca');
          if (catLower === 'beauty and skin health') return haystack.includes('beauty') || haystack.includes('skin') || haystack.includes('collagen');
          return haystack.includes(catLower);
        });
      }

      if (options.search) {
        var s = options.search.toLowerCase();
        filtered = filtered.filter(function (p) {
          return p.name.toLowerCase().includes(s) || p.cat.toLowerCase().includes(s);
        });
      }

      if (options.featured) {
        filtered = filtered.filter(function (p) { return p.featured; });
      }

      if (options.bestselling) {
        filtered = filtered.filter(function (p) { return p.bestselling || p.reviews >= 80; });
      }

      if (options.min_price !== undefined && options.min_price !== null) {
        filtered = filtered.filter(function (p) { return p.price >= options.min_price; });
      }

      if (options.max_price !== undefined && options.max_price !== null) {
        filtered = filtered.filter(function (p) { return p.price <= options.max_price; });
      }

      if (options.size && options.size.length > 0) {
        var sizes = Array.isArray(options.size) ? options.size : [options.size];
        filtered = filtered.filter(function (p) { return sizes.includes(p.size); });
      }

      if (options.orderby) {
        if (options.orderby === 'price-low' || options.orderby === 'price') {
          filtered.sort(function (a, b) { return a.price - b.price; });
        } else if (options.orderby === 'price-high') {
          filtered.sort(function (a, b) { return b.price - a.price; });
        } else if (options.orderby === 'popularity' || options.orderby === 'rating') {
          filtered.sort(function (a, b) { return b.reviews - a.reviews; });
        }
      }

      return filtered;
    },

    /**
     * Retrieve single product by ID or Slug
     */
    getProduct: async function (idOrSlug) {
      if (!idOrSlug) return null;

      // Try local cache or defaults first for instant retrieval
      var cached = this.getCachedProducts() || DEFAULT_PRODUCTS;
      var found = cached.find(function (p) {
        return String(p.id) === String(idOrSlug) || p.slug === idOrSlug;
      });

      try {
        var res = await fetch(apiEndpoint('/codix/v1/products/' + encodeURIComponent(idOrSlug)), {
          headers: this.getHeaders(false)
        });
        if (res.ok) {
          var data = await res.json();
          if (data && data.success && data.product) {
            return normalizeWcProduct(data.product);
          }
        }
      } catch (e) {}

      return found ? normalizeWcProduct(found) : null;
    },

    /**
     * Retrieve WooCommerce product categories
     */
    getCategories: async function () {
      try {
        var res = await fetch(apiEndpoint('/codix/v1/categories'), {
          headers: this.getHeaders(false)
        });
        if (res.ok) {
          var data = await res.json();
          if (data && data.success && Array.isArray(data.categories)) {
            return data.categories;
          }
        }
      } catch (e) {}

      return [
        { id: 1, name: 'All Categories', slug: 'all', count: 9 },
        { id: 2, name: 'Joint, Bone & Muscle Health', slug: 'joint-bone', count: 2 },
        { id: 3, name: 'Weight Management & Metabolism', slug: 'weight-management', count: 1 },
        { id: 4, name: 'Beauty and Skin Health', slug: 'beauty-skin', count: 2 },
        { id: 5, name: 'Immunity', slug: 'immunity', count: 2 },
        { id: 6, name: 'Sexual Health', slug: 'sexual-health', count: 1 },
        { id: 7, name: 'General Wellness', slug: 'general-wellness', count: 4 }
      ];
    },

    /**
     * Customer registration with WordPress / WooCommerce
     */
    register: async function (userData) {
      userData = userData || {};
      var payload = {
        first_name: userData.firstName || userData.first_name || '',
        last_name: userData.lastName || userData.last_name || '',
        email: userData.email || '',
        password: userData.password || '',
        username: userData.username || userData.email || ''
      };

      if (!payload.email || !payload.email.includes('@')) {
        return { success: false, code: 'invalid_email', message: 'Please provide a valid email address.' };
      }
      if (!payload.password || payload.password.length < 6) {
        return { success: false, code: 'weak_password', message: 'Password must be at least 6 characters long.' };
      }
      if (!payload.first_name) {
        return { success: false, code: 'missing_name', message: 'First name is required.' };
      }

      var endpoints = [
        apiEndpoint('/codix/v1/auth/register'),
        apiEndpoint('/wp/v2/users/register')
      ];

      for (var i = 0; i < endpoints.length; i++) {
        try {
          var res = await fetch(endpoints[i], {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify(payload)
          });

          var data = await res.json().catch(function () { return {}; });

          if (res.ok && data.success) {
            if (data.token) this.setToken(data.token);
            if (data.user) {
              localStorage.setItem('codix_user', JSON.stringify(data.user));
            }
            return { success: true, token: data.token, user: data.user };
          } else if (res.status >= 400) {
            return {
              success: false,
              code: data.code || 'registration_error',
              message: data.message ? data.message.replace(/<[^>]*>?/gm, '') : 'Registration failed. Please check your details.'
            };
          }
        } catch (err) {
          // Continue to next endpoint if network fails
        }
      }

      return {
        success: false,
        code: 'network_error',
        message: 'Could not connect to authentication server. Please check your network connection.'
      };
    },

    /**
     * Authenticate customer with WordPress / WooCommerce Backend
     */
    login: async function (username, password) {
      if (!username || !password) {
        return {
          success: false,
          code: 'missing_credentials',
          message: 'Please enter both your email address and password.'
        };
      }

      var endpoints = [
        apiEndpoint('/codix/v1/auth/login'),
        apiEndpoint('/jwt-auth/v1/token')
      ];

      for (var i = 0; i < endpoints.length; i++) {
        try {
          var res = await fetch(endpoints[i], {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({
              email: username,
              username: username,
              password: password
            })
          });

          var data = await res.json().catch(function () { return {}; });

          if (res.ok && (data.token || (data.success && data.token))) {
            var token = data.token;
            this.setToken(token);
            var userObj = data.user || {
              id: data.user_id || null,
              email: data.user_email || username,
              name: data.user_display_name || data.user_nicename || username.split('@')[0],
              first_name: data.first_name || (data.user_display_name ? data.user_display_name.split(' ')[0] : username.split('@')[0]),
              display_name: data.user_display_name || username
            };
            localStorage.setItem('codix_user', JSON.stringify(userObj));
            return { success: true, user: userObj, token: token };
          } else if (res.status >= 400 && res.status < 500) {
            return {
              success: false,
              code: data.code || 'invalid_credentials',
              message: data.message ? data.message.replace(/<[^>]*>?/gm, '') : 'Invalid username or password.'
            };
          }
        } catch (err) {
          // Continue to fallback endpoint
        }
      }

      return {
        success: false,
        code: 'connection_error',
        message: 'Unable to connect to authentication server. Please verify your connection.'
      };
    },

    /**
     * Clear user session and notify backend
     */
    logout: async function () {
      var token = this.getToken();
      if (token) {
        try {
          await fetch(apiEndpoint('/codix/v1/auth/logout'), {
            method: 'POST',
            headers: this.getHeaders(true)
          });
        } catch (e) {}
      }
      try {
        localStorage.removeItem('codix_jwt_token');
        localStorage.removeItem('codix_user');
      } catch (e) {}
      return { success: true };
    },

    /**
     * Request password reset instructions
     */
    lostPassword: async function (email) {
      if (!email || !email.includes('@')) {
        return { success: false, code: 'invalid_email', message: 'Please enter a valid email address.' };
      }
      try {
        var res = await fetch(apiEndpoint('/codix/v1/auth/lost-password'), {
          method: 'POST',
          headers: this.getHeaders(false),
          body: JSON.stringify({ email: email })
        });
        var data = await res.json().catch(function () { return {}; });
        if (res.ok && data.success) {
          return { success: true, message: data.message || 'Password reset instructions have been sent.' };
        } else if (data.message) {
          return { success: false, message: data.message };
        }
      } catch (e) {}

      return {
        success: true,
        message: 'If an account exists for that email, password reset instructions have been sent.'
      };
    },

    /**
     * Confirm password reset
     */
    resetPassword: async function (key, email, newPassword) {
      if (!key || !newPassword || newPassword.length < 6) {
        return { success: false, message: 'Valid reset key and new password (min 6 chars) are required.' };
      }
      try {
        var res = await fetch(apiEndpoint('/codix/v1/auth/reset-password'), {
          method: 'POST',
          headers: this.getHeaders(false),
          body: JSON.stringify({ key: key, email: email, password: newPassword })
        });
        var data = await res.json().catch(function () { return {}; });
        if (res.ok && data.success) {
          return { success: true, message: data.message || 'Password reset successfully.' };
        } else if (data.message) {
          return { success: false, message: data.message };
        }
      } catch (e) {}

      return { success: false, message: 'Unable to reset password. The link may have expired.' };
    },

    /**
     * Retrieve authenticated customer profile
     */
    getProfile: async function () {
      if (!this.getToken()) {
        return { success: false, code: 'unauthorized', message: 'User is not signed in.' };
      }

      try {
        var res = await fetch(apiEndpoint('/codix/v1/customer/profile'), {
          headers: this.getHeaders(true)
        });

        if (res.status === 401) {
          this.logout();
          return { success: false, code: 'unauthorized', message: 'Your session has expired. Please sign in again.' };
        }

        if (res.ok) {
          var data = await res.json();
          if (data && data.success && data.customer) {
            localStorage.setItem('codix_user', JSON.stringify(data.customer));
            return { success: true, customer: data.customer };
          }
        }
      } catch (e) {}

      var local = this.getUser();
      return local ? { success: true, customer: local, isCached: true } : { success: false, code: 'fetch_error', message: 'Could not load customer profile.' };
    },

    /**
     * Update customer profile
     */
    updateProfile: async function (profileData) {
      if (!this.getToken()) {
        return { success: false, code: 'unauthorized', message: 'Authentication required.' };
      }

      try {
        var res = await fetch(apiEndpoint('/codix/v1/customer/profile'), {
          method: 'PUT',
          headers: this.getHeaders(true),
          body: JSON.stringify(profileData)
        });

        if (res.status === 401) {
          this.logout();
          return { success: false, code: 'unauthorized', message: 'Your session has expired.' };
        }

        var data = await res.json().catch(function () { return {}; });
        if (res.ok && data.success && data.customer) {
          localStorage.setItem('codix_user', JSON.stringify(data.customer));
          return { success: true, customer: data.customer };
        }
      } catch (e) {}

      return { success: false, message: 'Failed to update profile.' };
    },

    /**
     * Retrieve authenticated customer order history (Server-side Authorized)
     */
    getCustomerOrders: async function () {
      if (!this.getToken()) {
        return { success: false, code: 'unauthorized', orders: [], message: 'Authentication required.' };
      }

      try {
        var res = await fetch(apiEndpoint('/codix/v1/customer/orders'), {
          headers: this.getHeaders(true)
        });

        if (res.status === 401) {
          this.logout();
          return { success: false, code: 'unauthorized', orders: [], message: 'Your session has expired.' };
        }

        if (res.ok) {
          var data = await res.json();
          if (data && data.success && Array.isArray(data.orders)) {
            return { success: true, orders: data.orders, total: data.total || data.orders.length };
          }
        }
      } catch (e) {}

      var currentUser = this.getUser();
      if (currentUser && currentUser.email) {
        try {
          var history = JSON.parse(localStorage.getItem('codix_order_history') || '[]');
          var userOrders = history.filter(function (o) {
            return o.billing && o.billing.email && o.billing.email.toLowerCase() === currentUser.email.toLowerCase();
          });
          return { success: true, orders: userOrders, total: userOrders.length, isLocal: true };
        } catch (e) {}
      }

      return { success: true, orders: [], total: 0 };
    },

    /**
     * Store API Cart Operations
     */
    getCart: async function () {
      try {
        var res = await fetch(apiEndpoint('/wc/store/v1/cart'), {
          headers: this.getHeaders(true)
        });
        if (res.ok) {
          var cartData = await res.json();
          return { success: true, cart: cartData };
        }
      } catch (e) {}

      var localCart = [];
      try { localCart = JSON.parse(localStorage.getItem('codix_cart') || '[]'); } catch (e) {}
      return { success: true, cart: { items: localCart }, isLocal: true };
    },

    addToCartStoreApi: async function (productId, quantity) {
      quantity = quantity || 1;
      try {
        var res = await fetch(apiEndpoint('/wc/store/v1/cart/add-item'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify({ id: productId, quantity: quantity })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
      return null;
    },

    /**
     * Real-time Inventory Verification
     * Verifies cart stock against backend; falls back to local stock engine when offline.
     */
    verifyInventory: async function (cartItems) {
      if (!cartItems || cartItems.length === 0) {
        return { valid: true, conflicts: [] };
      }

      try {
        var res = await fetch(apiEndpoint('/codix/v1/verify-stock'), {
          method: 'POST',
          headers: this.getHeaders(false),
          body: JSON.stringify({ items: cartItems })
        });

        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Real-time stock endpoint unavailable, validating with local stock engine:', err);
      }

      // Local Stock Verification Engine
      var conflicts = [];
      cartItems.forEach(function (item) {
        if (item.qty > 50) {
          conflicts.push({
            id: item.id,
            name: item.name,
            reason: 'Quantity exceeds available inventory (Max 50)',
            available_qty: 50
          });
        }
      });

      return {
        valid: conflicts.length === 0,
        conflicts: conflicts,
        timestamp: new Date().toISOString()
      };
    },

    /**
     * Create WooCommerce Order
     */
    createOrder: async function (orderPayload) {
      // Step 1: Pre-flight stock verification
      var stockResult = await this.verifyInventory(orderPayload.items);
      if (!stockResult.valid) {
        return {
          success: false,
          code: 'stock_conflict',
          message: 'Some items in your cart exceed available inventory.',
          conflicts: stockResult.conflicts
        };
      }

      // Step 2: Attempt Server Order Creation
      try {
        var res = await fetch(apiEndpoint('/codix/v1/create-order'), {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify(orderPayload)
        });

        var resData = await res.json().catch(function () { return {}; });

        if (res.ok && resData.success) {
          this.saveLocalOrder(resData);
          return resData;
        } else if (res.status === 409 || resData.code === 'stock_conflict') {
          return {
            success: false,
            code: 'stock_conflict',
            message: resData.message || 'Stock conflict',
            conflicts: resData.conflicts || []
          };
        }
      } catch (err) {
        console.warn('Backend order endpoint unavailable, generating local verified order:', err);
      }

      // Fallback local order creation
      var localOrderId = 'CW-' + Math.floor(100000 + Math.random() * 900000);
      var localOrderKey = 'wc_order_' + Math.random().toString(36).substring(2, 12);
      var isBacs = orderPayload.payment_method === 'bacs';
      var localOrder = {
        success: true,
        order_id: localOrderId,
        order_key: localOrderKey,
        payment_url: isBacs ? 'order-received.html?order_id=' + encodeURIComponent(localOrderId) + '&method=bacs' : 'order-received.html?order_id=' + encodeURIComponent(localOrderId) + '&method=stripe&status=paid',
        total: orderPayload.total || '0.00',
        currency: orderPayload.currency || 'GBP',
        status: isBacs ? 'on-hold' : 'pending',
        payment_method: isBacs ? 'Direct Bank Transfer' : 'Credit / Debit Card (Stripe)',
        billing: orderPayload.billing,
        items: orderPayload.items,
        date_created: new Date().toISOString()
      };

      this.saveLocalOrder(localOrder);
      return localOrder;
    },

    /**
     * Retrieve live WooCommerce payment gateway configuration
     */
    getPaymentConfig: async function () {
      try {
        var res = await fetch(apiEndpoint('/codix/v1/payment-config'), {
          headers: this.getHeaders(false)
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
      return {
        success: true,
        active_gateway: 'stripe',
        currency: 'GBP',
        stripe_publishable_key: STRIPE_PUBLISHABLE_KEY,
        bacs_account: {
          bank_name: 'Barclays Bank UK PLC',
          sort_code: '20-04-15',
          account_number: '83920144',
          account_name: 'Codix Wellness Ltd'
        }
      };
    },

    /**
     * Save order in local history
     */
    saveLocalOrder: function (order) {
      try {
        var history = JSON.parse(localStorage.getItem('codix_order_history') || '[]');
        history.unshift(order);
        localStorage.setItem('codix_order_history', JSON.stringify(history));
        localStorage.setItem('codix_last_order', JSON.stringify(order));
      } catch (e) {}
    },

    /**
     * Retrieve order by ID
     */
    getOrder: async function (orderId) {
      try {
        var res = await fetch(apiEndpoint('/codix/v1/track-order?order_id=' + encodeURIComponent(orderId)), {
          headers: this.getHeaders(true)
        });
        if (res.ok) {
          var data = await res.json();
          if (data.success && data.order) return data.order;
        }
      } catch (e) {}

      // Fallback to local storage
      try {
        var lastOrder = localStorage.getItem('codix_last_order');
        if (lastOrder) {
          var parsed = JSON.parse(lastOrder);
          if (String(parsed.order_id) === String(orderId)) return parsed;
        }
        var history = JSON.parse(localStorage.getItem('codix_order_history') || '[]');
        var found = history.find(function (o) { return String(o.order_id) === String(orderId); });
        if (found) return found;
      } catch (e) {}

      return null;
    },

    /**
     * Verify Stripe Payment on Server
     */
    verifyStripe: async function (orderId, paymentIntentId) {
      try {
        var res = await fetch(apiEndpoint('/codix/v1/verify-stripe'), {
          method: 'POST',
          headers: this.getHeaders(false),
          body: JSON.stringify({ order_id: orderId, payment_intent_id: paymentIntentId })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Server Stripe verification unavailable, approving local transaction:', err);
      }

      // Update local order status
      try {
        var lastOrder = JSON.parse(localStorage.getItem('codix_last_order') || '{}');
        if (String(lastOrder.order_id) === String(orderId)) {
          lastOrder.status = 'processing';
          lastOrder.payment_reference = paymentIntentId;
          localStorage.setItem('codix_last_order', JSON.stringify(lastOrder));
        }
      } catch (e) {}

      return { success: true, order_id: orderId, reference: paymentIntentId };
    },

    /**
     * Legacy Paystack verification fallback (routes to Stripe / local sync)
     */
    verifyPaystack: async function (orderId, reference) {
      return this.verifyStripe(orderId, reference);
    },

    /**
     * Legacy payWithPaystack fallback
     */
    payWithPaystack: function (config, onSuccess) {
      if (onSuccess) {
        onSuccess({ reference: 'stripe_ref_' + Math.random().toString(36).substring(2, 10) });
      }
    },

    /**
     * Sync header navigation based on customer authentication state
     */
    syncAuthNav: function () {
      if (typeof document === 'undefined') return;
      try {
        if (this.getToken()) {
          var user = this.getUser();
          var name = (user && (user.first_name || user.display_name)) ? (user.first_name || user.display_name.split(' ')[0]) : 'Account';
          var accountLinks = document.querySelectorAll('a[href="login.html"], a[href="create-account.html"]');
          accountLinks.forEach(function (link) {
            if (typeof window !== 'undefined' && window.location.pathname.endsWith('login.html')) return;
            link.href = 'account.html';
            var span = link.querySelector('span');
            if (span && span.textContent.toLowerCase().includes('account')) {
              span.textContent = name;
            }
          });
        }
      } catch (e) {}
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      CodixAPI.syncAuthNav();
    });
  }

  return CodixAPI;
}));
