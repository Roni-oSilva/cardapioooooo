-- Esquema inicial do cardápio digital. Valores monetários sempre em centavos (integer).

CREATE TABLE staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','manager','waiter','kitchen')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text,
  user_agent text
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE restaurant_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'Restaurante',
  tagline text NOT NULL DEFAULT '',
  about text NOT NULL DEFAULT '',
  logo_url text,
  hero_image_url text,
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  hours jsonb NOT NULL DEFAULT '[]',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  accepting_orders boolean NOT NULL DEFAULT true,
  allow_dine_in boolean NOT NULL DEFAULT true,
  allow_pickup boolean NOT NULL DEFAULT true,
  allow_delivery boolean NOT NULL DEFAULT false,
  delivery_fee_cents integer NOT NULL DEFAULT 0,
  kitchen_priority text NOT NULL DEFAULT 'fifo' CHECK (kitchen_priority IN ('fifo','prep_time')),
  kitchen_sound boolean NOT NULL DEFAULT true,
  ticket_footer text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  ingredients text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  image_url text,
  prep_minutes integer CHECK (prep_minutes IS NULL OR prep_minutes >= 0),
  allergens text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  archived boolean NOT NULL DEFAULT false,
  available_from time,
  available_until time,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products(category_id);

-- Grupos de opções: "Ponto da carne", "Acompanhamento", "Adicionais", "Retirar ingrediente"...
CREATE TABLE option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  min_select integer NOT NULL DEFAULT 0,
  max_select integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  CHECK (min_select >= 0 AND max_select >= 1 AND min_select <= max_select)
);
CREATE INDEX option_groups_product_idx ON option_groups(product_id);

CREATE TABLE options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX options_group_idx ON options(group_id);

CREATE TABLE dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  seats integer NOT NULL DEFAULT 4 CHECK (seats > 0),
  active boolean NOT NULL DEFAULT true
);

-- Conta (comanda aberta). Todo pedido pertence a uma conta; mesas reutilizam a conta aberta.
CREATE TABLE tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES dining_tables(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','void')),
  discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  discount_reason text,
  discount_by uuid REFERENCES staff_users(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid REFERENCES staff_users(id)
);
-- No máximo uma conta aberta por mesa.
CREATE UNIQUE INDEX tabs_one_open_per_table ON tabs(table_id) WHERE status = 'open' AND table_id IS NOT NULL;

CREATE SEQUENCE order_number_seq START 1001;

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE DEFAULT nextval('order_number_seq'),
  idempotency_key text NOT NULL UNIQUE,
  public_token text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text,'-',''), 1, 16),
  tab_id uuid NOT NULL REFERENCES tabs(id),
  service_type text NOT NULL CHECK (service_type IN ('salao','retirada','entrega')),
  table_id uuid REFERENCES dining_tables(id),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido','aguardando_impressao','em_preparo','pronto','entregue','cancelado')),
  subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  cancel_reason text,
  created_by uuid REFERENCES staff_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ready_at timestamptz
);
CREATE INDEX orders_status_idx ON orders(status, created_at);
CREATE INDEX orders_tab_idx ON orders(tab_id);
CREATE INDEX orders_created_idx ON orders(created_at);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  category_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents integer NOT NULL CHECK (line_total_cents >= 0),
  prep_minutes integer,
  notes text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX order_items_order_idx ON order_items(order_id);

CREATE TABLE order_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  option_name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX order_item_options_item_idx ON order_item_options(order_item_id);

CREATE TABLE order_status_history (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES staff_users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history(order_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES tabs(id),
  method text NOT NULL CHECK (method IN ('dinheiro','credito','debito','pix','vale','outro')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  payer_label text NOT NULL DEFAULT '',
  created_by uuid REFERENCES staff_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_tab_idx ON payments(tab_id);
CREATE INDEX payments_created_idx ON payments(created_at);

-- Impressoras. kind=agent: impressão automática via agente local. target: tcp://ip:9100 | cups:NOME | file:/dev/usb/lp0
CREATE TABLE printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  copy_type text NOT NULL CHECK (copy_type IN ('cozinha','atendimento')),
  paper text NOT NULL DEFAULT '80' CHECK (paper IN ('58','80','a4')),
  target text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  printer_id uuid REFERENCES printers(id) ON DELETE SET NULL,
  copy_type text NOT NULL CHECK (copy_type IN ('cozinha','atendimento')),
  paper text NOT NULL CHECK (paper IN ('58','80','a4')),
  target text NOT NULL,
  is_reprint boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','printing','printed','failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  requested_by uuid REFERENCES staff_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz
);
CREATE INDEX print_jobs_queue_idx ON print_jobs(status, next_attempt_at);
CREATE INDEX print_jobs_order_idx ON print_jobs(order_id);

CREATE TABLE print_attempts (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
  agent text,
  success boolean NOT NULL,
  error text,
  confirmation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES staff_users(id),
  user_name text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log(created_at DESC);

INSERT INTO restaurant_settings (id) VALUES (1);
