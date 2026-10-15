'use strict';
// Seed content. Everything here is editable from /admin after first run.
// Only facts supplied by ARSARA's owner or visible on the supplied pouch photo are used.
// Anything unknown (company name, address, FSSAI number, grievance officer) is left blank and flagged in the admin.

const CONTENT_DATE = '2026-10-15T00:00:00.000Z';

const settings = {
  site_name: 'ARSARA',
  tagline: 'Born of the Himalayas.',
  business_legal_name: '',
  whatsapp: '919103409968',
  whatsapp_display: '+91 91034 09968',
  email: 'arsarafoods@gmail.com',
  address: '',
  fssai_number: '',
  grievance_officer: '',
  instagram_handle: '@arsara.in',
  instagram_url: 'https://www.instagram.com/arsara.in/',
  x_handle: '@arsarafoods',
  x_url: 'https://x.com/arsarafoods',
  shipping_fee_paise: 6000,
  free_shipping_threshold_paise: 99900,
  report_window_hours: 48,
  refund_initiation_days: '5–7',
  logo_path: '/img/logo-full.png',
  emblem_path: '/img/logo-emblem.png',
  site_url: '',
  home: [
    {
      id: 'hero', visible: true,
      eyebrow: 'Premium Himalayan pantry',
      headline: 'Born of the Himalayas.',
      body: 'Discover the distinctive character of Bhaderwahi Rajma, rooted in the mountain heritage of Jammu & Kashmir.',
      cta1_label: 'Discover Our Story', cta1_href: '/story',
      cta2_label: 'Explore the Pantry', cta2_href: '/shop'
    },
    {
      id: 'origin', visible: true,
      eyebrow: 'The origin',
      headline: 'Some flavours begin with a place.',
      body: 'Bhaderwah is a mountain valley town in the Doda district of Jammu & Kashmir, and it is the name this rajma carries.\n\nARSARA is built around regional food that is named honestly: the place first, then the product. We will share more about the origin as we can verify it, and we will not claim what we cannot prove.',
      cta_label: 'Discover the Origin', cta_href: '/story#origin'
    },
    {
      id: 'bean', visible: true,
      eyebrow: 'The character of the bean',
      headline: 'Nature has its own signature.',
      body: 'A deep burgundy skin. A smooth, kidney-shaped body. A pale eye on the curve. Look closely at what is in the pouch.'
    },
    {
      id: 'product', visible: true,
      eyebrow: 'The pantry',
      headline: 'One pouch. One place.',
      body: 'Whole dried rajma, packed in a resealable kraft pouch.',
      cta_label: 'Discover Bhaderwahi Rajma'
    },
    { id: 'kitchen', visible: true, eyebrow: 'The Himalayan kitchen', headline: 'From pouch to plate.' },
    {
      id: 'philosophy', visible: true,
      eyebrow: 'The ARSARA philosophy',
      headline: 'Regional food, plainly told.',
      items: [
        { title: 'Name the place', text: 'Every product is introduced by where it comes from.' },
        { title: 'Say only what is true', text: 'No borrowed certifications, no invented stories. If we cannot verify it, it is not on the page.' },
        { title: 'Start small, grow carefully', text: 'One product today. More regional foods from Jammu & Kashmir when each is ready.' }
      ]
    },
    {
      id: 'final', visible: true,
      headline: 'Bring a little of the Himalayas home.',
      cta_label: 'Explore the Pantry', cta_href: '/shop'
    }
  ],
  recipe: {
    title: 'Home-style rajma masala',
    intro: 'A classic, slow-simmered rajma. Quantities are a starting point; adjust to your taste.',
    serves: 'Serves 3–4',
    soak: 'Soak 8–12 hours',
    cook: 'Cook until fully soft',
    ingredients: [
      '1 cup (about 200 g) ARSARA Bhaderwahi Rajma',
      '2 tbsp oil or ghee',
      '1 tsp cumin seeds',
      '2 medium onions, finely chopped',
      '1 tbsp ginger-garlic paste',
      '3 medium tomatoes, pureed',
      '1 tsp coriander powder',
      '1 tsp red chilli powder, or to taste',
      '½ tsp turmeric powder',
      '1 tsp garam masala',
      'Salt to taste',
      'Fresh coriander to finish'
    ],
    steps: [
      'Rinse the rajma and soak it in plenty of water for 8–12 hours. Drain and discard the soaking water.',
      'Cook the beans in fresh water until completely soft and easily mashed between your fingers. A pressure cooker is quickest; cooking time varies, so test a bean. Kidney beans must always be cooked until fully tender and never eaten undercooked.',
      'Heat the oil or ghee. Add the cumin seeds, then the onions, and cook until golden brown.',
      'Add the ginger-garlic paste and cook for a minute. Add the tomato puree, coriander, chilli, turmeric and a little salt. Cook until the oil begins to separate.',
      'Add the cooked rajma with some of its cooking liquid. Simmer for 15–20 minutes, mashing a few beans against the pot to thicken the gravy.',
      'Stir in the garam masala and fresh coriander. Serve hot with rice or roti.'
    ],
    note: 'Cooking times depend on the beans, your cookware and altitude.'
  }
};

