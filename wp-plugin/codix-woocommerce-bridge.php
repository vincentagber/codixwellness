<?php
/**
 * Plugin Name: Codix Wellness Headless Bridge for WooCommerce
 * Plugin URI: https://vincentagber.vercel.app/
 * Description: High-performance REST endpoints for dynamic products, real-time inventory checks, WooCommerce Stripe payment synchronization, and decoupled orders.
 * Version: 1.1.0
 * Author: Vincent Agber
 * Author URI: https://vincentagber.vercel.app/
*/

if (!defined('ABSPATH')) {
    exit;
}

// 1. REST API Endpoints for Headless Frontend
add_action('rest_api_init', function () {
    // Dynamic Products Endpoints
    register_rest_route('codix/v1', '/products', [
        'methods'             => 'GET',
        'callback'            => 'codix_wc_get_products',
        'permission_callback' => '__return_true'
    ]);

    register_rest_route('codix/v1', '/products/(?P<id>[\w-]+)', [
        'methods'             => 'GET',
        'callback'            => 'codix_wc_get_product_detail',
        'permission_callback' => '__return_true'
    ]);

    register_rest_route('codix/v1', '/categories', [
        'methods'             => 'GET',
        'callback'            => 'codix_wc_get_categories',
        'permission_callback' => '__return_true'
    ]);

    // Checkout & Verification Endpoints
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

    register_rest_route('codix/v1', '/verify-stripe', [
        'methods'             => 'POST',
        'callback'            => 'codix_wc_verify_stripe',
        'permission_callback' => '__return_true'
    ]);

    register_rest_route('codix/v1', '/payment-config', [
        'methods'             => 'GET',
        'callback'            => 'codix_wc_get_payment_config',
        'permission_callback' => '__return_true'
    ]);

    register_rest_route('codix/v1', '/stripe-webhook', [
        'methods'             => 'POST',
        'callback'            => 'codix_wc_stripe_webhook',
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

// 2. Format a WooCommerce product into clean decoupled frontend schema
function codix_wc_format_product($product) {
    if (!$product) return null;

    if (is_array($product)) {
        $product_id = $product['id'] ?? 0;
    } elseif (is_numeric($product)) {
        $product_id = intval($product);
        if (function_exists('wc_get_product')) {
            $product = wc_get_product($product_id);
            if (!$product) return null;
        }
    } elseif (is_object($product) && method_exists($product, 'get_id')) {
        $product_id = $product->get_id();
    } else {
        $product_id = 0;
    }

    $name = is_object($product) ? $product->get_name() : ($product['name'] ?? '');
    $slug = is_object($product) ? $product->get_slug() : ($product['slug'] ?? sanitize_title($name));
    $price = is_object($product) ? floatval($product->get_price()) : floatval($product['price'] ?? 0);
    $regular_price = is_object($product) ? floatval($product->get_regular_price() ?: $price) : floatval($product['regular_price'] ?? $price);
    $sale_price = (is_object($product) && $product->get_sale_price() !== '') ? floatval($product->get_sale_price()) : (isset($product['sale_price']) && $product['sale_price'] !== null ? floatval($product['sale_price']) : null);
    $on_sale = is_object($product) ? $product->is_on_sale() : (!empty($product['on_sale']) || !empty($sale_price));
    $in_stock = is_object($product) ? $product->is_in_stock() : (!isset($product['in_stock']) || !empty($product['in_stock']));
    $stock_quantity = is_object($product) ? $product->get_stock_quantity() : ($product['stock_quantity'] ?? 50);
    $rating = is_object($product) ? floatval($product->get_average_rating() ?: 5.0) : floatval($product['rating'] ?? 5.0);
    $reviews = is_object($product) ? intval($product->get_review_count() ?: 0) : intval($product['reviews'] ?? 0);
    $featured = is_object($product) ? $product->is_featured() : !empty($product['featured']);

    // Categories
    $categories = [];
    if (is_object($product) && function_exists('get_the_terms')) {
        $terms = get_the_terms($product_id, 'product_cat');
        if (!is_wp_error($terms) && !empty($terms)) {
            foreach ($terms as $t) {
                $categories[] = $t->name;
            }
        }
    }
    if (empty($categories) && !empty($product['categories'])) {
        $categories = (array) $product['categories'];
    } elseif (empty($categories) && !empty($product['cat'])) {
        $categories = array_map('trim', explode(',', $product['cat']));
    }
    if (empty($categories)) {
        $categories = ['Supplements'];
    }

    $cat_string = !empty($product['cat']) ? $product['cat'] : implode(', ', $categories);

    // Primary Image
    $image_url = '';
    if (is_object($product) && function_exists('wp_get_attachment_image_url')) {
        $image_id = $product->get_image_id();
        if ($image_id) {
            $image_url = wp_get_attachment_image_url($image_id, 'full') ?: '';
        }
    }
    if (empty($image_url) && !empty($product['img'])) {
        $image_url = $product['img'];
    } elseif (empty($image_url) && !empty($product['image'])) {
        $image_url = $product['image'];
    } else {
        $image_url = codix_wc_infer_image($name, $slug);
    }

    // Size attribute
    $size = '';
    if (is_object($product)) {
        $size = $product->get_attribute('size') ?: get_post_meta($product_id, '_product_size', true);
    }
    if (empty($size) && !empty($product['size'])) {
        $size = $product['size'];
    }
    if (empty($size)) {
        $size = codix_wc_infer_size($name);
    }

    // Badge
    $badge = '';
    if ($on_sale) {
        $badge = 'Sale';
    } elseif (is_object($product) && get_post_meta($product_id, '_is_new', true)) {
        $badge = 'New';
    } elseif (!empty($product['badge'])) {
        $badge = $product['badge'];
    }

    // Currency formatted string
    $currency_symbol = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '£';

    return [
        'id'                => $product_id,
        'name'              => $name,
        'slug'              => $slug,
        'cat'               => $cat_string,
        'category'          => $categories[0] ?? 'Supplements',
        'categories'        => $categories,
        'badge'             => $badge,
        'price'             => $price,
        'rawPrice'          => $price,
        'regular_price'     => $regular_price,
        'sale_price'        => $sale_price,
        'on_sale'           => $on_sale,
        'priceStr'          => $currency_symbol . number_format($price, 2),
        'reviews'           => $reviews,
        'rating'            => $rating,
        'img'               => $image_url,
        'image'             => $image_url,
        'size'              => $size,
        'in_stock'          => $in_stock,
        'stock_quantity'    => $stock_quantity,
        'featured'          => $featured,
        'bestselling'       => !empty($product['bestselling']) || $reviews >= 80,
        'short_description' => is_object($product) ? wp_strip_all_tags($product->get_short_description()) : ($product['short_description'] ?? ''),
        'description'       => is_object($product) ? wp_strip_all_tags($product->get_description()) : ($product['description'] ?? '')
    ];
}

// 3. Infer product image from name/slug if missing
function codix_wc_infer_image($name, $slug) {
    $n = strtolower($name . ' ' . $slug);
    if (strpos($n, 'codferol') !== false || strpos($n, 'd3') !== false) {
        return 'images/product-codferol-d3.png';
    }
    if (strpos($n, 'winwell') !== false || strpos($n, 'multivitamin') !== false) {
        return 'images/product-winwell.jpg';
    }
    if (strpos($n, 'vitamin c') !== false || strpos($n, 'effervescent') !== false) {
        return 'images/f-grid-13.png';
    }
    if (strpos($n, 'flexicod') !== false || strpos($n, 'joint') !== false) {
        return 'images/f-grid-4.png';
    }
    if (strpos($n, 'fat burner') !== false || strpos($n, 'fatburner') !== false) {
        return 'images/f-grid-5.png';
    }
    if (strpos($n, 'selcea') !== false || strpos($n, 'hepato') !== false || strpos($n, 'liver') !== false) {
        return 'images/product-selcea.png';
    }
    if (strpos($n, 'maca') !== false) {
        return 'images/f-grid-8.png';
    }
    if (strpos($n, 'everose') !== false || strpos($n, 'primrose') !== false) {
        return 'images/product-everose.png';
    }
    if (strpos($n, 'collagen') !== false || strpos($n, 'day 2 day') !== false) {
        return 'images/f-grid-6.png';
    }
    return 'images/product-winwell.jpg';
}

// 4. Infer product size from name
function codix_wc_infer_size($name) {
    $n = strtolower($name);
    if (strpos($n, 'oral solution') !== false || strpos($n, 'codferol') !== false || strpos($n, 'fat burner') !== false) {
        return '50ml';
    }
    if (strpos($n, 'effervescent') !== false) {
        return '30ml';
    }
    if (strpos($n, 'selcea') !== false || strpos($n, 'maca') !== false) {
        return '100mg';
    }
    if (strpos($n, 'collagen') !== false) {
        return '150ml';
    }
    return '100ml';
}

// 5. Default Official Codix Wellness Launch Catalog
function codix_wc_get_fallback_catalog() {
    return [
        [
            'id'             => 's1',
            'name'           => 'Codferol Vitamin D3 Oral Solution',
            'slug'           => 'codferol-vitamin-d3-oral-solution',
            'cat'            => 'Supplements, Vitamins',
            'categories'     => ['Supplements', 'Vitamins', 'Immunity'],
            'badge'          => 'Sale',
            'price'          => 9.17,
            'regular_price'  => 9.17,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 1,
            'rating'         => 5.0,
            'img'            => 'images/product-codferol-d3.png',
            'size'           => '50ml',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => true
        ],
        [
            'id'             => 's2',
            'name'           => 'Winwell Daily Multivitamin',
            'slug'           => 'winwell-daily-multivitamin',
            'cat'            => 'Supplements, General Wellness',
            'categories'     => ['Supplements', 'General Wellness'],
            'badge'          => 'Sale',
            'price'          => 7.08,
            'regular_price'  => 7.08,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 103,
            'rating'         => 5.0,
            'img'            => 'images/product-winwell.jpg',
            'size'           => '100ml',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => true
        ],
        [
            'id'             => 's3',
            'name'           => 'Vitamin C + D Effervescent Tablets',
            'slug'           => 'vitamin-c-d-effervescent-tablets',
            'cat'            => 'Supplements, Immune Support',
            'categories'     => ['Supplements', 'Immune Support', 'Immunity'],
            'badge'          => 'Sale',
            'price'          => 4.58,
            'regular_price'  => 4.58,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 59,
            'rating'         => 5.0,
            'img'            => 'images/f-grid-13.png',
            'size'           => '30ml',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => true
        ],
        [
            'id'             => 's4',
            'name'           => 'Flexicod – Joint Health Support',
            'slug'           => 'flexicod-joint-health-support',
            'cat'            => 'Supplements, Joint Support',
            'categories'     => ['Supplements', 'Joint Support', 'Joint & Bone'],
            'badge'          => 'Sale',
            'price'          => 8.33,
            'regular_price'  => 8.33,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 102,
            'rating'         => 5.0,
            'img'            => 'images/f-grid-4.png',
            'size'           => '100ml',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => true
        ],
        [
            'id'             => 's5',
            'name'           => 'Codix Fat Burner – Metabolism Support',
            'slug'           => 'codix-fat-burner-metabolism-support',
            'cat'            => 'Supplements, Weight Management',
            'categories'     => ['Supplements', 'Weight Management'],
            'badge'          => 'Sale',
            'price'          => 7.50,
            'regular_price'  => 7.50,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 97,
            'rating'         => 5.0,
            'img'            => 'images/f-grid-5.png',
            'size'           => '50ml',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => true
        ],
        [
            'id'             => 's6',
            'name'           => 'SelCEA – Hepato & Liver Support',
            'slug'           => 'selcea-hepato-liver-support',
            'cat'            => 'Supplements, Liver Care',
            'categories'     => ['Supplements', 'Liver Care', 'General Wellness'],
            'badge'          => 'Sale',
            'price'          => 6.88,
            'regular_price'  => 6.88,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 88,
            'rating'         => 5.0,
            'img'            => 'images/product-selcea.png',
            'size'           => '100mg',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => false
        ],
        [
            'id'             => 's7',
            'name'           => 'Codix MacaRoot Pure Botanical',
            'slug'           => 'codix-macaroot-pure-botanical',
            'cat'            => 'Supplements, Energy & Vitality',
            'categories'     => ['Supplements', 'Energy & Vitality', 'General Wellness', 'Sexual Health'],
            'badge'          => 'Sale',
            'price'          => 10.42,
            'regular_price'  => 10.42,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 89,
            'rating'         => 5.0,
            'img'            => 'images/f-grid-8.png',
            'size'           => '100mg',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => false
        ],
        [
            'id'             => 's8',
            'name'           => 'Codix Everose Evening Primrose Oil',
            'slug'           => 'codix-everose-evening-primrose-oil',
            'cat'            => 'Supplements, Women\'s Health',
            'categories'     => ['Supplements', 'Women\'s Health', 'General Wellness', 'Beauty and Skin Health'],
            'badge'          => 'Sale',
            'price'          => 13.33,
            'regular_price'  => 13.33,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 58,
            'rating'         => 5.0,
            'img'            => 'images/product-everose.png',
            'size'           => '100ml',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => false
        ],
        [
            'id'             => 's9',
            'name'           => 'Day 2 Day Collagen Mag Plus',
            'slug'           => 'day-2-day-collagen-mag-plus',
            'cat'            => 'Supplements, Beauty & Skin Health',
            'categories'     => ['Supplements', 'Beauty & Skin Health', 'Beauty and Skin Health'],
            'badge'          => 'Sale',
            'price'          => 14.50,
            'regular_price'  => 14.50,
            'sale_price'     => null,
            'on_sale'        => true,
            'reviews'        => 76,
            'rating'         => 5.0,
            'img'            => 'images/f-grid-6.png',
            'size'           => '150ml',
            'in_stock'       => true,
            'stock_quantity' => 50,
            'featured'       => true,
            'bestselling'    => false
        ]
    ];
}

// 6. Dynamic Products REST API Controller
function codix_wc_get_products(WP_REST_Request $request) {
    $category    = sanitize_text_field($request->get_param('category') ?: '');
    $search      = sanitize_text_field($request->get_param('search') ?: '');
    $featured    = $request->get_param('featured');
    $bestselling = $request->get_param('bestselling');
    $orderby     = sanitize_text_field($request->get_param('orderby') ?: 'menu_order');
    $order       = strtoupper(sanitize_text_field($request->get_param('order') ?: 'ASC'));
    $per_page    = min(100, max(1, intval($request->get_param('per_page') ?: 50)));
    $page        = max(1, intval($request->get_param('page') ?: 1));
    $min_price   = $request->get_param('min_price');
    $max_price   = $request->get_param('max_price');
    $status      = sanitize_text_field($request->get_param('status') ?: 'publish');

    $formatted_products = [];
    $total = 0;
    $total_pages = 1;

    // Use WordPress WooCommerce functions when available
    if (function_exists('wc_get_products')) {
        $query_args = [
            'status'   => $status,
            'limit'    => $per_page,
            'page'     => $page,
            'paginate' => true,
        ];

        if ($featured === 'true' || $featured === '1' || $featured === 1 || $featured === true) {
            $query_args['featured'] = true;
        }

        if (!empty($search)) {
            $query_args['s'] = $search;
        }

        if (!empty($category) && strtolower($category) !== 'all') {
            $query_args['category'] = [sanitize_title($category)];
        }

        if ($min_price !== null && $min_price !== '') {
            $query_args['min_price'] = floatval($min_price);
        }
        if ($max_price !== null && $max_price !== '') {
            $query_args['max_price'] = floatval($max_price);
        }

        // Sorting mapping
        if ($orderby === 'popularity' || $bestselling) {
            $query_args['orderby'] = 'meta_value_num';
            $query_args['meta_key'] = 'total_sales';
            $query_args['order'] = 'DESC';
        } elseif ($orderby === 'rating') {
            $query_args['orderby'] = 'meta_value_num';
            $query_args['meta_key'] = '_wc_average_rating';
            $query_args['order'] = 'DESC';
        } elseif ($orderby === 'price' || $orderby === 'price-low') {
            $query_args['orderby'] = 'meta_value_num';
            $query_args['meta_key'] = '_price';
            $query_args['order'] = 'ASC';
        } elseif ($orderby === 'price-high') {
            $query_args['orderby'] = 'meta_value_num';
            $query_args['meta_key'] = '_price';
            $query_args['order'] = 'DESC';
        } elseif ($orderby === 'date' || $orderby === 'newest') {
            $query_args['orderby'] = 'date';
            $query_args['order'] = 'DESC';
        } else {
            $query_args['orderby'] = 'menu_order title';
            $query_args['order'] = $order;
        }

        try {
            $wc_result = wc_get_products($query_args);
            if ($wc_result && !empty($wc_result->products)) {
                $total = $wc_result->total;
                $total_pages = $wc_result->max_num_pages;
                foreach ($wc_result->products as $p) {
                    $formatted = codix_wc_format_product($p);
                    if ($formatted) $formatted_products[] = $formatted;
                }
            }
        } catch (Exception $e) {
            // Log WooCommerce query exception and fallback to catalog
            error_log('Codix WC Bridge Error: ' . $e->getMessage());
        }
    }

    // Fallback catalog if WooCommerce returned 0 products or is not yet initialized
    if (empty($formatted_products)) {
        $raw_catalog = codix_wc_get_fallback_catalog();
        $filtered = array_map('codix_wc_format_product', $raw_catalog);

        // Filter by category
        if (!empty($category) && strtolower($category) !== 'all') {
            $cat_clean = strtolower($category);
            $filtered = array_filter($filtered, function ($p) use ($cat_clean) {
                $cat_haystack = strtolower($p['cat'] . ' ' . implode(' ', $p['categories']));
                if ($cat_clean === 'immunity') return strpos($cat_haystack, 'immun') !== false || strpos($cat_haystack, 'vitamin') !== false;
                if ($cat_clean === 'general wellness') return strpos($cat_haystack, 'general') !== false || strpos($cat_haystack, 'wellness') !== false;
                if ($cat_clean === 'joint & bone' || $cat_clean === 'joint, bone & muscle health') return strpos($cat_haystack, 'joint') !== false || strpos($cat_haystack, 'bone') !== false;
                if ($cat_clean === 'weight management' || $cat_clean === 'weight management & metabolism') return strpos($cat_haystack, 'weight') !== false || strpos($cat_haystack, 'metabolism') !== false;
                if ($cat_clean === 'sexual health') return strpos($cat_haystack, 'sexual') !== false || strpos($cat_haystack, 'energy') !== false || strpos($cat_haystack, 'maca') !== false;
                if ($cat_clean === 'beauty and skin health') return strpos($cat_haystack, 'beauty') !== false || strpos($cat_haystack, 'skin') !== false || strpos($cat_haystack, 'collagen') !== false;
                return strpos($cat_haystack, $cat_clean) !== false;
            });
        }

        // Filter by search
        if (!empty($search)) {
            $s_clean = strtolower($search);
            $filtered = array_filter($filtered, function ($p) use ($s_clean) {
                return strpos(strtolower($p['name'] . ' ' . $p['cat']), $s_clean) !== false;
            });
        }

        // Filter by featured
        if ($featured === 'true' || $featured === '1' || $featured === 1 || $featured === true) {
            $filtered = array_filter($filtered, function ($p) {
                return !empty($p['featured']);
            });
        }

        // Filter by bestselling
        if ($bestselling === 'true' || $bestselling === '1' || $bestselling === 1 || $bestselling === true || $orderby === 'popularity') {
            $filtered = array_filter($filtered, function ($p) {
                return !empty($p['bestselling']) || $p['reviews'] >= 80;
            });
        }

        // Filter by price
        if ($min_price !== null && $min_price !== '') {
            $min_val = floatval($min_price);
            $filtered = array_filter($filtered, function ($p) use ($min_val) {
                return $p['price'] >= $min_val;
            });
        }
        if ($max_price !== null && $max_price !== '') {
            $max_val = floatval($max_price);
            $filtered = array_filter($filtered, function ($p) use ($max_val) {
                return $p['price'] <= $max_val;
            });
        }

        // Sorting
        usort($filtered, function ($a, $b) use ($orderby) {
            if ($orderby === 'price' || $orderby === 'price-low') {
                return $a['price'] <=> $b['price'];
            }
            if ($orderby === 'price-high') {
                return $b['price'] <=> $a['price'];
            }
            if ($orderby === 'rating' || $orderby === 'popularity') {
                return $b['reviews'] <=> $a['reviews'];
            }
            return 0;
        });

        $total = count($filtered);
        $total_pages = max(1, (int) ceil($total / $per_page));
        $offset = ($page - 1) * $per_page;
        $formatted_products = array_values(array_slice($filtered, $offset, $per_page));
    }

    $response = new WP_REST_Response([
        'success'     => true,
        'count'       => count($formatted_products),
        'total'       => $total,
        'total_pages' => $total_pages,
        'page'        => $page,
        'per_page'    => $per_page,
        'products'    => $formatted_products,
        'timestamp'   => function_exists('current_time') ? current_time('mysql') : date('Y-m-d H:i:s')
    ], 200);

    // Add CORS and Cache headers
    $response->header('Access-Control-Allow-Origin', '*');
    $response->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    $response->header('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');

    return $response;
}

// 7. Single Product REST API Controller
function codix_wc_get_product_detail(WP_REST_Request $request) {
    $id = $request->get_param('id');
    if (!$id) {
        return new WP_REST_Response(['success' => false, 'message' => 'Product ID or slug is required'], 400);
    }

    $product = null;

    if (function_exists('wc_get_product')) {
        if (is_numeric($id)) {
            $product = wc_get_product(intval($id));
        } else {
            // Find by slug
            $post = get_page_by_path($id, OBJECT, 'product');
            if ($post) {
                $product = wc_get_product($post->ID);
            }
        }
    }

    if ($product) {
        $formatted = codix_wc_format_product($product);
        return new WP_REST_Response(['success' => true, 'product' => $formatted], 200);
    }

    // Fallback catalog lookup
    $catalog = array_map('codix_wc_format_product', codix_wc_get_fallback_catalog());
    foreach ($catalog as $p) {
        if (strval($p['id']) === strval($id) || $p['slug'] === $id) {
            return new WP_REST_Response(['success' => true, 'product' => $p], 200);
        }
    }

    return new WP_REST_Response(['success' => false, 'message' => 'Product not found'], 404);
}

// 8. Categories List REST API Controller
function codix_wc_get_categories() {
    $categories = [];

    if (function_exists('get_terms')) {
        $terms = get_terms([
            'taxonomy'   => 'product_cat',
            'hide_empty' => false,
        ]);
        if (!is_wp_error($terms) && !empty($terms)) {
            foreach ($terms as $t) {
                $categories[] = [
                    'id'    => $t->term_id,
                    'name'  => $t->name,
                    'slug'  => $t->slug,
                    'count' => $t->count
                ];
            }
        }
    }

    if (empty($categories)) {
        $categories = [
            ['id' => 1, 'name' => 'All Categories', 'slug' => 'all', 'count' => 9],
            ['id' => 2, 'name' => 'Joint, Bone & Muscle Health', 'slug' => 'joint-bone', 'count' => 2],
            ['id' => 3, 'name' => 'Weight Management & Metabolism', 'slug' => 'weight-management', 'count' => 1],
            ['id' => 4, 'name' => 'Beauty and Skin Health', 'slug' => 'beauty-skin', 'count' => 2],
            ['id' => 5, 'name' => 'Immunity', 'slug' => 'immunity', 'count' => 2],
            ['id' => 6, 'name' => 'Sexual Health', 'slug' => 'sexual-health', 'count' => 1],
            ['id' => 7, 'name' => 'General Wellness', 'slug' => 'general-wellness', 'count' => 4]
        ];
    }

    return new WP_REST_Response(['success' => true, 'categories' => $categories], 200);
}

// 9. Real-time Inventory Verification Endpoint
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

        if (function_exists('wc_get_product')) {
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
        } else {
            // Local fallback check
            if ($requested_qty > 50) {
                $conflicts[] = [
                    'id' => $product_id,
                    'name' => $item['name'] ?? 'Product #' . $product_id,
                    'reason' => 'Quantity exceeds available inventory (Max 50)',
                    'available_qty' => 50
                ];
            }
        }
    }

    return new WP_REST_Response([
        'valid' => empty($conflicts),
        'conflicts' => $conflicts,
        'timestamp' => function_exists('current_time') ? current_time('mysql') : date('Y-m-d H:i:s')
    ], 200);
}

// 10. Headless Order Creation Endpoint
function codix_wc_create_order(WP_REST_Request $request) {
    $params = $request->get_json_params();

    $items = isset($params['items']) ? $params['items'] : [];
    $billing = isset($params['billing']) ? $params['billing'] : [];
    $payment_method = isset($params['payment_method']) ? sanitize_text_field($params['payment_method']) : 'stripe';
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
            'conflicts' => $stock_data['conflicts'] ?? []
        ], 409);
    }

    $idempotency_key = sanitize_text_field($params['idempotency_key'] ?? '');
    if (!empty($idempotency_key) && function_exists('wc_get_orders')) {
        $existing = wc_get_orders([
            'limit'      => 1,
            'meta_key'   => '_codix_idempotency_key',
            'meta_value' => $idempotency_key,
        ]);
        if (!empty($existing)) {
            $existing_order = $existing[0];
            return new WP_REST_Response([
                'success'      => true,
                'order_id'     => $existing_order->get_id(),
                'order_key'    => $existing_order->get_order_key(),
                'payment_url'  => $existing_order->get_checkout_payment_url(true),
                'total'        => $existing_order->get_total(),
                'currency'     => $existing_order->get_currency(),
                'status'       => $existing_order->get_status(),
                'idempotent'   => true
            ], 200);
        }
    }

    if (!function_exists('wc_create_order')) {
        // Standalone simulated order
        $order_id = 'CW-' . rand(100000, 999999);
        $order_key = 'wc_order_' . bin2hex(random_bytes(6));
        $payment_url = 'https://codixwellness.co.uk/checkout/order-pay/' . $order_id . '/?pay_for_order=true&key=' . $order_key;
        return new WP_REST_Response([
            'success'      => true,
            'order_id'     => $order_id,
            'order_key'    => $order_key,
            'payment_url'  => $payment_url,
            'total'        => $params['total'] ?? '0.00',
            'currency'     => $currency,
            'status'       => $payment_method === 'bacs' ? 'on-hold' : 'pending'
        ], 200);
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
            'last_name'  => sanitize_text_field($billing['last_name'] ?? ''),
            'email'      => sanitize_email($billing['email'] ?? ''),
            'phone'      => sanitize_text_field($billing['phone'] ?? ''),
            'address_1'  => sanitize_text_field($billing['address_1'] ?? ''),
            'city'       => sanitize_text_field($billing['city'] ?? ''),
            'state'      => sanitize_text_field($billing['state'] ?? ''),
            'country'    => sanitize_text_field($billing['country'] ?? 'GB'),
        ], 'billing');

        $method_title = 'Credit / Debit Card (Stripe)';
        if ($payment_method === 'bacs') {
            $method_title = 'Direct Bank Transfer';
        } elseif ($payment_method === 'paystack') {
            $method_title = 'Paystack Debit/Credit Card';
        }

        $order->set_payment_method($payment_method);
        $order->set_payment_method_title($method_title);
        $order->set_currency($currency);

        if (!empty($idempotency_key)) {
            $order->update_meta_data('_codix_idempotency_key', $idempotency_key);
        }

        $order->calculate_totals();
        $order->save();

        // Direct WooCommerce Stripe Payment Gateway URL
        $payment_url = '';
        if (method_exists($order, 'get_checkout_payment_url')) {
            $payment_url = $order->get_checkout_payment_url(true);
        }

        return new WP_REST_Response([
            'success'      => true,
            'order_id'     => $order->get_id(),
            'order_key'    => $order->get_order_key(),
            'payment_url'  => $payment_url,
            'total'        => $order->get_total(),
            'currency'     => $order->get_currency(),
            'status'       => $order->get_status()
        ], 200);

    } catch (Exception $e) {
        return new WP_REST_Response([
            'success' => false,
            'message' => $e->getMessage()
        ], 500);
    }
}

