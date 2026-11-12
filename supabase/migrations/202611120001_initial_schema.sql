create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('ADMIN', 'STAFF');
create type public.borrowing_status as enum ('BORROWED', 'RETURNED');
create type public.activity_action as enum (
  'STAFF_CREATED', 'STAFF_UPDATED', 'STAFF_ACTIVATED', 'STAFF_DEACTIVATED', 'STAFF_PASSWORD_RESET',
  'STAFF_PROVISION_FAILED',
  'ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_ARCHIVED', 'BORROWING_CREATED', 'BORROWING_RETURNED'
);
create type public.activity_entity as enum ('PROFILE', 'ITEM', 'BORROWING');

create schema private;
create schema api;
revoke all on schema private from public, anon, authenticated;
revoke all on schema api from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant usage on schema api to service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  username text not null unique,
  display_name text not null,
  role public.app_role not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_canonical check (
    username = lower(btrim(username))
    and username ~ '^[a-z0-9._-]{3,32}$'
  ),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 2 and 100)
);

create table public.items (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null,
  name text not null,
  category text not null,
  total_stock integer not null,
  available_stock integer not null,
  image_path text,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_code_canonical check (code = upper(btrim(code)) and code ~ '^[A-Z0-9._-]{2,32}$'),
  constraint items_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint items_category_length check (char_length(btrim(category)) between 2 and 80),
  constraint items_stock_valid check (total_stock >= 0 and available_stock >= 0 and available_stock <= total_stock)
);
create unique index items_code_unique on public.items (upper(code));
create index items_active_idx on public.items (name, id) where not is_archived;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.borrowings (
  id uuid primary key default extensions.gen_random_uuid(),
  borrower_name text not null check (char_length(btrim(borrower_name)) between 2 and 120),
  item_id uuid not null references public.items(id) on delete restrict,
  item_code_snapshot text not null,
  item_name_snapshot text not null,
  item_category_snapshot text not null,
  quantity integer not null check (quantity > 0),
  borrowed_on date not null,
  status public.borrowing_status not null default 'BORROWED',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_by_username_snapshot text not null,
  created_at timestamptz not null default now(),
  client_request_id uuid not null unique,
  returned_at timestamptz,
  returner_name text check (returner_name is null or char_length(btrim(returner_name)) between 2 and 120),
  returned_by uuid references public.profiles(id) on delete restrict,
  returned_by_username_snapshot text,
  constraint borrowings_return_state check (
    (status = 'BORROWED' and returned_at is null and returner_name is null and returned_by is null and returned_by_username_snapshot is null)
    or
    (status = 'RETURNED' and returned_at is not null and returner_name is not null and returned_by is not null and returned_by_username_snapshot is not null)
  )
);
create index borrowings_status_created_idx on public.borrowings (status, created_at desc, id desc);
create index borrowings_item_status_idx on public.borrowings (item_id, status);
create index borrowings_creator_idx on public.borrowings (created_by, created_at desc);
create index borrowings_returner_idx on public.borrowings (returned_by, returned_at desc);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_role_snapshot public.app_role not null,
  actor_username_snapshot text not null,
  action public.activity_action not null,
  entity_type public.activity_entity not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index activity_logs_created_idx on public.activity_logs (created_at desc, id desc);
create index activity_logs_actor_idx on public.activity_logs (actor_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.borrowings enable row level security;
alter table public.activity_logs enable row level security;

create function private.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_active from public.profiles p where p.id = auth.uid()), false)
$$;

create function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_active and p.role = 'ADMIN' from public.profiles p where p.id = auth.uid()), false)
$$;

revoke all on function private.current_user_is_active() from public, anon;
revoke all on function private.current_user_is_admin() from public, anon;
grant execute on function private.current_user_is_active() to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using (
  private.current_user_is_active()
  and (id = auth.uid() or (role = 'STAFF' and private.current_user_is_admin()))
);

