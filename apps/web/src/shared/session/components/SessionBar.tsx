import { ActionBar, Button } from '@/shared/ui';

import { roleLabel, type CurrentUser } from '../session-state';

export interface SessionBarProps {
  user: CurrentUser;
  onSignOut: () => void;
}

/** Barra provisional con el nombre, el rol y «Cerrar sesión»; los menús de FE-13 la reemplazan. */
export function SessionBar({ user, onSignOut }: SessionBarProps) {
  return (
    <ActionBar
      status={
        <span>
          <strong>{user.fullName}</strong> · {roleLabel(user.role)}
        </span>
      }
    >
      <Button variant="outline" size="sm" startIcon="salir" onClick={onSignOut}>
        Cerrar sesión
      </Button>
    </ActionBar>
  );
}
