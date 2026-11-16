import { moduleActions, MODULE_ACTION_LABEL, withdrawConfirmation } from './module-actions';

describe('moduleActions', () => {
  it('ofrece solo las acciones de cada estado', () => {
    expect(moduleActions('borrador')).toEqual(['edit', 'publish']);
    expect(moduleActions('activo')).toEqual(['edit', 'tracking', 'withdraw']);
    expect(moduleActions('fuera_del_plan')).toEqual(['edit', 'restore']);
  });

  it('ningún texto habla de eliminar ni de borrar', () => {
    const confirmation = withdrawConfirmation('Prueba');
    const texts = [
      ...Object.values(MODULE_ACTION_LABEL),
      confirmation.title,
      confirmation.description,
      confirmation.confirmLabel,
    ].join(' ');
    expect(texts).not.toMatch(/eliminar|borrar|anular/i);
  });

  it('la confirmación explica que se conserva el progreso y que se puede restaurar', () => {
    const confirmation = withdrawConfirmation('Bienvenida');
    expect(confirmation.title).toContain('Bienvenida');
    expect(confirmation.description).toContain('deja de verse en la ruta de los docentes');
    expect(confirmation.description).toContain('progreso');
    expect(confirmation.description).toContain('restaurarlo');
  });
});
