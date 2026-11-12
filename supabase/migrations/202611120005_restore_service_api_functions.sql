create or replace function api.create_borrowing(
  actor_id uuid, client_request_id uuid, borrower_name text, item_id uuid, quantity integer, borrowed_on date
)
returns public.borrowings language sql security invoker set search_path = ''
as $$ select private.create_borrowing(actor_id, client_request_id, borrower_name, item_id, quantity, borrowed_on) $$;

create or replace function api.return_borrowing(actor_id uuid, borrowing_id uuid)
returns public.borrowings language sql security invoker set search_path = ''
as $$ select private.return_borrowing(actor_id, borrowing_id) $$;

create or replace function api.upsert_item(actor_id uuid, item_id uuid, code text, name text, category text, total_stock integer)
returns public.items language sql security invoker set search_path = ''
as $$ select private.upsert_item(actor_id, item_id, code, name, category, total_stock) $$;

create or replace function api.archive_item(actor_id uuid, item_id uuid)
returns public.items language sql security invoker set search_path = ''
as $$ select private.archive_item(actor_id, item_id) $$;

create or replace function api.set_item_image(actor_id uuid, item_id uuid, image_path text)
returns public.items language sql security invoker set search_path = ''
as $$ select private.set_item_image(actor_id, item_id, image_path) $$;

create or replace function api.set_staff_active(actor_id uuid, staff_id uuid, is_active boolean)
returns public.profiles language sql security invoker set search_path = ''
as $$ select private.set_staff_active(actor_id, staff_id, is_active) $$;

create or replace function api.create_staff_profile(actor_id uuid, staff_id uuid, username text, display_name text)
returns public.profiles language sql security invoker set search_path = ''
as $$ select private.create_staff_profile(actor_id, staff_id, username, display_name) $$;

create or replace function api.update_staff_profile(actor_id uuid, staff_id uuid, username text, display_name text)
returns public.profiles language sql security invoker set search_path = ''
as $$ select private.update_staff_profile(actor_id, staff_id, username, display_name) $$;

create or replace function api.log_staff_password_reset(actor_id uuid, staff_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.log_staff_password_reset(actor_id, staff_id) $$;

create or replace function api.log_staff_provision_failure(
  actor_id uuid, staff_id uuid, username text, error_category text
)
returns void language sql security invoker set search_path = ''
as $$ select private.log_staff_provision_failure(actor_id, staff_id, username, error_category) $$;

revoke all on all functions in schema api from public, anon, authenticated;
grant execute on all functions in schema api to service_role;
notify pgrst, 'reload schema';