create policy items_read on public.items for select to authenticated
using (
  private.current_user_is_active()
  and (not is_archived or private.current_user_is_admin())
);

create policy borrowings_read on public.borrowings for select to authenticated
using (
  private.current_user_is_active()
  and (
    private.current_user_is_admin()
    or status = 'BORROWED'
    or created_by = auth.uid()
    or returned_by = auth.uid()
  )
);

create policy activity_logs_read on public.activity_logs for select to authenticated
using (
  private.current_user_is_active()
  and (private.current_user_is_admin() or actor_id = auth.uid())
);

create function private.lock_actor(p_actor_id uuid, p_admin_required boolean default false)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
begin
  select * into v_actor from public.profiles where id = p_actor_id for share;
  if v_actor.id is null or not v_actor.is_active then
    raise exception using errcode = '42501', message = 'Akun tidak aktif atau tidak ditemukan.';
  end if;
  if p_admin_required and v_actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Tindakan ini memerlukan peran Admin.';
  end if;
  return v_actor;
end
$$;

create function private.log_activity(
  p_actor public.profiles,
  p_action public.activity_action,
  p_entity_type public.activity_entity,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.activity_logs (
    actor_id, actor_role_snapshot, actor_username_snapshot, action, entity_type, entity_id, metadata
  ) values (
    p_actor.id, p_actor.role, p_actor.username, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb)
  );
end
$$;

create function private.create_borrowing(
  p_actor_id uuid,
  p_client_request_id uuid,
  p_borrower_name text,
  p_item_id uuid,
  p_quantity integer,
  p_borrowed_on date
)
returns public.borrowings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_item public.items;
  v_existing public.borrowings;
  v_result public.borrowings;
  v_borrower_name text := btrim(p_borrower_name);
begin
  v_actor := private.lock_actor(p_actor_id, false);
  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));

  select * into v_existing from public.borrowings where client_request_id = p_client_request_id;
  if v_existing.id is not null then
    if v_existing.created_by = p_actor_id
      and v_existing.borrower_name = v_borrower_name
      and v_existing.item_id = p_item_id
      and v_existing.quantity = p_quantity
      and v_existing.borrowed_on = p_borrowed_on then
      return v_existing;
    end if;
    raise exception using errcode = '23505', message = 'ID permintaan sudah dipakai untuk data berbeda.';
  end if;

  if char_length(v_borrower_name) not between 2 and 120 or p_quantity <= 0 or p_borrowed_on > current_date then
    raise exception using errcode = '22023', message = 'Data peminjaman tidak valid.';
  end if;

  select * into v_item from public.items where id = p_item_id for update;
  if v_item.id is null or v_item.is_archived then
    raise exception using errcode = '22023', message = 'Barang tidak tersedia untuk dipinjam.';
  end if;
  if v_item.available_stock < p_quantity then
    raise exception using errcode = '22023', message = 'Stok tersedia tidak mencukupi.';
  end if;

  insert into public.borrowings (
    borrower_name, item_id, item_code_snapshot, item_name_snapshot, item_category_snapshot,
    quantity, borrowed_on, created_by, created_by_username_snapshot, client_request_id
  ) values (
    v_borrower_name, v_item.id, v_item.code, v_item.name, v_item.category,
    p_quantity, p_borrowed_on, v_actor.id, v_actor.username, p_client_request_id
  ) returning * into v_result;

  update public.items set available_stock = available_stock - p_quantity, updated_by = v_actor.id, updated_at = now()
  where id = v_item.id;
  perform private.log_activity(v_actor, 'BORROWING_CREATED', 'BORROWING', v_result.id,
    jsonb_build_object('item_id', v_item.id, 'quantity', p_quantity));
  return v_result;
end
$$;

create function private.return_borrowing(p_actor_id uuid, p_borrowing_id uuid)
returns public.borrowings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_item_id uuid;
  v_borrowing public.borrowings;
