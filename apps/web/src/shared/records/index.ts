// API pública de shared/records: lo común a los registros pedagógicos (planeación, diario y observador).
export { printWithTitle } from './print';
export { latestDecision, type LatestDecision } from './review-feedback';
export { STATUS_INFO, STATUS_ORDER, canVoid, isEditable, type StatusInfo } from './status';
export { VoidRecordDialog } from './VoidRecordDialog';
