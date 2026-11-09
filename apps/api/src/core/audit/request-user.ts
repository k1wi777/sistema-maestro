/**
 * Usuario de la sesión que BE-3 adjuntará a `request.user`. Mientras no exista
 * autenticación, las acciones se auditan sin usuario y con el rol `desconocido`.
 */
export interface RequestUser {
  id: string;
  role: string;
}
