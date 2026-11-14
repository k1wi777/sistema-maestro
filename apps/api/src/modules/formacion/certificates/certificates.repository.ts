/** Fila de `certificado` con la instantánea fijada al emitirlo. */
export interface CertificateRecord {
  id: string;
  teacherId: string;
  /** Nulo en el certificado de la ruta completa. */
  moduleId: string | null;
  code: string;
  issuedAt: Date;
  /** PDF guardado en el almacenamiento; nulo hasta la primera descarga. */
  fileId: string | null;
  teacherName: string;
  title: string;
  planName: string | null;
}

export interface NewCertificate {
  id: string;
  teacherId: string;
  moduleId: string | null;
  code: string;
  issuedAt: Date;
  teacherName: string;
  title: string;
  planName: string | null;
}

/** Certificados: lo único que toca la base para `certificado`. */
export interface CertificatesRepository {
  /**
   * Inserta con `ON CONFLICT DO NOTHING`: un conflicto no aborta la transacción de la petición.
   * Devuelve `false` si ya había un certificado del docente para ese módulo (o la ruta) o si el
   * código chocó con otro; el servicio lo distingue con `findByTeacherAndModule`.
   */
  insertIfAbsent(certificate: NewCertificate): Promise<boolean>;
  findByTeacherAndModule(
    teacherId: string,
    moduleId: string | null,
  ): Promise<CertificateRecord | null>;
  findById(id: string): Promise<CertificateRecord | null>;
  listByTeacher(teacherId: string): Promise<CertificateRecord[]>;
  findByCode(code: string): Promise<CertificateRecord | null>;
  /**
   * Fija el PDF solo si aún no hay uno (`archivo_id IS NULL`); `false` si otra descarga se adelantó.
   */
  setFileIfAbsent(certificateId: string, fileId: string): Promise<boolean>;
}

export const CERTIFICATES_REPOSITORY = Symbol('CERTIFICATES_REPOSITORY');
