INSERT INTO users (id, email, name)
OVERRIDING SYSTEM VALUE
VALUES (1, 'admin@credwave.app', 'Admin')
ON CONFLICT DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  GREATEST(1, (SELECT MAX(id) FROM users))
);
