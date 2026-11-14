import { Notice } from '@/shared/ui';

/** Lo muestra `/ingreso` cuando la sesión terminó (`motivo=sesion-vencida`). */
export function SessionEndedNotice() {
  return <Notice tone="warning">Tu sesión terminó. Ingresa de nuevo.</Notice>;
}
