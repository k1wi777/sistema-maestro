// API pública de shared/session: estado de la sesión, protección por rol y avisos.
export { AccessDeniedNotice, type AccessDeniedNoticeProps } from './components/AccessDeniedNotice';
export {
  ConsentPendingNotice,
  type ConsentPendingNoticeProps,
} from './components/ConsentPendingNotice';
export { RequireRole, type RequireRoleProps } from './components/RequireRole';
export { SessionEndedNotice } from './components/SessionEndedNotice';
export { REASON_PARAM, RETURN_PARAM, SESSION_EXPIRED_REASON, safeReturnPath } from './return-path';
export { homePathFor } from './route-access';
export {
  SessionProvider,
  useSession,
  type SessionContextValue,
  type SignInField,
  type SignInResult,
} from './session-provider';
export { roleLabel, type CurrentUser, type SessionState } from './session-state';