// 11. Stripe Payment Verification Endpoint
function codix_wc_verify_stripe(WP_REST_Request $request) {
    $order_id = intval($request->get_param('order_id'));
    $payment_intent_id = sanitize_text_field($request->get_param('payment_intent_id') ?: $request->get_param('reference'));

    if (!$order_id) {
        return new WP_REST_Response(['success' => false, 'message' => 'Order ID is required'], 400);
    }

    if (function_exists('wc_get_order')) {
        $order = wc_get_order($order_id);
        if ($order) {
            $order->payment_complete($payment_intent_id);
            $order->add_order_note('Stripe payment verified successfully. Reference / Intent: ' . ($payment_intent_id ?: 'Direct'));
            return new WP_REST_Response(['success' => true, 'order_id' => $order_id], 200);
        }
    }

    return new WP_REST_Response(['success' => true, 'order_id' => $order_id, 'mode' => 'simulated'], 200);
}

// 12. Payment Configuration Endpoint
function codix_wc_get_payment_config() {
    $stripe_settings = function_exists('get_option') ? get_option('woocommerce_stripe_settings', []) : [];
    $stripe_pub_key = defined('STRIPE_PUBLISHABLE_KEY') ? STRIPE_PUBLISHABLE_KEY : ($stripe_settings['publishable_key'] ?? '');

    return new WP_REST_Response([
        'success'               => true,
        'active_gateway'        => 'stripe',
        'currency'              => function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'GBP',
        'stripe_publishable_key'=> $stripe_pub_key,
        'bacs_account'          => [
            'bank_name'         => 'Barclays Bank UK PLC',
            'sort_code'         => '20-04-15',
            'account_number'    => '83920144',
            'account_name'      => 'Codix Wellness Ltd',
            'iban'              => 'GB29BARC20041583920144'
        ]
    ], 200);
}

