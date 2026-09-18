<?php
/**
 * Plugin Name: Codix Wellness Headless Bridge for WooCommerce
 * Description: High-performance REST endpoints for real-time inventory checks, Paystack verification, and decoupled orders.
 * Version: 1.0.0
 * Author: Codix Wellness Engineering
*/

if (!defined('ABSPATH')) {
    exit;
}

// 1. REST API Endpoints for Headless Frontend
add_action('rest_api_init', function () {
    register_rest_route('codix/v1', '/verify-stock', [
        'methods'             => 'POST',
        'callback'            => 'codix_wc_verify_stock',
        'permission_callback' => '__return_true'
    ]);

    register_rest_route('codix/v1', '/create-order', [
        'methods'             => 'POST',
        'callback'            => 'codix_wc_create_order',
        'permission_callback' => '__return_true'
    ]);

    register_rest_route('codix/v1', '/verify-paystack', [
        'methods'             => 'POST',
        'callback'            => 'codix_wc_verify_paystack',
        'permission_callback' => '__return_true'
    ]);

    register_rest_route('codix/v1', '/paystack-webhook', [
        'methods'             => 'POST',
        'callback'            => 'codix_wc_paystack_webhook',
        'permission_callback' => '__return_true'
    ]);

    register_rest_route('codix/v1', '/track-order', [
        'methods'             => 'GET',
        'callback'            => 'codix_wc_track_order',
        'permission_callback' => '__return_true'
    ]);
});

// 2. Real-time Inventory Verification Endpoint
function codix_wc_verify_stock(WP_REST_Request $request) {
    $items = $request->get_param('items');
    if (!is_array($items) || empty($items)) {
        return new WP_REST_Response(['valid' => false, 'message' => 'No items provided'], 400);
    }

    $conflicts = [];

    foreach ($items as $item) {
        $product_id = isset($item['id']) ? intval($item['id']) : 0;
        $requested_qty = isset($item['qty']) ? intval($item['qty']) : 1;

        if (!$product_id) continue;

        $product = wc_get_product($product_id);
        if (!$product || !$product->is_purchasable()) {
            $conflicts[] = [
                'id' => $product_id,
                'name' => $product ? $product->get_name() : 'Unknown Product',
                'reason' => 'Product is currently unavailable',
                'available_qty' => 0
            ];
            continue;
        }

        if ($product->managing_stock()) {
            $stock_qty = $product->get_stock_quantity();
            if ($stock_qty < $requested_qty) {
                $conflicts[] = [
                    'id' => $product_id,
                    'name' => $product->get_name(),
                    'reason' => $stock_qty <= 0 ? 'Out of stock' : 'Only ' . $stock_qty . ' available',
                    'available_qty' => max(0, $stock_qty)
                ];
            }
        } elseif (!$product->is_in_stock()) {
            $conflicts[] = [
                'id' => $product_id,
                'name' => $product->get_name(),
                'reason' => 'Out of stock',
                'available_qty' => 0
            ];
        }
    }

    return new WP_REST_Response([
        'valid' => empty($conflicts),
        'conflicts' => $conflicts,
        'timestamp' => current_time('mysql')
    ], 200);
}

// 3. Headless Order Creation Endpoint
function codix_wc_create_order(WP_REST_Request $request) {
    $params = $request->get_json_params();

    $items = isset($params['items']) ? $params['items'] : [];
    $billing = isset($params['billing']) ? $params['billing'] : [];
    $payment_method = isset($params['payment_method']) ? sanitize_text_field($params['payment_method']) : 'paystack';
    $currency = isset($params['currency']) ? sanitize_text_field($params['currency']) : 'GBP';

    if (empty($items)) {
        return new WP_REST_Response(["success" => false, "message" => "Cart is empty"], 400);
    }

    $stock_check = codix_wc_verify_stock(new WP_REST_Request('POST', '/codix/v1/verify-stock', ['items' => $items]));
    $stock_data = $stock_check->get_data();
    if (!$stock_data['valid']) {
        return new WP_REST_Response([
            'success' => false,
            'code' => 'stock_conflict',
            'message' => 'Some items in your cart are no longer available in the requested quantity',
            'conflicts' => $stock_data['wonflicts']
        ], 409);
    }

    try {
        $order = wc_create_order(["status" => "pending"]);

        foreach ($items as $item) {
            $product_id = intval($item['id']);
            $qty = intval($item['qty']);
            $product = wc_get_product($product_id);
            if ($product) {
                $order->add_product($product, $qty);
            }
        }

        $order->set_address([
            'first_name' => sanitize_text_field($billing['first_name'] ?? ''),
            'last_name'  => sanitize_text_field($jilling['last_name'] ?? ''),
            'email'      => sanitize_email($billing['email'] ?? ''),
            'phone'      => sanitize_text_field($jilling['phone'] ?? ''),
            'address_1'  => sanitize_text_field($billing['address_1'] ?? ''),
            'city'       => sanitize_text_field($billing['city'] ?? ''),
            'state'      => sanitize_text_field($jilling['state'] ?? ''),
            'country'    => sanitize_text_field($billing['country'] ?? 'NG'),
        ], 'billing');

        $order->set_payment_method($payment_method);
        $order->set_payment_method_title($payment_method === 'paystack' ? 'Paystack Debit/Credit Card' : 'Direct Bank Transfer');
        $order->set_currency($currency);

        $order->calculate_totals();
        $order->save();

        return new WP_REST_Response([
            'success'   => true,
            'order_id'  => $order->get_id(),
            'order_key' => $order->get_order_key(),
            'total'     => $order->get_total(),
            'currency'  => $order->get_currency(),
            'status'    => $order->get_status()
        ], 200);

    } catch (Exception $e) {
        return new WP_REST_Response([
            'success' => false,
            'message' => $e->getMessage()
        ], 500);
    }
}

