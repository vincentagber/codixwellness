/**
 * Codix Wellness — Global Currency Engine
 * Default: GBP (£)
 * Supported: GBP (£), USD ($), EUR (€)
 */
const CodixCurrency = {
  RATES: {
    '£ GBP': { code: 'GBP', symbol: '£', rate: 1.00, label: '£ GBP' },
    '$ USD': { code: 'USD', symbol: '$', rate: 1.28, label: '$ USD' },
    '€ EUR': { code: 'EUR', symbol: '€', rate: 1.17, label: '€ EUR' }
  },

  DEFAULT: '£ GBP',

  getCurrent() {
    const saved = localStorage.getItem('codix_currency');
    return this.RATES[saved] || this.RATES[this.DEFAULT];
  },

  format(amountInGBP, decimals = 2) {
    const curr = this.getCurrent();
    const num = Number(amountInGBP) || 0;
    const converted = num * curr.rate;
    return curr.symbol + converted.toFixed(decimals);
  },

  convert(amountInGBP) {
    const curr = this.getCurrent();
    const num = Number(amountInGBP) || 0;
    return +(num * curr.rate).toFixed(2);
  },

  setCurrency(currVal) {
    let matched = this.RATES[currVal];
    if (!matched) {
      if (currVal.includes('USD') || currVal.includes('$')) matched = this.RATES['$ USD'];
      else if (currVal.includes('EUR') || currVal.includes('€')) matched = this.RATES['€ EUR'];
      else matched = this.RATES['£ GBP'];
    }

    localStorage.setItem('codix_currency', matched.label);
    this.updateUI();
    window.dispatchEvent(new CustomEvent('codixCurrencyChanged', { detail: matched }));
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
    if (!localStorage.getItem('codix_currency')) {
      localStorage.setItem('codix_currency', this.DEFAULT);
    }

    this.updateUI();

    // Attach click listeners to all currency options
    document.querySelectorAll('.curr-opt, .curr-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        const val = opt.dataset.val || opt.dataset.value || opt.textContent.trim();
        this.setCurrency(val);
      });
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CodixCurrency.init());
} else {
  CodixCurrency.init();
}
