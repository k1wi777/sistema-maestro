import { Notice } from '@/shared/ui';

export type PrivacyContext = 'adjustments' | 'digital' | 'share';

const TEXT: Record<PrivacyContext, string> = {
  adjustments:
    'Describe el ajuste, no al estudiante. No escribas nombres, fotos, diagnósticos ni datos de salud.',
  digital:
    'Describe el recurso, no al estudiante. No incluyas nombres, fotos de niños, diagnósticos ni datos de salud en los recursos. En ClassDojo comparte solo con las familias del grupo.',
  share:
    'Todos los docentes verán esta actividad. Descríbela sin nombres de estudiantes, fotos, diagnósticos ni datos de salud.',
};

/** Aviso de privacidad de menores: de los estudiantes no se escribe nada identificable. */
export function PrivacyNotice({ context }: { context: PrivacyContext }) {
  return (
    <Notice tone="info" title="Privacidad de los estudiantes">
      {TEXT[context]}
    </Notice>
  );
}
