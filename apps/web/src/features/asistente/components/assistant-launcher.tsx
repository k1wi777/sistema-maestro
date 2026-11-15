'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button, Dialog, Icon } from '@/shared/ui';

import { useConversation } from '../hooks/use-assistant';
import { AssistantChat } from './assistant-chat';
import styles from './assistant.module.css';

const ASSISTANT_PATH = '/docente/asistente';

/**
 * Botón flotante «¿Dudas?»: abre el asistente en un diálogo sin abandonar la pantalla, de modo que
 * lo que el docente estaba escribiendo se conserva. La conversación vive aquí y no se pierde al
 * cerrar el diálogo; «Nueva conversación» la vacía. No se pinta en la propia página del asistente.
 */
export function AssistantLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const conversation = useConversation();

  if (pathname === ASSISTANT_PATH) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        className={styles.launcher}
        aria-label="Abrir el Asistente GNS"
        onClick={() => setOpen(true)}
      >
        <Icon name="chat" size={20} />
        <span className={styles.launcherLabel}>¿Dudas?</span>
      </button>
      <Dialog
        open={open}
        wide
        title="Asistente GNS"
        description="Respuestas programadas sobre el Manual de Convivencia, la inducción, los beneficios y el uso de la plataforma."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={conversation.reset}>
              Nueva conversación
            </Button>
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </>
        }
      >
        <AssistantChat conversation={conversation} />
      </Dialog>
    </>
  );
}
