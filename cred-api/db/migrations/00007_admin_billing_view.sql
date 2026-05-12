INSERT INTO subscriptions (user_id, plan_name, price, period, status, current_period_end, paddle_subscription_id, reviews_limit)
VALUES (1, 'Growth', 66, 'annual', 'active', NOW() + INTERVAL '11 months', 'sub_demo_admin', 500)
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (user_id, brand, last4, expiry)
VALUES (1, 'Visa', '4242', '08/27')
ON CONFLICT DO NOTHING;

INSERT INTO invoices (user_id, paddle_invoice_id, amount, currency, status, download_url, created_at)
VALUES
  (1, 'inv_demo_1', 6600, 'USD', 'paid', 'https://example.com/inv_demo_1', NOW() - INTERVAL '1 month'),
  (1, 'inv_demo_2', 7900, 'USD', 'paid', 'https://example.com/inv_demo_2', NOW() - INTERVAL '13 months')
ON CONFLICT DO NOTHING;
