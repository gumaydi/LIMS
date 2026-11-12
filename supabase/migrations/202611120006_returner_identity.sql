alter table public.borrowings
add column if not exists returner_name text
check (returner_name is null or char_length(btrim(returner_name)) between 2 and 120);

drop function if exists api.return_borrowing(uuid, uuid);
drop function if exists private.return_borrowing(uuid, uuid);

create function private.return_borrowing(p_actor_id uuid, p_borrowing_id uuid, p_returner_name text)
returns public.borrowings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_item_id uuid;
  v_borrowing public.borrowings;
  v_returner_name text := btrim(p_returner_name);
begin
  v_actor := private.lock_actor(p_actor_id, false);
  if char_length(v_returner_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Nama pengembali tidak valid.';
  end if;
  select item_id into v_item_id from public.borrowings where id = p_borrowing_id;
  if v_item_id is null then
    raise exception using errcode = 'P0002', message = 'Peminjaman tidak ditemukan.';
  end if;
  perform 1 from public.items where id = v_item_id for update;
  select * into v_borrowing from public.borrowings where id = p_borrowing_id for update;
  if v_borrowing.item_id <> v_item_id then
    raise exception using errcode = '40001', message = 'Data peminjaman berubah. Ulangi permintaan.';
  end if;
  if v_borrowing.status <> 'BORROWED' then
    raise exception using errcode = '22023', message = 'Peminjaman sudah dikembalikan.';
  end if;

  update public.items set available_stock = available_stock + v_borrowing.quantity,
    updated_by = v_actor.id, updated_at = now() where id = v_item_id;
  update public.borrowings set status = 'RETURNED', returned_at = now(), returner_name = v_returner_name,
    returned_by = v_actor.id, returned_by_username_snapshot = v_actor.username
  where id = p_borrowing_id returning * into v_borrowing;
  perform private.log_activity(v_actor, 'BORROWING_RETURNED', 'BORROWING', v_borrowing.id,
    jsonb_build_object('item_id', v_item_id, 'quantity', v_borrowing.quantity));
  return v_borrowing;
end
$$;

create function api.return_borrowing(actor_id uuid, borrowing_id uuid, returner_name text)
returns public.borrowings
language sql
security invoker
set search_path = ''
as $$ select private.return_borrowing(actor_id, borrowing_id, returner_name) $$;

revoke all on function private.return_borrowing(uuid, uuid, text) from public, anon, authenticated;
revoke all on function api.return_borrowing(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.return_borrowing(uuid, uuid, text) to service_role;
grant execute on function api.return_borrowing(uuid, uuid, text) to service_role;
notify pgrst, 'reload schema';
