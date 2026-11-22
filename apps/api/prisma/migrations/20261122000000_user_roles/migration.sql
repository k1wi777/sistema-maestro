-- Roles sin jerarquía y gestión de usuarios (#115): nuevos valores de dos restricciones CHECK.
-- Es solo DDL: no toca filas (la bitácora es inmutable) ni el esquema de Prisma.

-- La bitácora admite el tipo «usuarios» («Usuarios y roles»): alta, edición, cambio de rol,
-- estado y contraseña de un usuario. Las filas antiguas de esas acciones siguen como
-- «coordinacion».
ALTER TABLE "bitacora" DROP CONSTRAINT "bitacora_tipo_check";
ALTER TABLE "bitacora"
  ADD CONSTRAINT "bitacora_tipo_check"
    CHECK (tipo IN ('ingreso', 'planeacion', 'diario', 'observador', 'formacion',
                    'repositorio', 'asistente', 'datos', 'coordinacion', 'estructura',
                    'usuarios'));

-- Un cambio de rol revoca las sesiones abiertas del usuario con su propio motivo.
ALTER TABLE "sesion" DROP CONSTRAINT "sesion_motivo_revocacion_check";
ALTER TABLE "sesion"
  ADD CONSTRAINT "sesion_motivo_revocacion_check"
    CHECK (motivo_revocacion IN ('cierre', 'desactivacion', 'contrasena', 'reutilizacion',
                                 'cambio_rol'));