const rajma = {
  slug: 'bhaderwahi-rajma-500g',
  name: 'ARSARA Bhaderwahi Rajma',
  short_description: 'Whole dried rajma from Bhaderwah, Jammu & Kashmir, in a 500 g resealable kraft pouch.',
  description: 'ARSARA Bhaderwahi Rajma is whole dried kidney bean (rajma) with a deep burgundy colour, packed in a 500 g resealable kraft pouch with a window so you can see the beans.\n\nThe pack is marked “Authentic Himalayan Origin” and carries the origin name Bhaderwah.',
  price_paise: 39900,
  sku: 'ARS-RAJ-500',
  pack_size: '500 g',
  weight_g: 500,
  stock: 25,
  low_stock_threshold: 5,
  category: 'Himalayan Food / Rajma',
  origin: {
    place: 'Bhaderwah, Jammu & Kashmir',
    note: 'Origin as printed on the pack. Add verified provenance details before publishing any GI or certification claim.'
  },
  specs: [
    { label: 'Pack size', value: '500 g' },
    { label: 'Form', value: 'Whole dried rajma (kidney beans)' },
    { label: 'Origin', value: 'Bhaderwah, Jammu & Kashmir' },
    { label: 'Packaging', value: 'Resealable kraft pouch with window' }
  ],
  images: [
    { src: '/img/pouch.jpg', alt: 'ARSARA Bhaderwah Rajma 500 g kraft pouch with a window showing deep burgundy rajma beans' },
    { src: '/img/beans-wide.jpg', alt: 'Close view of deep burgundy rajma beans seen through the pouch window' }
  ],
  storage_guidance: 'Store in a cool, dry place away from direct sunlight. Reseal the pouch tightly after opening, or move the beans to an airtight container.',
  seo_title: 'Bhaderwahi Rajma 500 g | ARSARA',
  seo_description: 'ARSARA Bhaderwahi Rajma, whole dried rajma from Bhaderwah, Jammu & Kashmir. 500 g resealable pouch.'
};

/* ---------- Pages. Placeholders like {{email}} are filled from admin settings at render time. ---------- */
const pages = {};

pages.about = {
  title: 'Our Story',
  body: `## Where ARSARA begins

ARSARA is a food brand inspired by the Himalayan food heritage of Jammu & Kashmir. The name sits beside a simple emblem: a mountain, a stalk of grain, and a circle that holds them together.

We are starting with one product, Bhaderwahi Rajma, and we want to do that one thing properly before adding another.

## The origin {#origin}

Bhaderwah is a mountain valley town in the Doda district of Jammu & Kashmir. This rajma carries its name, and the pack is marked "Authentic Himalayan Origin".

We keep our claims tied to what we can verify. We do not describe farming methods, farmer relationships, certifications or traditions on this website unless we can stand behind them. As documents and details are confirmed, they will be added here.

## What we are building

A small pantry of regional foods from Jammu & Kashmir, introduced one at a time, each named honestly and packed simply. Rajma comes first. More will follow when each is ready.

## Talk to us

Questions about the product, an order, or where it comes from? Write to [{{email}}](mailto:{{email}}) or message us on [WhatsApp](/contact).
`
};

