// API pública de shared/session: estado de la sesión, protección por rol y avisos.
export { AccessDeniedNotice, type AccessDeniedNoticeProps } from './components/AccessDeniedNotice';
export { RequireRole, type RequireRoleProps } from './components/RequireRole';
export { SessionEndedNotice } from './components/SessionEndedNotice';
export {
  REASON_PARAM,
  RETURN_PARAM,
  SESSION_EXPIRED_REASON,
  consentPath,
  safeReturnPath,
} from './return-path';
export { availableViews, homePathFor, type ProtectedRoute } from './route-access';
export {
  SessionProvider,
  useSession,
  type AcceptConsentResult,
  type SessionContextValue,
  type SignInField,
  type SignInResult,
} from './session-provider';
export { initialsOf, roleLabel, type CurrentUser, type SessionState } from './session-state';