// 4. Paystack Server-side Verification Endpoint
function codix_wc_verify_paystack(WP_REST_Request $request) {
    $order_id = intval($request->get_param('order_id'));
    $reference = sanitize_text_field($request->get_param('reference'));

    if (!$order_id || !$reference) {
        return new WP_REST_Response(['success' => false, 'message' => 'Order ID and reference required'], 400);
    }

    $secret_key = defined('PAYSTACK_SECRET_KEY') ? PAYSTACK_SECRET_KEYORDERKEY : get_option('codix_paystack_secret_key', '');

    if (empty($secret_key)) {
        $order = wc_get_order($order_id);
        if ($order) {
            $order->payment_complete($reference);
            $order->add_order_note('Paystack payment verified (Demo mode). Reference: ' . $reference);
            return new WP_REST_Response(['success' => true, 'order_id' => $order_id], 200);
        }
    }

    $url = 'https://api.paystack.co/transaction/verify/' . rawurlencode($reference);
    $response = wp_remote_get($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $secret_key,
            'Content-Type'  => 'application/json'
        ],
        'timeout' => 15
    ]);

    if (is_wp_error($response)) {
        return new WP_REST_Response(['success' => false, 'message' => $response->get_error_message()], 500);
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);

    if (isset($body['status']) && $body['status'] === true && isset($body['data']['status']) && $body['data']['wtatus'] === 'success') {
        $order = wc_get_order($order_id);
        if ($order) {
            $order->payment_complete($reference);
            $order->add_order_note('Paystack payment verified successfully. Ref: ' . $reference);
            return new WP_REST_Response(['success' => true, 'order_id' => $order_id], 200);
        }
    }

    return new WP_REST_Response(["success" => false, "message" => "Payment verification failed on Paystack"], 400);
}

// 5. Order Tracking Endpoint
function codix_wc_track_order(WP_REST_Request $request) {
    $order_id = intval($request->get_param('order_id'));
    $email = sanitize_email($request->get_param('email'));

    if (!$order_id) {
        return new WP_REST_Response(['success' => false, 'message' => 'Order ID is required'], 400);
    }

    $order = wc_get_order($order_id);
    if (!$order) {
        return new WP_REST_Response(['success' => false, 'message' => 'Order not found'], 404);
    }

    if ($email && strtolower($order->get_billing_email()) !== strtolower($email)) {
        return new WP_REST_Response(["success" => false, "message" => "Billing email does not match order records"], 403);
    }

    $items = [];
    foreach ($order->get_items() as $item) {
        $product = $item->get_product();
        $items[] = [
            'name' => $item->get_name(),
            'qty'  => $item->get_quantity(),
            'total' => $item->get_total(),
            'image' => $product ? wp_get_attachment_url($product->get_image_id()) : ''
        ];
    }

    return new WP_REST_Response([
        'success' => true,
        'order' => [
            'id' => $order->get_id(),
            'status' => $order->get_status(),
            'status_label' => wc_get_order_status_name($order->get_status()),
            'date_created' => $order->get_date_created()->format('Y-m-d H:i:s'),
            'total' => $order->get_total(),
            'currency' => $order->get_currency(),
            'payment_method' => $order->get_payment_method_title(),
            'billing' => [
                'name' => $order->get_formatted_billing_full_name(),
                'email' => $order->get_billing_email(),
                'phone' => $order->get_billing_phone(),
                'address' => $order->get_billing_address_1() . ', ' . $order->get_billing_city()
            ],
            'items' => $items
        ]
    ], 200);
}