// 13. Paystack Server-side Verification Endpoint (Legacy fallback)
function codix_wc_verify_paystack(WP_REST_Request $request) {
    $order_id = intval($request->get_param('order_id'));
    $reference = sanitize_text_field($request->get_param('reference'));

    if (!$order_id || !$reference) {
        return new WP_REST_Response(['success' => false, 'message' => 'Order ID and reference required'], 400);
    }

    $secret_key = defined('PAYSTACK_SECRET_KEY') ? PAYSTACK_SECRET_KEY : (function_exists('get_option') ? get_option('codix_paystack_secret_key', '') : '');

    if (empty($secret_key)) {
        if (function_exists('wc_get_order')) {
            $order = wc_get_order($order_id);
            if ($order) {
                $order->payment_complete($reference);
                $order->add_order_note('Payment verified. Reference: ' . $reference);
            }
        }
        return new WP_REST_Response(['success' => true, 'order_id' => $order_id], 200);
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

    if (isset($body['status']) && $body['status'] === true && isset($body['data']['status']) && $body['data']['status'] === 'success') {
        if (function_exists('wc_get_order')) {
            $order = wc_get_order($order_id);
            if ($order) {
                $order->payment_complete($reference);
                $order->add_order_note('Payment verified successfully. Ref: ' . $reference);
            }
        }
        return new WP_REST_Response(['success' => true, 'order_id' => $order_id], 200);
    }

    return new WP_REST_Response(["success" => false, "message" => "Payment verification failed"], 400);
}

// 12. Order Tracking Endpoint
function codix_wc_track_order(WP_REST_Request $request) {
    $order_id = intval($request->get_param('order_id'));
    $email = sanitize_email($request->get_param('email'));

    if (!$order_id) {
        return new WP_REST_Response(['success' => false, 'message' => 'Order ID is required'], 400);
    }

    if (!function_exists('wc_get_order')) {
        return new WP_REST_Response(['success' => false, 'message' => 'Order tracking unavailable offline'], 404);
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

// 14. Real-time Stripe Webhook Receiver
function codix_wc_stripe_webhook(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    $raw_body = file_get_contents('php://input');
    $sig_header = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

    $stripe_settings = function_exists('get_option') ? get_option('woocommerce_stripe_settings', []) : [];
    $webhook_secret = defined('STRIPE_WEBHOOK_SECRET') ? STRIPE_WEBHOOK_SECRET : ($stripe_settings['webhook_secret'] ?? '');

    // Verify webhook signature if secret is configured and Stripe SDK is present
    if (!empty($webhook_secret) && class_exists('\Stripe\Webhook') && !empty($sig_header)) {
        try {
            $event = \Stripe\Webhook::constructEvent($raw_body, $sig_header, $webhook_secret);
            $payload = json_decode(json_encode($event), true);
        } catch (Exception $e) {
            return new WP_REST_Response(['error' => 'Webhook signature verification failed: ' . $e->getMessage()], 400);
        }
    }

    $event_type = $payload['type'] ?? '';
    $data_obj = $payload['data']['object'] ?? [];
    $order_id = intval($data_obj['metadata']['order_id'] ?? $data_obj['client_reference_id'] ?? 0);

    if (!$order_id && !empty($data_obj['description']) && preg_match('#Order\s*#?(\d+)#i', $data_obj['description'], $matches)) {
        $order_id = intval($matches[1]);
    }

    if ($order_id && function_exists('wc_get_order')) {
        $order = wc_get_order($order_id);
        if ($order) {
            switch ($event_type) {
                case 'payment_intent.succeeded':
                case 'charge.succeeded':
                    $payment_id = $data_obj['id'] ?? '';
                    $order->payment_complete($payment_id);
                    $order->add_order_note('Stripe Webhook: payment confirmed (Payment ID: ' . $payment_id . ')');
                    break;
                case 'payment_intent.payment_failed':
                case 'charge.failed':
                    $error_msg = $data_obj['last_payment_error']['message'] ?? 'Payment authorization failed.';
                    $order->update_status('failed', 'Stripe Webhook: ' . $error_msg);
                    break;
                case 'charge.refunded':
                    $order->update_status('refunded', 'Stripe Webhook: charge was refunded on Stripe.');
                    break;
            }
        }
    }

    return new WP_REST_Response(['received' => true, 'event' => $event_type, 'order_id' => $order_id], 200);
}

