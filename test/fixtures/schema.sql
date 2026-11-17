CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  sku   TEXT NOT NULL UNIQUE
);

CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL,
  total_cents INTEGER NOT NULL
);

CREATE TABLE order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  product_id  INTEGER NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL
);
