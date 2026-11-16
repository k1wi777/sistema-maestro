import { test as setup } from '@playwright/test';
import { SETUP_ACTORS } from './support/actors';
import { signInThroughUi } from './support/sign-in';

// Un ingreso por la interfaz por actor y su sesión guardada: ningún correo supera los 2 intentos
// por ejecución, así el límite de ingresos conserva su valor de producción (R5).
for (const actor of SETUP_ACTORS) {
  setup(`ingresa ${actor.name}`, async ({ page }) => {
    await signInThroughUi(page, actor);
    await page.context().storageState({ path: actor.sessionFile });
  });
}
