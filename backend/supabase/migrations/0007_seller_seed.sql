-- SpaceFit seller-ecosystem seed: default storefront settings.
-- Idempotent: safe to re-run.
--
-- NOTE: seller applications, sellers, reviews and returns all reference auth
-- users / orders, so they cannot be seeded with plain SQL. Create the admin
-- user through the dashboard (see supabase/README.md), then run the onboarding
-- flow once to populate demo data — or use the in-memory backend, which seeds
-- a full demo scenario automatically.

insert into public.store_settings (key, value) values
  (
    'policies',
    '{
      "returnPolicy": "SpaceFit accepts returns within 7 days of delivery for items in original condition. Custom-made pieces are final sale. Approved refunds are issued to the original payment method within 10 business days.",
      "sellerPolicy": "Sellers on SpaceFit are reviewed before approval. Sellers must list authentic, accurately described goods, respond to buyer enquiries within 48 hours, and honour the SpaceFit return window. Breaches may lead to suspension.",
      "deliveryPolicy": "Standard delivery is 2-5 business days within Lagos, Abuja and Ibadan. Nationwide delivery is 5-9 business days. Delivery is free on orders above the free-delivery threshold.",
      "privacyPolicy": "SpaceFit stores only the data needed to fulfil orders and improve your experience. We never sell personal data. Payment details are processed by Paystack and never touch our servers."
    }'::jsonb
  ),
  (
    'discounts',
    '{
      "sitewidePercent": 0,
      "promoCode": "",
      "freeDeliveryThreshold": 500000,
      "bannerEnabled": false
    }'::jsonb
  )
on conflict (key) do nothing;
