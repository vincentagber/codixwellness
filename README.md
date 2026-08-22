# Codix Wellness — E-Commerce Landing Page

A complete, production-ready static frontend implementation of the **Codix Wellness** website, meticulously crafted from the Figma design specification (**Home-Landingpage - Screen.png**).

---

## 🌟 Technologies Used

- **HTML5**: Semantic markup, accessible roles, and ARIA attributes
- **Tailwind CSS (via CDN)**: Utility-first styling with custom color tokens
- **Font Awesome 6.7**: Scalable vector icons
- **Google Fonts (Inter)**: High-legibility typography
- **Vanilla JavaScript**: Modular, high-performance DOM manipulation with zero build step

---

## 🚀 Sections & Features Implemented

1. **Top Promotional Announcement Bar**
   - Background: `#57B952` with subtle dot matrix pattern
   - "Free shipping all orders on over $60."
   - Language selector (`EN`, `ES`, `FR`)
   - Currency selector (`$ USD`, `€ EUR`, `£ GBP`)
   - Account trigger

2. **Header Navigation & Search**
   - Brand logo and fallback typography
   - Search bar with live autocomplete suggestions, clear button, and search triggers
   - Wishlist badge counter and modal
   - Compare products button
   - User account sign-in trigger and modal dialog
   - Interactive cart trigger with quantity badge and live subtotal

3. **Mega Menu & Primary Navigation**
   - "Product Categories" button opening a 4-column mega menu (Supplements, Medicines, Herbs, Featured Offer)
   - Navigation links: *Home, About Us, Shop, Support, Blog*
   - Quick utility icon shortcuts

4. **Hero Product Carousel**
   - Auto-advancing slider with 3 rich slides (*Your Gummie For Men, Codix Everose Daily Care, Flexicod Joint Support*)
   - Pause on hover, arrow controls, and keyboard arrow navigation

5. **Promotional Bento Grid (5 Cards)**
   - *Codix Everose* (Hormonal Balance & Skin)
   - *Flexicod* (Joint Health Support)
   - *Codix Fatburner* (65% OFF Metabolism Support)
   - *Your Gummie Fish Oil* (Omega-3 DHA & EPA)
   - *Codix Vitamin C+D* (Immune Support)

6. **Popular Categories Section**
   - Interactive category tabs (*Supplements*, *Medicines*, *Herbs*)
   - 5-column product cards with badges, star ratings, and "Select options" buttons

7. **PLUS Delivery Membership Banner**
   - Supplement lineup photography
   - "Save unto 10% extra enjoy FREE delivery with PLUS membership"

8. **Featured Products Grid**
   - 15 products in a 5x3 responsive grid matching the design mockup

9. **Special Offers Section**
   - *Move Freely. Live Comfortably.* (Active seniors outdoor photo)
   - *Burn Smarter. Feel Lighter.* (Fitness woman holding supplement photo)

10. **Clients Reviews Carousel**
    - Vibrant gradient background (`#4235AE` to `#703FEF`)
    - Testimonial cards for *Eric Simpson*, *Simons Cooper*, and *Kaleb Yurs* with custom portrait avatars and ratings

11. **Trust & Guarantees Strip**
    - 100% Money back guarantee
    - Non-contact shipping
    - Free delivery over $200

12. **Best Selling Products in... Section**
    - Category switcher and 5-card product display

13. **Our Latest Blog Post Section**
    - High-resolution imagery for Immune System, Skincare Advice, and Supplements Guide

14. **Join Our Newsletter & Brand Logos Strip**
    - Email subscription form with visual feedback
    - Partner brand strip (*Allisa, Amera, Uniter, JUROSA, bticn, Optimize*)

15. **Footer**
    - Distinctive green background (`#57B952`)
    - White pill logo badge
    - Navigation link columns (*Company, Help, Shop*)
    - Pill social media buttons (*Instagram, YouTube, Facebook, LinkedIn, Twitter, TikTok*)
    - Copyright & Payment logos (*Amex, Visa, PayPal, Mastercard*)

16. **Slide-over Drawers, Modals & Micro-Interactions**
    - Slide-over Shopping Cart Drawer with quantity adjusters (+/-), delete item, live subtotal, and checkout
    - Wishlist modal with live item removal and instant add-to-cart
    - Sign In modal with validation
    - Slide-in Mobile Navigation Drawer
    - Toast notifications for real-time user feedback

---

## 📂 Project Structure

```
CodixWellness/
├── index.html                  # Complete all-in-one landing page
├── README.md                   # Documentation & Setup guide
└── images/                     # 20 high-resolution photographic assets
    ├── logo.png
    ├── hero-bg.png
    ├── codix-everose.png
    ├── fatburner.png
    ├── plus-products.jpg
    ├── product-vitamin-cd.jpg
    ├── product-gummie.jpg
    ├── product-capsules.jpg
    ├── product-purple.jpg
    ├── product-red.jpg
    ├── offer-seniors.jpg
    ├── offer-fitness.jpg
    ├── avatar-eric.jpg
    ├── avatar-simons.jpg
    ├── avatar-kaleb.jpg
    ├── blog-capsules.jpg
    ├── blog-skincare.jpg
    └── blog-supplements.jpg
```

---

## 💻 How to View & Test

1. Open `index.html` directly in any modern web browser, or
2. Serve via MAMP: `http://localhost:8888/CodixWellness/index.html`
