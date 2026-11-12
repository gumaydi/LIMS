do $$
declare
  v_admin uuid;
begin
  select id into v_admin from public.profiles where role = 'ADMIN' and is_active order by created_at limit 1;
  if v_admin is null then
    raise notice 'Seed inventaris dilewati. Provisioning Admin harus dijalankan lebih dahulu.';
    return;
  end if;

  insert into public.items (code, name, category, total_stock, available_stock, created_by, updated_by)
  values
    ('BR001', 'Laptop Lenovo', 'Komputer', 5, 5, v_admin, v_admin),
    ('BR002', 'Mouse Logitech', 'Periferal', 10, 10, v_admin, v_admin),
    ('BR003', 'Keyboard Mechanical', 'Periferal', 8, 8, v_admin, v_admin),
    ('BR004', 'Proyektor Epson', 'Presentasi', 3, 3, v_admin, v_admin),
    ('BR005', 'Monitor LG', 'Display', 6, 6, v_admin, v_admin),
    ('BR006', 'Multimeter Digital', 'Alat Ukur', 6, 6, v_admin, v_admin),
    ('BR007', 'Oscilloscope Digital', 'Alat Ukur', 2, 2, v_admin, v_admin),
    ('BR008', 'Arduino Uno', 'Mikrokontroler', 12, 12, v_admin, v_admin),
    ('BR009', 'ESP32 DevKit', 'Mikrokontroler', 10, 10, v_admin, v_admin),
    ('BR010', 'Breadboard', 'Komponen', 20, 20, v_admin, v_admin),
    ('BR011', 'Solder Station', 'Perkakas', 4, 4, v_admin, v_admin),
    ('BR012', 'Power Supply DC', 'Catu Daya', 4, 4, v_admin, v_admin),
    ('BR013', 'Kabel HDMI', 'Kabel dan Aksesori', 10, 10, v_admin, v_admin)
  on conflict (upper(code)) do nothing;
end
$$;