pages.terms = {
  title: 'Terms of Service',
  body: `These terms govern your use of this website and any order enquiry you make through it. By using the website you agree to them. They do not remove any right you have under applicable consumer law.

## 1. Who we are

This website is operated by {{business}} under the brand ARSARA. {{address_line}}{{fssai_line}}Email: {{email}}. WhatsApp: {{whatsapp}}.

## 2. Using the website

You may browse the website and use the cart and shipping calculator without creating an account or giving personal details. Do not misuse the website, attempt to disrupt it, or access areas that are not meant for the public.

## 3. Products and availability

We describe our products as accurately as we can. Stock shown on the website is a guide and may change. A product shown as available may still become unavailable before we confirm your order.

## 4. Prices and taxes

Prices are shown in Indian rupees (INR). Unless stated otherwise, the displayed price is the price you pay for the product. Any shipping charge is shown separately in the cart before you open WhatsApp. We do not add hidden charges.

## 5. Cart calculations

The cart shows your merchandise subtotal, the shipping charge, and the total payable. Shipping is {{shipping_fee}} when the merchandise subtotal is below {{free_threshold}}, and free when it is {{free_threshold}} or more. The threshold is checked after any discounts and before shipping. The amounts are checked again by our system when you start an enquiry.

## 6. How ordering works: WhatsApp enquiries

Our checkout opens WhatsApp with a pre-filled message that lists your items, quantities and amounts. **Adding a product to the cart, or opening WhatsApp, does not place or complete an order, does not guarantee acceptance, and does not confirm payment.**

An order exists only when we confirm it to you after checking stock and delivery details, and after payment is received through a verified ARSARA payment channel.

## 7. Order acceptance

All orders are subject to stock availability, serviceability of your delivery location and our confirmation. We may decline or cancel an order, for example if a product is unavailable or a delivery address cannot be served. If we cancel an order you have already paid for, we will refund you in line with our [Cancellation Policy](/cancellation).

## 8. Payment

Payment is online only. **Cash on delivery is not available.** Please pay only through a payment channel that ARSARA has confirmed to you directly on our verified WhatsApp number or email. If you are unsure whether a payment request is genuine, contact us before paying.

## 9. Shipping and delivery

See our [Shipping and Delivery Policy](/shipping-policy).

## 10. Cancellation, returns and refunds

See our [Cancellation Policy](/cancellation) and [Returns, Refunds and Replacements Policy](/returns).

## 11. Food storage and safety

Our products are food. Store them as described on the product page and on the pack, and follow the cooking guidance. Rajma (kidney beans) must be soaked and cooked until fully tender before eating. Check the pack and product details for ingredients and allergen information, and do not use a product that appears damaged or tampered with.

## 12. Intellectual property

The ARSARA name, logo, photographs, text and design on this website belong to {{business}} or its licensors. You may not copy or reuse them for commercial purposes without written permission.

## 13. Limits on our liability

To the extent permitted by law, we are not liable for indirect or consequential loss arising from use of the website. Nothing in these terms limits liability that cannot be limited by law, or affects your statutory rights as a consumer, including under the Consumer Protection Act, 2019.

## 14. Governing law and disputes

These terms are governed by the laws of India. We encourage you to contact us first so we can try to resolve any complaint. Subject to your rights as a consumer to approach the appropriate consumer forum, courts at Jammu, Jammu & Kashmir, India have jurisdiction over disputes.

## 15. Support and grievances

To raise a concern, see [Contact and Grievance Information](/grievance).

## 16. Changes

We may update these terms. The "last updated" date on this page shows the latest version. Orders are governed by the terms in force when the order is confirmed.
`
};

