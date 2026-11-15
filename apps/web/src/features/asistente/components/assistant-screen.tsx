'use client';

import { Button, PageContainer, PageHeader } from '@/shared/ui';

import { useConversation } from '../hooks/use-assistant';
import { AssistantChat } from './assistant-chat';

/** `/docente/asistente`: el asistente de preguntas frecuentes a pantalla completa. */
export function AssistantScreen() {
  const conversation = useConversation();
  return (
    <PageContainer>
      <PageHeader
        context="Preguntas frecuentes"
        title="Asistente GNS"
        description="Respuestas programadas por coordinación sobre el Manual de Convivencia, la inducción, los beneficios y el uso de esta plataforma."
        actions={
          <Button variant="outline" size="sm" onClick={conversation.reset}>
            Nueva conversación
          </Button>
        }
      />
      <AssistantChat conversation={conversation} />
    </PageContainer>
  );
}
