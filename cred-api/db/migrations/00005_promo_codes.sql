CREATE TABLE promo_codes (
    code VARCHAR(255) PRIMARY KEY,
    duration_days INTEGER NOT NULL,
    max_uses INTEGER,
    use_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
    ADD COLUMN promo_code VARCHAR(255) REFERENCES promo_codes(code),
    ADD COLUMN promo_access_until TIMESTAMP;