pages.privacy = {
  title: 'Privacy Policy',
  body: `This policy explains what personal data {{business}} (ARSARA) handles when you use this website or order through WhatsApp, and why. It reflects how the website actually works today.

## 1. What you can do without giving us any data

You can browse the website, use the cart and calculate shipping without an account and without giving your name, phone number or address.

## 2. What the website processes

- **Your cart.** Your cart (product and quantity) is stored in your own browser using local storage so it is still there when you come back. It is not sent to us until you start a WhatsApp enquiry. You can clear it any time by emptying the cart or clearing your browser data.
- **Server logs.** Like most websites, our server and hosting provider record technical information such as IP address, browser type, pages requested and time. We use this for security and keeping the website running.
- **Enquiry record.** When you press the WhatsApp checkout button, our system creates an enquiry record containing a reference number, the items, quantities, amounts and the time. It does not contain your name, phone number or address. We use it to check prices and stock and to match your WhatsApp message to an enquiry.
- **Fonts.** Our pages load typefaces from Google Fonts, so your browser connects to Google's servers, which receive your IP address and browser details under Google's own privacy practices.

## 3. What you share on WhatsApp

When you message us on WhatsApp you share your phone number and whatever you write, such as your name and delivery address. We use this only to confirm and fulfil your order, to arrange payment, to support you and to keep records we are legally required to keep. WhatsApp is a separate platform run by a third party with its own privacy practices; we do not control how WhatsApp handles data. Please read WhatsApp's privacy information.

If your order goes ahead, we may record your name, phone number, delivery address, payment confirmation status and delivery details in our order records, because we need them to deliver and support your order.

## 4. Cookies, analytics and tracking

The public website does not set cookies and does not use advertising pixels or analytics tools. Your cart uses local storage, which is strictly necessary for the cart to work. Cookies are used only for the administrators' login on the admin area.

## 5. Why we process data and on what basis

We process data to fulfil your orders and support you, to keep the website secure, to keep business and tax records, and to meet legal obligations. Where the law requires consent, for example for anything beyond these purposes, we will ask for it. We do not require marketing consent to place an order, and we do not send marketing messages unless you ask us to.

## 6. Who we share data with

We share only what is needed with: our website hosting provider; payment and banking providers when you pay; delivery partners, who receive your name, phone number and delivery address so a parcel can reach you; and authorities where the law requires it. We do not sell your personal data.

## 7. How long we keep data

Enquiry records and order records are kept for as long as needed to fulfil orders, handle returns, refunds and complaints, and to meet accounting and legal record-keeping requirements. After that we delete or anonymise them. Server logs are kept for a limited period for security.

## 8. Your rights

Under India's Digital Personal Data Protection Act, 2023 and related rules, you may ask to access the personal data we hold about you, to have it corrected or erased, and to raise a grievance. We will not delete data we must keep by law, and we will tell you if that applies.

## 9. How to make a privacy request

Email {{email}} or message us on WhatsApp at {{whatsapp}} with "Privacy request" and your order reference if you have one. We may ask you to confirm your identity before acting on a request. If you are not satisfied with our response, see [Contact and Grievance Information](/grievance).

## 10. Children

This website is for adults making purchases. We do not knowingly collect data from children.

## 11. Changes

We will update this page if our practices change, and the "last updated" date will change with it.
`
};

pages.shipping = {
  title: 'Shipping and Delivery Policy',
  body: `## Shipping charges

| Merchandise subtotal | Shipping |
| --- | --- |
| Below {{free_threshold}} | {{shipping_fee}} flat domestic shipping |
| {{free_threshold}} or more | Free |

- The free-shipping threshold is checked on the merchandise subtotal after any discounts and before shipping.
- The shipping charge is calculated automatically in your cart and is shown in the WhatsApp message before you send it. There are no hidden charges.
- The shipping calculator needs no personal information.

## Delivery areas

We ship within India. Delivery depends on whether your location can be served by our delivery partners, so we confirm serviceability when we confirm your order. We do not promise that every pin code can be reached.

## Delivery times

We will tell you the expected delivery time when we confirm your order, based on our actual dispatch and courier arrangements for your location. We do not guarantee a fixed delivery date.

## Dispatch and tracking

Once your order is dispatched we will share tracking information where the delivery partner provides it.

## Delays, failed deliveries and undeliverable parcels

If there is a delay, we will tell you what we know. If a delivery fails, we will contact you to arrange another attempt. If a parcel cannot be delivered and is returned to us, we will contact you about re-sending it or refunding the amount paid, in line with our [Cancellation Policy](/cancellation). Please make sure your address and phone number are correct and that someone can receive the parcel.

## Damaged, wrong or missing items

See the [Returns, Refunds and Replacements Policy](/returns).

## Orders and payment

Orders are confirmed through WhatsApp after payment by a verified ARSARA payment channel. Cash on delivery is not available. See our [Terms of Service](/terms).
`
};

