-- BE-2 · USAGE del esquema para el rol de la aplicación.
-- `prisma migrate reset` recrea el esquema `public` sin el USAGE implícito que
-- PostgreSQL concede a PUBLIC en una base nueva, y sin USAGE el rol no puede ni
-- consultar las tablas sobre las que tiene permisos. GRANT sobre un privilegio ya
-- concedido no falla ni cambia nada, así que la migración es idempotente.
-- El rol existe porque la migración immutable_audit_log lo crea antes.
GRANT USAGE ON SCHEMA public TO app_gns;
