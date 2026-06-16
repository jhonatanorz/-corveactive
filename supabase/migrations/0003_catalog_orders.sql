-- Public catalog read access (anon) + atomic guest order placement.

-- anon may read ONLY active products and the variants/images of active products.
grant select on products, variants, product_images to anon;

create policy public_read_active_products on products
  for select to anon using (status = 'active');

create policy public_read_active_variants on variants
  for select to anon using (
    exists (select 1 from products p where p.id = variants.product_id and p.status = 'active')
  );

create policy public_read_active_images on product_images
  for select to anon using (
    exists (select 1 from products p where p.id = product_images.product_id and p.status = 'active')
  );

-- Atomic order placement. Runs as owner (bypasses RLS) so anon needs no insert grants.
-- Locks each variant row, refuses to oversell, snapshots items, logs 'pedido' movements.
-- Any exception rolls back the whole order.
create or replace function place_order(
  p_customer_name text,
  p_customer_whatsapp text,
  p_delivery_note text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_qty int;
  v_variant variants%rowtype;
  v_product products%rowtype;
  v_total int := 0;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'name_required';
  end if;
  if p_customer_whatsapp is null or btrim(p_customer_whatsapp) = '' then
    raise exception 'whatsapp_required';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;

  insert into orders (customer_name, customer_whatsapp, delivery_note, status, total)
  values (btrim(p_customer_name), btrim(p_customer_whatsapp), nullif(btrim(coalesce(p_delivery_note,'')), ''), 'nuevo', 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid_qty'; end if;

    select * into v_variant from variants where id = (v_item->>'variant_id')::uuid for update;
    if not found then raise exception 'variant_not_found'; end if;
    if v_variant.stock < v_qty then
      raise exception 'insufficient_stock:%', v_variant.id;
    end if;

    select * into v_product from products where id = v_variant.product_id;
    if v_product.status <> 'active' then raise exception 'product_unavailable'; end if;

    update variants set stock = stock - v_qty where id = v_variant.id;

    insert into order_items (order_id, variant_id, product_name, line, color, size, unit_price, cost, qty)
    values (v_order_id, v_variant.id, v_product.name, v_product.line, v_variant.color, v_variant.size,
            v_product.price, v_product.cost, v_qty);

    insert into stock_movements (variant_id, delta, type, reference)
    values (v_variant.id, -v_qty, 'pedido', '#' || left(v_order_id::text, 8));

    v_total := v_total + v_product.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

grant execute on function place_order(text, text, text, jsonb) to anon, authenticated;
