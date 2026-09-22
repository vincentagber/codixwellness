/**
 * Codix Wellness — Global Currency Engine
 * Locked to GBP (£) for the UK site.
 */
const CodixCurrency = {
  RATES: {
    '£ GBP': { code: 'GBP', symbol: '£', rate: 1.00, label: '£ GBP' }
  },

  DEFAULT: '£ GBP',

  getCurrent() {
    return this.RATES[this.DEFAULT];
  },

  format(amountInGBP, decimals = 2) {
    const num = Number(amountInGBP) || 0;
    return '£' + num.toFixed(decimals);
  },

  convert(amountInGBP) {
    const num = Number(amountInGBP) || 0;
    return +(num).toFixed(2);
  },

  setCurrency(/* ignored */) {
    // GBP is the only supported currency — no-op.
    localStorage.setItem('codix_currency', this.DEFAULT);
    this.updateUI();
  },

  updateUI() {
    const curr = this.getCurrent();

    // Update all currency labels in headers across all pages
    document.querySelectorAll('#curr-label, #curr-text, .current-currency-label').forEach(el => {
      el.textContent = curr.label;
    });

    // Update all elements with data-price-gbp attribute
    document.querySelectorAll('[data-price-gbp]').forEach(el => {
      const gbpPrice = parseFloat(el.getAttribute('data-price-gbp'));
      if (!isNaN(gbpPrice)) {
        el.textContent = this.format(gbpPrice);
      }
    });

    // Update all elements with data-price-range-gbp (min,max)
    document.querySelectorAll('[data-price-range-gbp]').forEach(el => {
      const parts = el.getAttribute('data-price-range-gbp').split(',').map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        el.textContent = this.format(parts[0]) + ' – ' + this.format(parts[1]);
      }
    });
  },

  init() {
    // Force GBP — clear any stale multi-currency preference
    localStorage.setItem('codix_currency', this.DEFAULT);
    this.updateUI();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CodixCurrency.init());
} else {
  CodixCurrency.init();
}
