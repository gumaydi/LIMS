alter role authenticator set pgrst.db_schemas = 'public, graphql_public, api';
notify pgrst, 'reload config';

revoke all on schema api from public, anon, authenticated;
grant usage on schema api to service_role;
revoke all on all functions in schema api from public, anon, authenticated;
grant execute on all functions in schema api to service_role;
