-- supabase/migrations/0012_import_products.sql
-- Atomic bulk product import. Inserts each product and its variants in one
-- transaction; returns the count of products created. Rolls back on any error.
-- Mirrors the place_order / receive_purchase_order RPC pattern.
create or replace function import_products(p_products jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  v jsonb;
  v_product_id uuid;
  v_count int := 0;
begin
  for p in select * from jsonb_array_elements(coalesce(p_products, '[]'::jsonb))
  loop
    insert into products (name, line_id, category_id, description, price, status)
    values (
      btrim(p->>'name'),
      (p->>'line_id')::uuid,
      (p->>'category_id')::uuid,
      coalesce(p->>'description', ''),
      (p->>'price')::int,
      coalesce(nullif(p->>'status', ''), 'draft')::product_status
    )
    returning id into v_product_id;

    for v in select * from jsonb_array_elements(coalesce(p->'variants', '[]'::jsonb))
    loop
      insert into variants (product_id, color, color_hex, size, sku, stock)
      values (
        v_product_id,
        v->>'color',
        coalesce(nullif(v->>'color_hex', ''), '#000000'),
        v->>'size',
        nullif(v->>'sku', ''),
        coalesce((v->>'stock')::int, 0)
      );
    end loop;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function import_products(jsonb) to authenticated;