begin
  v_actor := private.lock_actor(p_actor_id, false);
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
  update public.borrowings set status = 'RETURNED', returned_at = now(), returned_by = v_actor.id,
    returned_by_username_snapshot = v_actor.username where id = p_borrowing_id returning * into v_borrowing;
  perform private.log_activity(v_actor, 'BORROWING_RETURNED', 'BORROWING', v_borrowing.id,
    jsonb_build_object('item_id', v_item_id, 'quantity', v_borrowing.quantity));
  return v_borrowing;
end
$$;

create function private.upsert_item(
  p_actor_id uuid, p_item_id uuid, p_code text, p_name text, p_category text, p_total_stock integer
)
returns public.items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_item public.items;
  v_borrowed integer;
  v_code text := upper(btrim(p_code));
begin
  v_actor := private.lock_actor(p_actor_id, true);
  if p_total_stock < 0 or v_code !~ '^[A-Z0-9._-]{2,32}$'
    or char_length(btrim(p_name)) not between 2 and 120
    or char_length(btrim(p_category)) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'Data barang tidak valid.';
  end if;

  if p_item_id is null then
    insert into public.items (code, name, category, total_stock, available_stock, created_by, updated_by)
    values (v_code, btrim(p_name), btrim(p_category), p_total_stock, p_total_stock, v_actor.id, v_actor.id)
    returning * into v_item;
    perform private.log_activity(v_actor, 'ITEM_CREATED', 'ITEM', v_item.id, jsonb_build_object('code', v_item.code));
    return v_item;
  end if;

  select * into v_item from public.items where id = p_item_id for update;
  if v_item.id is null then
    raise exception using errcode = 'P0002', message = 'Barang tidak ditemukan.';
  end if;
  select coalesce(sum(quantity), 0)::integer into v_borrowed from public.borrowings
  where item_id = p_item_id and status = 'BORROWED';
  if p_total_stock < v_borrowed then
    raise exception using errcode = '22023', message = 'Total stok lebih kecil dari jumlah yang sedang dipinjam.';
  end if;
  update public.items set code = v_code, name = btrim(p_name), category = btrim(p_category),
    total_stock = p_total_stock, available_stock = p_total_stock - v_borrowed,
    updated_by = v_actor.id, updated_at = now()
  where id = p_item_id returning * into v_item;
  perform private.log_activity(v_actor, 'ITEM_UPDATED', 'ITEM', v_item.id, jsonb_build_object('code', v_item.code));
  return v_item;
end
$$;

create function private.archive_item(p_actor_id uuid, p_item_id uuid)
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
  select * into v_item from public.items where id = p_item_id for update;
  if v_item.id is null then raise exception using errcode = 'P0002', message = 'Barang tidak ditemukan.'; end if;
  if exists (select 1 from public.borrowings where item_id = p_item_id and status = 'BORROWED') then
    raise exception using errcode = '22023', message = 'Barang dengan peminjaman aktif tidak dapat diarsipkan.';
  end if;
  update public.items set is_archived = true, updated_by = v_actor.id, updated_at = now()
  where id = p_item_id returning * into v_item;
  perform private.log_activity(v_actor, 'ITEM_ARCHIVED', 'ITEM', v_item.id, jsonb_build_object('code', v_item.code));
  return v_item;
end
$$;

create function private.set_item_image(p_actor_id uuid, p_item_id uuid, p_image_path text)
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

create function private.set_staff_active(p_actor_id uuid, p_staff_id uuid, p_is_active boolean)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_staff public.profiles;
begin
  v_actor := private.lock_actor(p_actor_id, true);
  select * into v_staff from public.profiles where id = p_staff_id for update;
  if v_staff.id is null or v_staff.role <> 'STAFF' then
    raise exception using errcode = '22023', message = 'Akun Staff tidak ditemukan.';
  end if;
  update public.profiles set is_active = p_is_active, updated_by = v_actor.id, updated_at = now()
  where id = p_staff_id returning * into v_staff;
  perform private.log_activity(v_actor,
    case when p_is_active then 'STAFF_ACTIVATED'::public.activity_action else 'STAFF_DEACTIVATED'::public.activity_action end,
    'PROFILE', v_staff.id, jsonb_build_object('username', v_staff.username));
  return v_staff;
