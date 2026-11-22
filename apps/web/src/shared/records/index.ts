// API pública de shared/records: lo común a los registros pedagógicos (planeación, diario y observador).
export { OBSERVER_TYPE_INFO, OBSERVER_TYPE_ORDER, type LabelInfo } from './format-labels';
export {
  ADJUSTABLE_FIELD_LABELS,
  FIELD_BY_COLUMN,
  MOMENTS,
  type Moment,
  type MomentField,
} from './lesson-plan-fields';
export {
  ANNOTATION_STATUS_INFO,
  JOURNAL_STATUS_INFO,
  JOURNAL_STATUS_ORDER,
  journalStatusFromUrl,
  type JournalStatusInfo,
} from './journal-status';
export { printWithTitle } from './print';
export {
  canReviewGrade,
  consultNotice,
  coordinatorOfGrade,
  gradesWithoutCoordinator,
  joinNames,
  myGrades,
  reviewerHint,
  type CatalogGradeScope,
  type GradeCoordinator,
  type ReviewUser,
} from './review-access';
export { latestDecision, type LatestDecision } from './review-feedback';
export { STATUS_INFO, STATUS_ORDER, canVoid, isEditable, type StatusInfo } from './status';
export { VoidRecordDialog } from './VoidRecordDialog';