pages.returns = {
  title: 'Returns, Refunds and Replacements Policy',
  body: `ARSARA sells packaged food, so our returns approach is built around product problems rather than change of mind.

## When we investigate a claim

Please contact us if:

- you received the wrong product,
- the product arrived damaged,
- the pack shows signs of tampering,
- an item is missing from your order,
- the product is materially different from its description, or
- the product has a genuine defect or other valid problem.

## Please record your unboxing

To help us investigate quickly, we ask you to record a clear, continuous, unedited video that shows the sealed parcel before you open it, the opening, and the condition of the product. Photographs of the parcel, the label and the product, your order reference, and a short explanation of the problem also help.

The video is to help us understand what happened. **It is not an absolute condition.** If you do not have a video, tell us anyway; we will assess your claim fairly using whatever information is available, and your rights under applicable consumer law are not affected.

## Reporting window

Please report a problem within {{report_hours}} hours of delivery wherever possible, so we can investigate while the facts are fresh. This is a preferred reporting period only. It does not override any right you have under the law.

## How to submit a claim

1. Email {{email}} or message {{whatsapp}} on WhatsApp.
2. Include your order reference, what is wrong, and your photos or video.
3. We will acknowledge your message, may ask for more detail, and will tell you the outcome of our investigation.

## Remedies

If your claim is valid, we will provide an appropriate remedy, which may be a replacement or a refund, depending on the circumstances and availability. We cannot promise an unconditional refund for every complaint, and we will not reject a genuine claim only because a video is missing.

## Opened products and change of mind

Opened food products are not ordinarily eligible for return or refund for change of mind, subject to applicable law.

## Refunds

Approved refunds on prepaid orders are made to the original payment method. See the [Cancellation Policy](/cancellation) for timing.
`
};

pages.cancellation = {
  title: 'Cancellation Policy',
  body: `## Cancelling an order

- You may ask us to cancel an order **before it is dispatched**. Contact us on WhatsApp at {{whatsapp}} or by email at {{email}} with your order reference.
- Cancellation **after dispatch is not guaranteed**, because the parcel is already with the delivery partner. We will tell you what is possible.
- Your rights if a product arrives damaged, wrong or defective remain available after dispatch. See the [Returns, Refunds and Replacements Policy](/returns).

## Refunds for cancelled and eligible prepaid orders

- Approved refunds for eligible prepaid orders are initiated to the **original payment method**.
- We aim to initiate approved refunds within **{{refund_days}} business days**, subject to our actual operational capability and applicable law.
- The time we take to initiate a refund is different from the time your bank or payment provider takes to credit it to your account. Credit times depend on them, and we cannot control them.

## If we cancel

We may cancel an order, for example because a product is out of stock or a location cannot be served. If you have already paid, we will refund the amount paid as described above.

## Opening WhatsApp is not an order

Starting a WhatsApp enquiry from the website does not create a paid order. Nothing is charged until you pay through a verified ARSARA payment channel after we confirm your order.
`
};

pages.grievance = {
  title: 'Contact and Grievance Information',
  body: `## How to reach us

- **WhatsApp:** {{whatsapp}}
- **Email:** {{email}}
{{address_line_list}}{{grievance_line}}
## Raising a complaint

You can raise a complaint about any of the following by email or WhatsApp. Please include your order reference, if you have one, and a short description of the issue.

- **Orders**: confirmation, changes, missing items
- **Delivery**: delays, failed delivery, tracking
- **Payments**: payment channel questions, duplicate or failed payments
- **Cancellations**
- **Refunds**
- **Replacements**
- **Privacy**: access, correction or deletion of your data

## What happens next

We will acknowledge your complaint, look into it and reply with the outcome. If you are not satisfied with our response you may reply to ask for it to be reviewed again. Your rights under applicable consumer law, including the right to approach the appropriate consumer forum or the National Consumer Helpline, remain available to you at all times.

## Related policies

[Terms of Service](/terms) · [Privacy Policy](/privacy) · [Shipping and Delivery](/shipping-policy) · [Returns, Refunds and Replacements](/returns) · [Cancellation](/cancellation)
`
};

module.exports = { settings, rajma, pages, CONTENT_DATE };
