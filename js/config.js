/**
 * Codix Wellness Environment & API Configuration
 * Supports environment-specific WordPress API base configuration,
 * dynamic host detection, and seamless decoupling.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CodixConfig = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function resolveDefaultApiBase() {
    if (typeof window !== 'undefined') {
      // 1. Explicit window-level environment variable override
      if (window.CODIX_API_BASE) {
        return String(window.CODIX_API_BASE).replace(/\/+$/, '');
      }

      if (window.location) {
        var proto = window.location.protocol;
        var host = window.location.host;
        var pathname = window.location.pathname || '';

        // If running inside MAMP or local subdirectory (e.g. /CodixWellness/...)
        if (host.indexOf('localhost') !== -1 || host.indexOf('127.0.0.1') !== -1) {
          var folderMatch = pathname.match(/^(\/[^/]+)/);
          if (folderMatch && folderMatch[1] && folderMatch[1].toLowerCase() === '/codixwellness') {
            return folderMatch[1] + '/wp-json';
          }
          return '/wp-json';
        }

        // If running over HTTP/HTTPS in web server
        if (proto === 'http:' || proto === 'https:') {
          return window.location.origin + '/wp-json';
        }
      }
    }

    return '/wp-json';
  }

  var config = {
    version: '1.2.0',
    apiBase: resolveDefaultApiBase(),
    stripePublishableKey: (typeof window !== 'undefined' && (window.CODIX_STRIPE_KEY || window.STRIPE_PUBLISHABLE_KEY)) || 'pk_live_codix_wellness',
    paystackPublicKey: (typeof window !== 'undefined' && window.CODIX_PAYSTACK_KEY) || 'pk_test_sample_codix_wellness',
    tokenStorageKey: 'codix_jwt_token',
    userStorageKey: 'codix_user',
    cartStorageKey: 'codix_cart',

    /**
     * Dynamically override API base URL at runtime
     */
    setApiBase: function (url) {
      if (!url) return;
      this.apiBase = String(url).replace(/\/+$/, '');
      if (typeof window !== 'undefined') {
        window.CODIX_API_BASE = this.apiBase;
      }
    },

    /**
     * Retrieve resolved API Base URL
     */
    getApiBase: function () {
      if (typeof window !== 'undefined' && window.CODIX_API_BASE) {
        return String(window.CODIX_API_BASE).replace(/\/+$/, '');
      }
      return this.apiBase;
    },

    /**
     * Build full absolute or relative endpoint URL
     */
    endpoint: function (path) {
      var base = this.getApiBase();
      var cleanPath = path.charAt(0) === '/' ? path : '/' + path;
      return base + cleanPath;
    }
  };

  if (typeof window !== 'undefined') {
    window.CodixConfig = config;
  }

  return config;
}));
