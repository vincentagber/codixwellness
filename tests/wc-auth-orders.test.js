import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Execute php-cgi against wp-json.php
 */
function requestWpJson(method, route, body = null, headers = {}) {
  const [pathPart, queryPart] = route.split('?');
  const fullUri = `/wp-json${pathPart}${queryPart ? '?' + queryPart : ''}`;

  const jsonStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
  const bodyBuffer = Buffer.from(jsonStr, 'utf8');

  const customEnv = {
    ...process.env,
    REDIRECT_STATUS: '200',
    REQUEST_METHOD: method,
    REQUEST_URI: fullUri,
    SCRIPT_FILENAME: path.join(ROOT_DIR, 'wp-json.php'),
    SCRIPT_NAME: '/wp-json.php',
    PATH_INFO: pathPart,
    QUERY_STRING: queryPart || '',
    SERVER_NAME: 'localhost',
    SERVER_PORT: '80'
  };

  if (body) {
    customEnv.CONTENT_TYPE = 'application/json';
    customEnv.CONTENT_LENGTH = String(bodyBuffer.length);
  }

  for (const [k, v] of Object.entries(headers)) {
    const headerKey = 'HTTP_' + k.toUpperCase().replace(/-/g, '_');
    customEnv[headerKey] = v;
  }

  try {
    const rawOutput = execSync(`php-cgi -q "${path.join(ROOT_DIR, 'wp-json.php')}"`, {
      cwd: ROOT_DIR,
      env: customEnv,
      input: body ? bodyBuffer : undefined,
      maxBuffer: 10 * 1024 * 1024
    }).toString('utf8');

    const headerEndIdx = rawOutput.indexOf('\r\n\r\n');
    const splitIndex = headerEndIdx !== -1 ? headerEndIdx : rawOutput.indexOf('\n\n');
    const headerStr = splitIndex !== -1 ? rawOutput.substring(0, splitIndex) : '';
    const bodyStr = splitIndex !== -1 ? rawOutput.substring(splitIndex).trim() : rawOutput.trim();

    let status = 200;
    const statusMatch = headerStr.match(/Status:\s*(\d+)/i);
    if (statusMatch) {
      status = parseInt(statusMatch[1], 10);
    }

    let parsed = null;
    try {
      parsed = JSON.parse(bodyStr);
    } catch {
      parsed = bodyStr;
    }

    return { status, data: parsed, headers: headerStr };
  } catch (err) {
    if (err.stdout) {
      const rawOutput = err.stdout.toString('utf8');
      const splitIndex = rawOutput.indexOf('\r\n\r\n') !== -1 ? rawOutput.indexOf('\r\n\r\n') : rawOutput.indexOf('\n\n');
      const headerStr = splitIndex !== -1 ? rawOutput.substring(0, splitIndex) : '';
      const bodyStr = splitIndex !== -1 ? rawOutput.substring(splitIndex).trim() : rawOutput.trim();
      let status = 500;
      const statusMatch = headerStr.match(/Status:\s*(\d+)/i);
      if (statusMatch) status = parseInt(statusMatch[1], 10);
      try {
        return { status, data: JSON.parse(bodyStr), headers: headerStr };
      } catch {
        return { status, data: bodyStr, headers: headerStr };
      }
    }
    throw err;
  }
}

test('Auth: Register new customer creates user and session token', () => {
  const uniqueEmail = `testuser_${Date.now()}@example.com`;
  const res = requestWpJson('POST', '/codix/v1/auth/register', {
    first_name: 'Arthur',
    last_name: 'Dent',
    email: uniqueEmail,
    password: 'Password42!'
  });

  assert.equal(res.status, 201, 'Should return 201 Created');
  assert.ok(res.data.token, 'Should return session token');
  assert.equal(res.data.user.email, uniqueEmail, 'User email should match');
  assert.equal(res.data.user.first_name, 'Arthur', 'First name should match');
});

test('Auth: Duplicate registration is rejected with 400 Bad Request', () => {
  const uniqueEmail = `dup_${Date.now()}@example.com`;
  // First registration
  requestWpJson('POST', '/codix/v1/auth/register', {
    first_name: 'Arthur',
    last_name: 'Dent',
    email: uniqueEmail,
    password: 'Password42!'
  });

  // Duplicate registration
  const dupRes = requestWpJson('POST', '/codix/v1/auth/register', {
    first_name: 'Arthur',
    last_name: 'Dent',
    email: uniqueEmail,
    password: 'Password42!'
  });

  assert.equal(dupRes.status, 400, 'Duplicate registration must return 400 Bad Request');
  assert.ok(dupRes.data.code === 'registration_error' || dupRes.data.code === 'registration_duplicate_email');
  assert.match(dupRes.data.message, /already exists/i);
});

