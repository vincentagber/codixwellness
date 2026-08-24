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
    
    sections.forEach((sec, sIdx) => {
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
          item.setAttribute('data-framer-delay', );
        }
        item.classList.add('framer-card');
      });

      // Special handling for section headers/titles
      const headers = sec.querySelectorAll('h2, h3, .section-title');
      headers.forEach((h, hIdx) => {
        if (!h.hasAttribute('data-framer')) {
          h.setAttribute('data-framer', 'fade-up');
          h.setAttribute('data-framer-delay', '50');
        }
      });
    });

    // 2. Observe all elements with [data-framer]
    const elements = document.querySelectorAll('[data-framer]');
    
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
          }
        });
      }, observerOptions);

      elements.forEach((el) => {
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
