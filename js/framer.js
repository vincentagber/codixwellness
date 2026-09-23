/**
 * Framer Motion Animation Engine
 * Provides fluid, spring-eased scroll reveals, micro-interactions,
 * and staggered section transitions across all pages.
 */

(function () {
  'use strict';

  function initFramer() {
    // 1. Identify all main sections and key layout blocks
    const sections = document.querySelectorAll('section, main > div, footer, .framer-section');
    
    sections.forEach((sec) => {
      // Skip sections that opt out, or the top Hero banner which must be immediately visible without flash
      if (
        sec.getAttribute('data-framer') === 'none' ||
        sec.hasAttribute('data-no-framer') ||
        sec.classList.contains('hero-section') ||
        sec.getAttribute('aria-label') === 'Hero Showcase' ||
        sec.querySelector('#hero-carousel-container')
      ) {
        sec.classList.add('framer-in-view');
        return;
      }

      // If section does not have an explicit framer attribute, set fade-up
      if (!sec.hasAttribute('data-framer')) {
        sec.setAttribute('data-framer', 'fade-up');
      }

      // Find children that should animate in with staggered timing
      const staggerItems = sec.querySelectorAll(
        '.product-card, .bento-card, .cat-pill, .feature-card, .review-card, .faq-item, .stat-card, .team-card, .value-card, aside, #shop-grid > *, #category-products-grid > *, #bestselling-products-grid > *'
      );

      staggerItems.forEach((item, iIdx) => {
        if (!item.hasAttribute('data-framer')) {
          item.setAttribute('data-framer', 'fade-up');
          const delay = ((iIdx % 6) + 1) * 80;
          item.setAttribute('data-framer-delay', String(delay));
        }
        item.classList.add('framer-card');
      });

      // Special handling for section headers/titles
      const headers = sec.querySelectorAll('h2, h3, .section-title');
      headers.forEach((h) => {
        if (!h.hasAttribute('data-framer')) {
          h.setAttribute('data-framer', 'fade-up');
          h.setAttribute('data-framer-delay', '50');
        }
      });
    });

    // 2. Observe all elements with [data-framer]
    const elements = document.querySelectorAll('[data-framer]:not([data-framer="none"])');
    
    // Check if an element is already in the viewport on initial load
    function isInViewport(el) {
      const rect = el.getBoundingClientRect();
      return (
        rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
        rect.bottom > 0
      );
    }

    if ('IntersectionObserver' in window) {
      const observerOptions = {
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px'
      };

      const framerObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('framer-in-view');
            // If it has children with data-framer, trigger them as well
            const children = entry.target.querySelectorAll('[data-framer]');
            children.forEach((child) => child.classList.add('framer-in-view'));
            observer.unobserve(entry.target);
          }
        });
      }, observerOptions);

      elements.forEach((el) => {
        // Immediately reveal elements already visible in initial viewport to avoid flicker/flash
        if (isInViewport(el)) {
          el.classList.add('framer-in-view');
          const children = el.querySelectorAll('[data-framer]');
          children.forEach((child) => child.classList.add('framer-in-view'));
        }
        framerObserver.observe(el);
      });
    } else {
      // Immediate reveal fallback
      elements.forEach((el) => el.classList.add('framer-in-view'));
    }
  }

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFramer);
  } else {
    initFramer();
  }

  // Global access for dynamic rerenders
  window.initFramer = initFramer;
})();