test('Auth: Login fails with 401 Unauthorized for incorrect credentials', () => {
  const res = requestWpJson('POST', '/codix/v1/auth/login', {
    email: 'nonexistent@example.com',
    password: 'wrongpassword'
  });

  assert.equal(res.status, 401, 'Invalid login must return 401 Unauthorized');
  assert.equal(res.data.code, 'invalid_credentials');
});

test('Auth: Login succeeds and profile can be fetched and updated', () => {
  const email = `active_${Date.now()}@example.com`;
  const password = 'SecretPassword123!';

  // Register
  const reg = requestWpJson('POST', '/codix/v1/auth/register', {
    first_name: 'Trillian',
    last_name: 'Astra',
    email: email,
    password: password
  });
  assert.equal(reg.status, 201);
  const token = reg.data.token;

  // Login
  const loginRes = requestWpJson('POST', '/codix/v1/auth/login', {
    email: email,
    password: password
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.data.token);

  // Profile retrieval
  const profileRes = requestWpJson('GET', '/codix/v1/customer/profile', null, {
    Authorization: `Bearer ${token}`
  });
  assert.equal(profileRes.status, 200);
  assert.equal(profileRes.data.user.email, email);

  // Profile update
  const updateRes = requestWpJson('PUT', '/codix/v1/customer/profile', {
    first_name: 'Tricia',
    billing: {
      address_1: '42 Magrathea Way',
      city: 'London',
      postcode: 'SW1A 1AA',
      country: 'United Kingdom'
    }
  }, {
    Authorization: `Bearer ${token}`
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.user.first_name, 'Tricia');
  assert.equal(updateRes.data.user.billing.address_1, '42 Magrathea Way');
});

test('Auth: Lost password and password reset flow', () => {
  const email = `reset_${Date.now()}@example.com`;
  requestWpJson('POST', '/codix/v1/auth/register', {
    first_name: 'Ford',
    last_name: 'Prefect',
    email: email,
    password: 'InitialPassword1!'
  });

  // Request reset
  const lostRes = requestWpJson('POST', '/codix/v1/auth/lost-password', { email });
  assert.equal(lostRes.status, 200);
  assert.ok(lostRes.data.reset_key || lostRes.data.key, 'Returns reset token');
  const resetKey = lostRes.data.reset_key || lostRes.data.key;

  // Complete reset
  const resetRes = requestWpJson('POST', '/codix/v1/auth/reset-password', {
    email: email,
    key: resetKey,
    password: 'NewSecurePassword456!'
  });
  assert.equal(resetRes.status, 200);

  // Old password must fail
  const oldLogin = requestWpJson('POST', '/codix/v1/auth/login', {
    email: email,
    password: 'InitialPassword1!'
  });
  assert.equal(oldLogin.status, 401);

  // New password must succeed
  const newLogin = requestWpJson('POST', '/codix/v1/auth/login', {
    email: email,
    password: 'NewSecurePassword456!'
  });
  assert.equal(newLogin.status, 200);
});

test('Auth: Logout revokes session token immediately', () => {
  const email = `logout_${Date.now()}@example.com`;
  const reg = requestWpJson('POST', '/codix/v1/auth/register', {
    first_name: 'Zaphod',
    last_name: 'Beeblebrox',
    email: email,
    password: 'PresidentialPassword!'
  });
  const token = reg.data.token;

  // Profile should work
  const p1 = requestWpJson('GET', '/codix/v1/customer/profile', null, {
    Authorization: `Bearer ${token}`
  });
  assert.equal(p1.status, 200);

  // Logout
  const logoutRes = requestWpJson('POST', '/codix/v1/auth/logout', null, {
    Authorization: `Bearer ${token}`
  });
  assert.equal(logoutRes.status, 200);

  // Profile should now be 401
  const p2 = requestWpJson('GET', '/codix/v1/customer/profile', null, {
    Authorization: `Bearer ${token}`
  });
  assert.equal(p2.status, 401, 'Revoked token must be rejected with 401 Unauthorized');
});

test('WooCommerce Store API: Cart operations return valid Store API schema', () => {
  const getCart = requestWpJson('GET', '/wc/store/v1/cart');
  assert.equal(getCart.status, 200);
  assert.ok(Array.isArray(getCart.data.items), 'Store API cart items must be an array');
  assert.ok(getCart.data.totals, 'Store API cart must include totals');

  const addItem = requestWpJson('POST', '/wc/store/v1/cart/add-item', {
    id: 's1',
    quantity: 2
  });
  assert.equal(addItem.status, 200);
  assert.ok(addItem.data.items.length >= 1);
});

test('Customer Authorization: Customers cannot access another customer orders (403 Forbidden)', () => {
  // Create User A
  const userA = requestWpJson('POST', '/codix/v1/auth/register', {
    first_name: 'Alice',
    last_name: 'Smith',
    email: `alice_${Date.now()}@example.com`,
    password: 'AliceSecretPassword1!'
  });
  const tokenA = userA.data.token;

  // Create User B
  const userB = requestWpJson('POST', '/codix/v1/auth/register', {
    first_name: 'Bob',
    last_name: 'Jones',
    email: `bob_${Date.now()}@example.com`,
    password: 'BobSecretPassword2!'
  });
  const tokenB = userB.data.token;

  // User A places an order
  const orderRes = requestWpJson('POST', '/codix/v1/create-order', {
    payment_method: 'stripe',
    billing: {
      first_name: 'Alice',
      last_name: 'Smith',
      email: userA.data.user.email
    },
    items: [{ id: 's1', name: 'Codferol Vitamin D3', price: 9.17, qty: 1 }],
    total: 9.86
  }, {
    Authorization: `Bearer ${tokenA}`
  });
  assert.equal(orderRes.status, 200);
  const orderId = orderRes.data.order_id;

  // User A accesses their own order -> 200 OK
  const aliceOrder = requestWpJson('GET', `/codix/v1/customer/orders/${orderId}`, null, {
    Authorization: `Bearer ${tokenA}`
  });
  assert.equal(aliceOrder.status, 200);

  // User B attempts to access User A's order -> 403 Forbidden!
  const bobAccess = requestWpJson('GET', `/codix/v1/customer/orders/${orderId}`, null, {
    Authorization: `Bearer ${tokenB}`
  });
  assert.equal(bobAccess.status, 403, 'Cross-customer order access must return 403 Forbidden');
  assert.equal(bobAccess.data.code, 'forbidden');
});

test('Frontend Pages: Validation of removed demo credentials and real API integration', () => {
  const loginHtml = fs.readFileSync(path.join(ROOT_DIR, 'login.html'), 'utf8');
  assert.ok(!loginHtml.includes('value="johncarter@outlook.com"'), 'Demo email must be removed');
  assert.ok(!loginHtml.includes('value="password123"'), 'Demo password must be removed');
  assert.ok(loginHtml.includes('src="js/config.js"'), 'login.html must include config.js');
  assert.ok(loginHtml.includes('CodixAPI.login('), 'login.html must call CodixAPI.login');

  const createAccHtml = fs.readFileSync(path.join(ROOT_DIR, 'create-account.html'), 'utf8');
  assert.ok(!createAccHtml.includes("alert('Account created successfully!')"), 'Mock alert in create-account.html must be removed');
  assert.ok(createAccHtml.includes('src="js/config.js"'), 'create-account.html must include config.js');
  assert.ok(createAccHtml.includes('CodixAPI.register('), 'create-account.html must call CodixAPI.register');

  const resetHtml = fs.readFileSync(path.join(ROOT_DIR, 'reset-password.html'), 'utf8');
  assert.ok(!resetHtml.includes("alert('Password reset link sent to your email!')"), 'Mock alert in reset-password.html must be removed');
  assert.ok(resetHtml.includes('src="js/config.js"'), 'reset-password.html must include config.js');
  assert.ok(resetHtml.includes('CodixAPI.lostPassword('), 'reset-password.html must call CodixAPI.lostPassword');

  const accountHtml = fs.readFileSync(path.join(ROOT_DIR, 'account.html'), 'utf8');
  assert.ok(accountHtml.includes('src="js/config.js"'), 'account.html must include config.js');
  assert.ok(accountHtml.includes('CodixAPI.getProfile('), 'account.html must call CodixAPI.getProfile');
  assert.ok(accountHtml.includes('CodixAPI.getCustomerOrders('), 'account.html must call CodixAPI.getCustomerOrders');
  assert.ok(accountHtml.includes('Array.isArray(orderRes.orders)'), 'account.html must safely unpack orders array from getCustomerOrders response');
  assert.ok(accountHtml.includes('CodixAPI.logout('), 'account.html must call CodixAPI.logout');

  const orderReceivedHtml = fs.readFileSync(path.join(ROOT_DIR, 'order-received.html'), 'utf8');
  assert.ok(!orderReceivedHtml.includes('vincentagber74@gmail.com'), 'order-received.html must not contain hardcoded personal email');
  assert.ok(!orderReceivedHtml.includes('Plot 4, Ikeja, Lagos'), 'order-received.html must not contain hardcoded personal address');

  const checkoutHtml = fs.readFileSync(path.join(ROOT_DIR, 'checkout.html'), 'utf8');
  assert.ok(checkoutHtml.includes('stripe-card-number'), 'checkout.html must include Stripe card inputs');
  assert.ok(checkoutHtml.includes('cardNumber.length < 13'), 'checkout.html must validate card number');
  assert.ok(checkoutHtml.includes('cardExp'), 'checkout.html must validate card expiration');

  const cartHtml = fs.readFileSync(path.join(ROOT_DIR, 'cart.html'), 'utf8');
  assert.ok(cartHtml.includes('product.html?id='), 'cart.html item link must contain product id query parameter');
});

