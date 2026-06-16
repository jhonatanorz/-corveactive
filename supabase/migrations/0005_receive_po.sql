-- Atomic PO receiving. For each received line: add stock, log a 'reabasto' movement,
-- set the product cost to the line's unit_cost (last-cost-wins), advance qty_received.
-- Then recompute PO status (parcial vs recibida). One transaction; rolls back on error.
create or replace function receive_purchase_order(p_po_id uuid, p_receipts jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_add int;
  v_line purchase_order_items%rowtype;
  v_all_complete boolean;
  v_ref text := 'OC-' || left(p_po_id::text, 8);
begin
  for r in select * from jsonb_array_elements(p_receipts)
  loop
    v_add := (r->>'qty')::int;
    if v_add is null or v_add < 0 then raise exception 'invalid_receipt'; end if;
    if v_add = 0 then continue; end if;

    select * into v_line from purchase_order_items
      where po_id = p_po_id and variant_id = (r->>'variant_id')::uuid for update;
    if not found then raise exception 'po_line_not_found'; end if;
    if v_add > (v_line.qty_ordered - v_line.qty_received) then
      raise exception 'exceeds_outstanding';
    end if;

    update variants set stock = stock + v_add where id = v_line.variant_id;

    insert into stock_movements (variant_id, delta, type, reference)
      values (v_line.variant_id, v_add, 'reabasto', v_ref);

    update purchase_order_items set qty_received = qty_received + v_add where id = v_line.id;

    update products set cost = v_line.unit_cost, updated_at = now()
      where id = (select product_id from variants where id = v_line.variant_id);
  end loop;

  select bool_and(qty_received >= qty_ordered) into v_all_complete
    from purchase_order_items where po_id = p_po_id;

  update purchase_orders
    set status = (case when coalesce(v_all_complete, false) then 'recibida' else 'parcial' end)::po_status
    where id = p_po_id;
end;
$$;

grant execute on function receive_purchase_order(uuid, jsonb) to authenticated;
