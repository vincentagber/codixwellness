<?php
/**
 * Codix Wellness Headless REST API Bridge Gateway
 * Handles /wp-json and /wp-api routes mapped via .htaccess
 * Bridges directly to WordPress/WooCommerce when present,
 * or provides high-performance decoupled responses with CORS.
 */

// Enable CORS
if (!headers_sent()) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce, X-WC-Store-API-Nonce, Cart-Token, X-Requested-With');
    header('Access-Control-Max-Age: 86400');
}

$request_method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($request_method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Check if WordPress core is installed in current or parent directory
$wp_load_paths = [
    __DIR__ . '/wp-load.php',
    dirname(__DIR__) . '/wp-load.php',
    __DIR__ . '/wordpress/wp-load.php'
];

foreach ($wp_load_paths as $path) {
    if (file_exists($path)) {
        require_once $path;
        break;
    }
}

// Standalone High-Performance Decoupled Bridge
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

// WordPress Helper Polyfills for Standalone Execution
if (!function_exists('add_action')) {
    function add_action($tag, $callback) {}
}
if (!function_exists('register_rest_route')) {
    function register_rest_route($namespace, $route, $args) {}
}
if (!function_exists('sanitize_text_field')) {
    function sanitize_text_field($str) {
        return is_string($str) ? strip_tags(trim($str)) : '';
    }
}
if (!function_exists('sanitize_title')) {
    function sanitize_title($str) {
        return strtolower(preg_replace('/[^a-zA-Z0-9_-]+/', '-', trim((string) $str)));
    }
}
if (!function_exists('sanitize_email')) {
    function sanitize_email($email) {
        return filter_var($email, FILTER_SANITIZE_EMAIL);
    }
}
if (!function_exists('wp_strip_all_tags')) {
    function wp_strip_all_tags($str) {
        return strip_tags((string) $str);
    }
}
if (!function_exists('is_wp_error')) {
    function is_wp_error($thing) {
        return false;
    }
}

// Mock WP_REST_Request & Response classes if running decoupled
if (!class_exists('WP_REST_Request')) {
    class WP_REST_Request {
        private $method;
        private $route;
        private $params = [];

        public function __construct($method = 'GET', $route = '', $params = []) {
            $this->method = strtoupper($method);
            $this->route = $route;
            $this->params = $params;
        }

        public function get_method() {
            return $this->method;
        }

        public function get_param($key) {
            return $this->params[$key] ?? $_GET[$key] ?? $_POST[$key] ?? null;
        }

        public function get_params() {
            return array_merge($_GET, $_POST, $this->params);
        }

        public function get_json_params() {
            $raw = file_get_contents('php://input');
            return json_decode($raw, true) ?: [];
        }

        public function get_header($key) {
            $normalized = 'HTTP_' . strtoupper(str_replace('-', '_', $key));
            if (isset($_SERVER[$normalized])) {
                return $_SERVER[$normalized];
            }
            if (isset($_SERVER[strtoupper($key)])) {
                return $_SERVER[strtoupper($key)];
            }
            if (function_exists('getallheaders')) {
                $all = getallheaders();
                foreach ($all as $k => $v) {
                    if (strcasecmp($k, $key) === 0) {
                        return $v;
                    }
                }
            }
            return null;
        }
    }
}

if (!class_exists('WP_REST_Response')) {
    class WP_REST_Response {
        public $data;
        public $status;
        public $headers = [];

        public function __construct($data = null, $status = 200, $headers = []) {
            $this->data = $data;
            $this->status = $status;
            $this->headers = $headers;
        }

        public function get_data() {
            return $this->data;
        }

        public function header($key, $value) {
            $this->headers[$key] = $value;
            if (!headers_sent()) {
                header($key . ': ' . $value);
            }
        }
    }
}

// Load bridge helper functions from plugin file if not defined
if (!function_exists('codix_wc_format_product')) {
    if (!defined('ABSPATH')) {
        define('ABSPATH', __DIR__ . '/');
    }
    require_once __DIR__ . '/wp-plugin/codix-woocommerce-bridge.php';
}

$request_uri = $_SERVER['REQUEST_URI'] ?? (!empty($_SERVER['PATH_INFO']) ? '/wp-json' . $_SERVER['PATH_INFO'] : '');
$path = parse_url($request_uri, PHP_URL_PATH) ?: '';
$query = parse_url($request_uri, PHP_URL_QUERY) ?: '';
if (empty($_GET) && !empty($query)) {
    parse_str($query, $_GET);
}

// Normalize route
$route = '';
if (isset($_GET['rest_route'])) {
    $route = $_GET['rest_route'];
} else {
    if (preg_match('#/(?:wp-json|wp-api)(/.*)?$#', $path, $matches)) {
        $route = $matches[1] ?? '/';
    }
}
$route = '/' . ltrim($route, '/');

// Route dispatching
$json_input = json_decode(file_get_contents('php://input'), true) ?: [];
$merged_params = array_merge($_GET, $_POST, $json_input);
$req = new WP_REST_Request($request_method, $route, $merged_params);

// Customer Authentication Endpoints
if (strpos($route, '/codix/v1/auth/register') === 0 || strpos($route, '/wp/v2/users/register') === 0) {
    $res = codix_wc_auth_register($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/auth/login') === 0 || strpos($route, '/jwt-auth/v1/token') === 0) {
    $res = codix_wc_auth_login($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/auth/logout') === 0) {
    $res = codix_wc_auth_logout($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/auth/lost-password') === 0 || strpos($route, '/wp/v2/users/lost-password') === 0) {
    $res = codix_wc_auth_lost_password($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/auth/reset-password') === 0) {
    $res = codix_wc_auth_reset_password($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Customer Profile & Customer Orders (Customer Authorization Enforced Server-Side)
if (strpos($route, '/codix/v1/customer/profile') === 0 || strpos($route, '/codix/v1/auth/me') === 0) {
    $res = codix_wc_customer_profile_handler($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (preg_match('#^/codix/v1/customer/orders/(?P<id>[\w-]+)#', $route, $matches)) {
    $req = new WP_REST_Request('GET', $route, array_merge($merged_params, ['id' => $matches['id']]));
    $res = codix_wc_get_single_customer_order($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/customer/orders') === 0) {
    $res = codix_wc_get_customer_orders($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// WooCommerce Store API & Cart Endpoints
if (strpos($route, '/wc/store/v1/cart/add-item') === 0 || strpos($route, '/codix/v1/cart/add') === 0) {
    $res = codix_wc_store_add_cart_item($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/wc/store/v1/cart/update-item') === 0 || strpos($route, '/codix/v1/cart/update') === 0) {
    $res = codix_wc_store_update_cart_item($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/wc/store/v1/cart/remove-item') === 0 || strpos($route, '/codix/v1/cart/remove') === 0) {
    $res = codix_wc_store_remove_cart_item($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/wc/store/v1/cart/clear') === 0 || strpos($route, '/codix/v1/cart/clear') === 0) {
    $res = codix_wc_store_clear_cart($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/wc/store/v1/cart') === 0) {
    $res = codix_wc_store_cart_endpoint($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/cart') === 0) {
    $res = codix_wc_cart_handler($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/wc/store/v1/checkout') === 0) {
    $res = codix_wc_create_order($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Product Detail & Listing Endpoints
if (preg_match('#^/(?:codix/v1|wc/v3|wc/store/v1)/products/(?P<id>[\w-]+)#', $route, $matches)) {
    $req = new WP_REST_Request('GET', $route, array_merge($merged_params, ['id' => $matches['id']]));
    $res = codix_wc_get_product_detail($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/products') === 0 || strpos($route, '/wc/v3/products') === 0 || strpos($route, '/wc/store/v1/products') === 0) {
    $res = codix_wc_get_products($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/categories') === 0 || strpos($route, '/wc/v3/products/categories') === 0 || strpos($route, '/wc/store/v1/products/categories') === 0) {
    $res = codix_wc_get_categories();
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/verify-stock') === 0) {
    $res = codix_wc_verify_stock($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/create-order') === 0) {
    $res = codix_wc_create_order($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/verify-stripe') === 0) {
    $res = codix_wc_verify_stripe($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/stripe-webhook') === 0) {
    $res = codix_wc_stripe_webhook($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/payment-config') === 0) {
    $res = codix_wc_get_payment_config();
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/verify-paystack') === 0) {
    $res = codix_wc_verify_paystack($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (strpos($route, '/codix/v1/track-order') === 0) {
    $res = codix_wc_track_order($req);
    http_response_code($res->status);
    echo json_encode($res->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Fallback index
echo json_encode([
    'name'        => 'Codix Wellness WooCommerce REST API Gateway',
    'version'     => '1.2.0',
    'status'      => 'online',
    'endpoints'   => [
        'GET  /wp-json/codix/v1/products',
        'GET  /wp-json/codix/v1/products/{id}',
        'GET  /wp-json/codix/v1/categories',
        'POST /wp-json/codix/v1/auth/register',
        'POST /wp-json/codix/v1/auth/login',
        'POST /wp-json/codix/v1/auth/logout',
        'POST /wp-json/codix/v1/auth/lost-password',
        'POST /wp-json/codix/v1/auth/reset-password',
        'GET  /wp-json/codix/v1/customer/profile',
        'PUT  /wp-json/codix/v1/customer/profile',
        'GET  /wp-json/codix/v1/customer/orders',
        'GET  /wp-json/codix/v1/customer/orders/{id}',
        'GET  /wp-json/wc/store/v1/cart',
        'POST /wp-json/wc/store/v1/cart/add-item',
        'POST /wp-json/wc/store/v1/cart/update-item',
        'POST /wp-json/wc/store/v1/cart/remove-item',
        'POST /wp-json/wc/store/v1/checkout',
        'POST /wp-json/codix/v1/verify-stock',
        'POST /wp-json/codix/v1/create-order',
        'POST /wp-json/codix/v1/verify-stripe',
        'POST /wp-json/codix/v1/stripe-webhook',
        'GET  /wp-json/codix/v1/payment-config',
        'GET  /wp-json/codix/v1/track-order'
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
