/**
 * Automated Test Suite for Codix Wellness WooCommerce Dynamic Products
 * Tests PHP Bridge Gateway, CodixAPI client, and DOM structures.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ----------------------------------------------------
// 1. PHP Bridge Gateway & WooCommerce Functions Tests
// ----------------------------------------------------
test('PHP Bridge: wp-plugin/codix-woocommerce-bridge.php has valid PHP syntax', () => {
  const result = execSync('php -l wp-plugin/codix-woocommerce-bridge.php', { cwd: ROOT_DIR, encoding: 'utf8' });
  assert.match(result, /No syntax errors detected/);
});

test('PHP Bridge: wp-json.php has valid PHP syntax', () => {
  const result = execSync('php -l wp-json.php', { cwd: ROOT_DIR, encoding: 'utf8' });
  assert.match(result, /No syntax errors detected/);
});

test('PHP Bridge: GET /wp-json/codix/v1/products returns valid products list', () => {
  const stdout = execSync('REQUEST_URI="/wp-json/codix/v1/products" php wp-json.php', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  const data = JSON.parse(stdout);

  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.products));
  assert.ok(data.products.length >= 8);

  const first = data.products[0];
  assert.ok(first.id, 'Product must have an id');
  assert.ok(first.name, 'Product must have a name');
  assert.ok(first.slug, 'Product must have a slug');
  assert.ok(typeof first.price === 'number', 'Product price must be a number');
  assert.ok(typeof first.rawPrice === 'number', 'Product rawPrice must be a number');
  assert.ok(first.img, 'Product must have an image');
  assert.ok(first.cat, 'Product must have a category string');
  assert.ok(Array.isArray(first.categories), 'Product must have categories array');
  assert.ok(typeof first.rating === 'number', 'Product must have rating');
  assert.ok(typeof first.reviews === 'number', 'Product must have reviews count');
});

test('PHP Bridge: Category filtering works via ?category=Immunity', () => {
  const stdout = execSync('REQUEST_URI="/wp-json/codix/v1/products?category=Immunity" php wp-json.php', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  const data = JSON.parse(stdout);
  assert.equal(data.success, true);
  assert.ok(data.products.length > 0);
  data.products.forEach(p => {
    const haystack = (p.cat + ' ' + p.categories.join(' ') + ' ' + p.name).toLowerCase();
    assert.ok(haystack.includes('immun') || haystack.includes('vitamin'), 'Product should match Immunity');
  });
});

test('PHP Bridge: Search filtering works via ?search=Flexicod', () => {
  const stdout = execSync('REQUEST_URI="/wp-json/codix/v1/products?search=Flexicod" php wp-json.php', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  const data = JSON.parse(stdout);
  assert.equal(data.success, true);
  assert.equal(data.products.length, 1);
  assert.match(data.products[0].name, /Flexicod/);
});

test('PHP Bridge: Single product lookup by ID works', () => {
  const stdout = execSync('REQUEST_URI="/wp-json/codix/v1/products/s7" php wp-json.php', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  const data = JSON.parse(stdout);
  assert.equal(data.success, true);
  assert.ok(data.product);
  assert.equal(data.product.id, 's7');
  assert.match(data.product.name, /MacaRoot/);
});

test('PHP Bridge: Categories list endpoint returns categories', () => {
  const stdout = execSync('REQUEST_URI="/wp-json/codix/v1/categories" php wp-json.php', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  const data = JSON.parse(stdout);
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.categories));
  assert.ok(data.categories.length >= 5);
});

// ----------------------------------------------------
// 2. JavaScript CodixAPI Client Unit Tests
// ----------------------------------------------------
test('CodixAPI: Normalizes native WooCommerce REST schema correctly', async () => {
  // Load CodixAPI
  const apiCode = fs.readFileSync(path.join(ROOT_DIR, 'js/api.js'), 'utf8');
  
  // Set up mock browser environment
  const mockStorage = {};
  const mockLocalStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  const windowMock = {
    CODIX_API_BASE: '/wp-json',
    localStorage: mockLocalStorage,
    dispatchEvent: () => {}
  };

  const fn = new Function('window', 'localStorage', 'self', `${apiCode}; return window.CodixAPI;`);
  const CodixAPI = fn(windowMock, mockLocalStorage, windowMock);

  assert.ok(CodixAPI, 'CodixAPI should be instantiated');
  assert.ok(Array.isArray(CodixAPI.DEFAULT_PRODUCTS), 'DEFAULT_PRODUCTS should be an array');
  assert.equal(CodixAPI.DEFAULT_PRODUCTS.length, 9);

  // Test local filter by category
  const immunityProds = CodixAPI.filterProductsLocally(CodixAPI.DEFAULT_PRODUCTS, { category: 'Immunity' });
  assert.ok(immunityProds.length > 0);
  assert.ok(immunityProds.some(p => p.name.includes('Codferol')));

  // Test local filter by search
  const fatburner = CodixAPI.filterProductsLocally(CodixAPI.DEFAULT_PRODUCTS, { search: 'Fat Burner' });
  assert.equal(fatburner.length, 1);
  assert.equal(fatburner[0].id, 's5');

  // Test local sort by price ascending
  const sortedLow = CodixAPI.filterProductsLocally(CodixAPI.DEFAULT_PRODUCTS, { orderby: 'price-low' });
  assert.ok(sortedLow[0].price <= sortedLow[1].price);
  assert.ok(sortedLow[1].price <= sortedLow[2].price);

  // Test local sort by price descending
  const sortedHigh = CodixAPI.filterProductsLocally(CodixAPI.DEFAULT_PRODUCTS, { orderby: 'price-high' });
  assert.ok(sortedHigh[0].price >= sortedHigh[1].price);

  // Test cache management
  CodixAPI.setCachedProducts([{ id: 'test-1', name: 'Test Product', price: 10 }]);
  const cached = CodixAPI.getCachedProducts();
  assert.equal(cached.length, 1);
  assert.equal(cached[0].id, 'test-1');

  CodixAPI.clearProductCache();
  assert.equal(CodixAPI.getCachedProducts(), null);
});

test('CodixAPI: getProducts() with live or mock API and offline fallback', async () => {
  const apiCode = fs.readFileSync(path.join(ROOT_DIR, 'js/api.js'), 'utf8');
  let dispatched = null;

  const mockLocalStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const windowMock = {
    CODIX_API_BASE: '/wp-json',
    localStorage: mockLocalStorage,
    dispatchEvent: (evt) => { dispatched = evt; }
  };

  // Mock global fetch returning WooCommerce v3 schema
  globalThis.fetch = async (url) => {
    return {
      ok: true,
      json: async () => [
        {
          id: 42,
          name: 'WooCommerce Custom Product',
          slug: 'wc-custom-product',
          price: '19.99',
          regular_price: '25.00',
          sale_price: '19.99',
          on_sale: true,
          average_rating: '4.80',
          rating_count: 55,
          categories: [{ id: 10, name: 'Immunity' }],
          images: [{ id: 101, src: 'https://example.com/custom.png' }],
          attributes: [{ name: 'Size', options: ['75ml'] }],
          stock_status: 'instock',
          featured: true
        }
      ]
    };
  };

  const fn = new Function('window', 'localStorage', 'self', `${apiCode}; return window.CodixAPI;`);
  const CodixAPI = fn(windowMock, mockLocalStorage, windowMock);

  const res = await CodixAPI.getProducts({ forceRefresh: true });
  assert.equal(res.success, true);
  assert.equal(res.source, 'woocommerce');
  assert.equal(res.products.length, 1);

  const p = res.products[0];
  assert.equal(p.id, '42');
  assert.equal(p.name, 'WooCommerce Custom Product');
  assert.equal(p.price, 19.99);
  assert.equal(p.rawPrice, 19.99);
  assert.equal(p.regular_price, 25.00);
  assert.equal(p.on_sale, true);
  assert.equal(p.badge, 'Sale');
  assert.equal(p.size, '75ml');
  assert.equal(p.img, 'https://example.com/custom.png');
  assert.equal(p.category, 'Immunity');

  // Verify event dispatched
  assert.ok(dispatched, 'CustomEvent should be dispatched');
  assert.equal(dispatched.detail.products.length, 1);

  // Test network failure fallback
  globalThis.fetch = async () => { throw new Error('Network offline'); };
  CodixAPI.clearProductCache();

  const fallbackRes = await CodixAPI.getProducts({ forceRefresh: true });
  assert.equal(fallbackRes.success, true);
  assert.equal(fallbackRes.isFallback, true);
  assert.equal(fallbackRes.products.length, 9);
});

// ----------------------------------------------------
// 3. Homepage (index.html) Structural Tests
// ----------------------------------------------------
test('Homepage (index.html): Contains all required WooCommerce dynamic elements', () => {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

  // Grids
  assert.ok(html.includes('id="popular-products-grid"'), 'Must have popular-products-grid');
  assert.ok(html.includes('id="featured-products-grid"'), 'Must have featured-products-grid');
  assert.ok(html.includes('id="bestselling-products-grid"'), 'Must have bestselling-products-grid');

  // Scripts
  assert.ok(html.includes('src="js/api.js"'), 'Must load js/api.js');
  assert.ok(html.includes('src="js/currency.js"'), 'Must load js/currency.js');

  // Dynamic JS functions
  assert.ok(html.includes('loadWooCommerceProducts'), 'Must define loadWooCommerceProducts');
  assert.ok(html.includes('renderSkeletonGrid'), 'Must define renderSkeletonGrid');
  assert.ok(html.includes('refreshHomeGrids'), 'Must define refreshHomeGrids');
  assert.ok(html.includes('matchHomeCategory'), 'Must define matchHomeCategory');
});

// ----------------------------------------------------
// 4. Shop Page (shop.html) Structural Tests
// ----------------------------------------------------
test('Shop Page (shop.html): Contains all required WooCommerce dynamic elements', () => {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'shop.html'), 'utf8');

  // Grids & Notice
  assert.ok(html.includes('id="shop-grid"'), 'Must have shop-grid');
  assert.ok(html.includes('id="wc-shop-status-notice"'), 'Must have wc-shop-status-notice');
  assert.ok(html.includes('id="shop-pagination"'), 'Must have shop-pagination');

  // Scripts
  assert.ok(html.includes('src="js/api.js"'), 'Must load js/api.js');

  // Dynamic JS functions
  assert.ok(html.includes('loadShopProducts'), 'Must define loadShopProducts');
  assert.ok(html.includes('renderShopSkeletonGrid'), 'Must define renderShopSkeletonGrid');
  assert.ok(html.includes('resetShopFilters'), 'Must define resetShopFilters');
});
