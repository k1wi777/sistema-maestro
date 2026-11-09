export interface PasswordCredential {
  userId: string;
  hash: string;
}

export interface PasswordCredentialRepository {
  findByUserId(userId: string): Promise<PasswordCredential | null>;
  /** Crea o reemplaza la credencial del usuario. */
  save(userId: string, hash: string): Promise<void>;
  /** Crea la credencial solo si el usuario no tiene una; devuelve si la creó. */
  saveIfAbsent(userId: string, hash: string): Promise<boolean>;
}

export const PASSWORD_CREDENTIAL_REPOSITORY = Symbol('PASSWORD_CREDENTIAL_REPOSITORY');