end
$$;

create function private.create_staff_profile(
  p_actor_id uuid, p_staff_id uuid, p_username text, p_display_name text
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_staff public.profiles;
  v_username text := lower(btrim(p_username));
begin
  v_actor := private.lock_actor(p_actor_id, true);
  if v_username !~ '^[a-z0-9._-]{3,32}$'
    or char_length(btrim(p_display_name)) not between 2 and 100 then
    raise exception using errcode = '22023', message = 'Data akun Staff tidak valid.';
  end if;
  insert into public.profiles (id, username, display_name, role, created_by, updated_by)
  values (p_staff_id, v_username, btrim(p_display_name), 'STAFF', v_actor.id, v_actor.id)
  returning * into v_staff;
  perform private.log_activity(v_actor, 'STAFF_CREATED', 'PROFILE', v_staff.id,
    jsonb_build_object('username', v_staff.username));
  return v_staff;
end
$$;

create function private.update_staff_profile(
  p_actor_id uuid, p_staff_id uuid, p_username text, p_display_name text
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_staff public.profiles;
  v_username text := lower(btrim(p_username));
begin
  v_actor := private.lock_actor(p_actor_id, true);
  if v_username !~ '^[a-z0-9._-]{3,32}$'
    or char_length(btrim(p_display_name)) not between 2 and 100 then
    raise exception using errcode = '22023', message = 'Data akun Staff tidak valid.';
  end if;
  select * into v_staff from public.profiles where id = p_staff_id for update;
  if v_staff.id is null or v_staff.role <> 'STAFF' then
    raise exception using errcode = '22023', message = 'Akun Staff tidak ditemukan.';
  end if;
  update public.profiles set username = v_username, display_name = btrim(p_display_name),
    updated_by = v_actor.id, updated_at = now()
  where id = p_staff_id returning * into v_staff;
  perform private.log_activity(v_actor, 'STAFF_UPDATED', 'PROFILE', v_staff.id,
    jsonb_build_object('username', v_staff.username));
  return v_staff;
end
$$;

create function private.log_staff_password_reset(p_actor_id uuid, p_staff_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_staff public.profiles;
begin
  v_actor := private.lock_actor(p_actor_id, true);
  select * into v_staff from public.profiles where id = p_staff_id for share;
  if v_staff.id is null or v_staff.role <> 'STAFF' then
    raise exception using errcode = '22023', message = 'Akun Staff tidak ditemukan.';
  end if;
  perform private.log_activity(v_actor, 'STAFF_PASSWORD_RESET', 'PROFILE', v_staff.id,
    jsonb_build_object('username', v_staff.username));
end
$$;

create function private.log_staff_provision_failure(
  p_actor_id uuid, p_staff_id uuid, p_username text, p_error_category text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor public.profiles;
begin
  v_actor := private.lock_actor(p_actor_id, true);
  insert into public.activity_logs (
    actor_id, actor_role_snapshot, actor_username_snapshot, action, entity_type, entity_id, metadata
  ) values (
    v_actor.id, v_actor.role, v_actor.username, 'STAFF_PROVISION_FAILED', 'PROFILE', p_staff_id,
    jsonb_build_object('username', lower(btrim(p_username)), 'error_category', left(p_error_category, 80))
  );
end
$$;

create function api.create_borrowing(
  actor_id uuid, client_request_id uuid, borrower_name text, item_id uuid, quantity integer, borrowed_on date
)
returns public.borrowings language sql security invoker set search_path = ''
as $$ select private.create_borrowing(actor_id, client_request_id, borrower_name, item_id, quantity, borrowed_on) $$;

create function api.return_borrowing(actor_id uuid, borrowing_id uuid)
returns public.borrowings language sql security invoker set search_path = ''
as $$ select private.return_borrowing(actor_id, borrowing_id) $$;

create function api.upsert_item(actor_id uuid, item_id uuid, code text, name text, category text, total_stock integer)
returns public.items language sql security invoker set search_path = ''
as $$ select private.upsert_item(actor_id, item_id, code, name, category, total_stock) $$;

create function api.archive_item(actor_id uuid, item_id uuid)
returns public.items language sql security invoker set search_path = ''
as $$ select private.archive_item(actor_id, item_id) $$;

create function api.set_item_image(actor_id uuid, item_id uuid, image_path text)
returns public.items language sql security invoker set search_path = ''
as $$ select private.set_item_image(actor_id, item_id, image_path) $$;

create function api.set_staff_active(actor_id uuid, staff_id uuid, is_active boolean)
returns public.profiles language sql security invoker set search_path = ''
as $$ select private.set_staff_active(actor_id, staff_id, is_active) $$;

create function api.create_staff_profile(actor_id uuid, staff_id uuid, username text, display_name text)
returns public.profiles language sql security invoker set search_path = ''
as $$ select private.create_staff_profile(actor_id, staff_id, username, display_name) $$;

create function api.update_staff_profile(actor_id uuid, staff_id uuid, username text, display_name text)
returns public.profiles language sql security invoker set search_path = ''
as $$ select private.update_staff_profile(actor_id, staff_id, username, display_name) $$;

create function api.log_staff_password_reset(actor_id uuid, staff_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.log_staff_password_reset(actor_id, staff_id) $$;

create function api.log_staff_provision_failure(
  actor_id uuid, staff_id uuid, username text, error_category text
)
returns void language sql security invoker set search_path = ''
as $$ select private.log_staff_provision_failure(actor_id, staff_id, username, error_category) $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all functions in schema api from public, anon, authenticated;
grant execute on function private.current_user_is_active() to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;
grant execute on all functions in schema private to service_role;
grant execute on all functions in schema api to service_role;

create function private.validate_item_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item_id uuid;
  v_available integer;
  v_total integer;
  v_archived boolean;
  v_borrowed integer;
begin
  if tg_table_schema = 'public' and tg_table_name = 'items' then
    v_item_id := coalesce(new.id, old.id);
  else
    v_item_id := coalesce(new.item_id, old.item_id);
  end if;
  select available_stock, total_stock, is_archived into v_available, v_total, v_archived
  from public.items where id = v_item_id;
  if not found then return null; end if;
  select coalesce(sum(quantity), 0)::integer into v_borrowed from public.borrowings
  where item_id = v_item_id and status = 'BORROWED';
  if v_available + v_borrowed <> v_total then
    raise exception using errcode = '23514', message = 'Integritas stok barang tidak terpenuhi.';
  end if;
  if v_archived and v_borrowed > 0 then
    raise exception using errcode = '23514', message = 'Barang arsip masih memiliki peminjaman aktif.';
  end if;
  return null;
end
$$;

create constraint trigger items_integrity_after_change
after insert or update of total_stock, available_stock, is_archived on public.items
deferrable initially deferred for each row execute function private.validate_item_integrity();

create constraint trigger borrowings_integrity_after_change
after insert or update of status, quantity, item_id on public.borrowings
deferrable initially deferred for each row execute function private.validate_item_integrity();

revoke insert, update, delete on public.profiles, public.items, public.borrowings, public.activity_logs from anon, authenticated;
revoke all on public.activity_logs from anon;
grant select on public.profiles, public.items, public.borrowings, public.activity_logs to authenticated;
grant select, insert, update on public.profiles, public.items, public.borrowings to service_role;
grant select, insert on public.activity_logs to service_role;
grant usage, select on all sequences in schema public to service_role;
