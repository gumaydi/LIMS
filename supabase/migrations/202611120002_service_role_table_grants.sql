grant select, insert, update on public.profiles, public.items, public.borrowings to service_role;
grant select, insert on public.activity_logs to service_role;
grant usage, select on all sequences in schema public to service_role;
