/** El almacenamiento no responde o falló (red, 5xx, credenciales). Se responde 503, sin detalles. */
export class StorageUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Almacenamiento no disponible', options);
    this.name = 'StorageUnavailableError';
  }
}
