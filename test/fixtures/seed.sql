INSERT INTO users (id, email, full_name, phone) VALUES
  (1, 'alice@corp.example', 'Alice Example', '+1-555-0100'),
  (2, 'bob@corp.example', 'Bob Example', '+1-555-0101');

INSERT INTO products (id, name, sku) VALUES
  (5, 'Widget', 'W-5'),
  (6, 'Gadget', 'G-6'),
  (7, 'Spare', 'S-7');

INSERT INTO orders (id, user_id, status, total_cents) VALUES
  (10, 1, 'paid', 2500),
  (11, 2, 'pending', 900);

INSERT INTO order_items (id, order_id, product_id, quantity) VALUES
  (100, 10, 5, 1),
  (101, 10, 6, 2),
  (102, 11, 5, 1);

SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products));
SELECT setval(pg_get_serial_sequence('orders', 'id'), (SELECT MAX(id) FROM orders));
SELECT setval(pg_get_serial_sequence('order_items', 'id'), (SELECT MAX(id) FROM order_items));
