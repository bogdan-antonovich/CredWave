ALTER TABLE payment_methods
    ADD CONSTRAINT unique_user_payment_method UNIQUE (user_id);
ALTER TABLE invoices
    ADD CONSTRAINT unique_paddle_invoice_id UNIQUE (paddle_invoice_id);
