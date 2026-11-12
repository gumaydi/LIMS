alter table public.items add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.set_item_image(p_actor_id uuid, p_item_id uuid, p_image_path text)
returns public.items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_item public.items;
begin
  v_actor := private.lock_actor(p_actor_id, true);
  if p_image_path !~ ('^' || p_item_id::text || '/[0-9a-f-]+\.(jpg|png|webp)$') then
    raise exception using errcode = '22023', message = 'Path gambar barang tidak valid.';
  end if;
  select * into v_item from public.items where id = p_item_id for update;
  if v_item.id is null then
    raise exception using errcode = 'P0002', message = 'Barang tidak ditemukan.';
  end if;
  update public.items
  set image_path = p_image_path, updated_by = v_actor.id, updated_at = now()
  where id = p_item_id
  returning * into v_item;
  perform private.log_activity(v_actor, 'ITEM_UPDATED', 'ITEM', v_item.id,
    jsonb_build_object('code', v_item.code, 'image_changed', true));
  return v_item;
end
$$;

create or replace function api.set_item_image(actor_id uuid, item_id uuid, image_path text)
returns public.items
language sql
security invoker
set search_path = ''
as $$ select private.set_item_image(actor_id, item_id, image_path) $$;

revoke all on function private.set_item_image(uuid, uuid, text) from public, anon, authenticated;
revoke all on function api.set_item_image(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.set_item_image(uuid, uuid, text) to service_role;
grant execute on function api.set_item_image(uuid, uuid, text) to service_role;
