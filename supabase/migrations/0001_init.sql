-- CORVE schema v1

create type line as enum ('MOVE', 'HIM');
create type product_status as enum ('draft', 'active', 'hidden');
create type order_status as enum ('nuevo','confirmado','pagado','enviado','entregado','cancelado');
create type po_status as enum ('borrador','pedida','parcial','recibida','cancelada');
create type movement_type as enum ('reabasto','pedido','correccion','cancelacion');

create table products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  line        line not null,
  type        text not null,
  description text not null default '',
  price       integer not null,            -- centavos
  cost        integer not null default 0,  -- centavos, latest unit cost
  status      product_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  sort_order integer not null default 0
);

create table variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  color      text not null,
  color_hex  text not null default '#000000',
  size       text not null,
  stock      integer not null default 0,
  sku        text,
  unique (product_id, color, size)
);

create table suppliers (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  contact text
);

create table purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  status      po_status not null default 'borrador',
  expected_at date,
  notes       text,
  total_cost  integer not null default 0, -- centavos
  created_at  timestamptz not null default now()
);

create table purchase_order_items (
  id           uuid primary key default gen_random_uuid(),
  po_id        uuid not null references purchase_orders(id) on delete cascade,
  variant_id   uuid not null references variants(id) on delete restrict,
  qty_ordered  integer not null,
  qty_received integer not null default 0,
  unit_cost    integer not null            -- centavos
);

create table orders (
  id                uuid primary key default gen_random_uuid(),
  customer_name     text not null,
  customer_whatsapp text not null,
  delivery_note     text,
  status            order_status not null default 'nuevo',
  total             integer not null default 0, -- centavos
  stock_restored    boolean not null default false,
  created_at        timestamptz not null default now()
);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  variant_id   uuid references variants(id) on delete set null,
  product_name text not null,  -- snapshot
  line         line not null,  -- snapshot, for sales-by-line reporting
  color        text not null,  -- snapshot
  size         text not null,  -- snapshot
  unit_price   integer not null, -- centavos snapshot
  cost         integer not null, -- centavos snapshot (cost at sale time)
  qty          integer not null
);

create table stock_movements (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references variants(id) on delete cascade,
  delta      integer not null, -- signed
  type       movement_type not null,
  reference  text,             -- e.g. 'OC-11', '#104'
  reason     text,             -- free text for corrections
  created_at timestamptz not null default now()
);

create index on variants (product_id);
create index on order_items (order_id);
create index on purchase_order_items (po_id);
create index on stock_movements (variant_id);
create index on orders (status, created_at);
