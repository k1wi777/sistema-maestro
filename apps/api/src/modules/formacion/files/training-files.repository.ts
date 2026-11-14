import type { ModuleFilePurpose, StoredFilePurpose, StoredFileStatus } from '@gns/shared';

/** Fila de `archivo` (metadatos; la clave de objeto nunca sale de la API). */
export interface StoredFileRecord {
  id: string;
  objectKey: string;
  purpose: StoredFilePurpose;
  contentType: string;
  size: number;
  originalName: string | null;
  status: StoredFileStatus;
}

export interface NewStoredFile {
  id: string;
  objectKey: string;
  purpose: StoredFilePurpose;
  contentType: string;
  size: number;
  originalName: string | null;
  uploadedById: string | null;
}

/** Archivos de los módulos: lo único que toca la base para `archivo` y las columnas `*_archivo_id`. */
export interface TrainingFilesRepository {
  createPending(file: NewStoredFile): Promise<StoredFileRecord>;
  findFile(id: string): Promise<StoredFileRecord | null>;
  /** Registra un objeto ya subido por el sistema (PDF de certificado); un choque de clave no falla. */
  createAvailableIfAbsent(file: NewStoredFile): Promise<void>;
  findByObjectKey(objectKey: string): Promise<StoredFileRecord | null>;
  /** Archivo asociado al módulo para ese propósito (cualquier estado), o `null`. */
  findModuleFile(moduleId: string, purpose: ModuleFilePurpose): Promise<StoredFileRecord | null>;
  markAvailable(id: string, confirmedAt: Date): Promise<void>;
  /**
   * Marca el archivo `rechazado` fuera de la transacción de la petición: la respuesta es un 409
   * y el rechazo debe quedar guardado aunque la petición se revierta.
   */
  markRejected(id: string): Promise<void>;
  /** Asocia el archivo al módulo y quita el enlace del mismo propósito (R3, R6). */
  attach(moduleId: string, purpose: ModuleFilePurpose, fileId: string): Promise<void>;
  /** Desasocia el archivo del módulo; el registro y el objeto se conservan (R5). */
  detach(moduleId: string, purpose: ModuleFilePurpose): Promise<void>;
}

export const TRAINING_FILES_REPOSITORY = Symbol('TRAINING_FILES_REPOSITORY');
