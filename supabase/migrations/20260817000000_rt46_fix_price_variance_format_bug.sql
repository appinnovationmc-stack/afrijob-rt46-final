-- CRITICAL FIX: check_parts_price_variance() used printf-style specifiers
-- (%.2f, %.1f%%) inside Postgres's format(), which only supports %s/%I/%L.
-- Found via live testing: inserting a real overpriced part crashed the
-- insert entirely with "unrecognized format() type specifier" — meaning
-- price-anomaly fraud detection had never actually fired, and worse, it
-- blocked the legitimate parts insert it was supposed to just flag.
create or replace function rt46.check_parts_price_variance()
returns trigger
language plpgsql
security definer
set search_path to 'rt46','public'
as $$
declare
  v_ref_price numeric(10,2);
  v_merchant_id uuid;
begin
  select benchmark_price into v_ref_price
  from rt46.parts_price_reference where id = new.reference_id;

  if v_ref_price is not null and v_ref_price > 0 then
    new.variance_pct := round(((new.billed_unit_cost - v_ref_price) / v_ref_price) * 100, 2);

    if new.variance_pct > 25 then
      select allocated_merchant_id into v_merchant_id
      from rt46.work_orders where id = new.work_order_id;

      insert into rt46.fraud_flags (merchant_id, work_order_id, flag_type, detail)
      values (
        v_merchant_id, new.work_order_id, 'price_anomaly',
        format('Part "%s" billed at %s vs benchmark %s (+%s%%)',
          new.part_name,
          to_char(new.billed_unit_cost, 'FM999999990.00'),
          to_char(v_ref_price, 'FM999999990.00'),
          to_char(new.variance_pct, 'FM999990.0'))
      );
    end if;
  end if;

  return new;
end;
$$;
