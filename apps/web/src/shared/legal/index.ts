// API pública de shared/legal: textos legales, datos del colegio y sus componentes.
export { LegalBlocks, type LegalBlocksProps } from './components/LegalBlocks';
export { LegalLinks, type LegalLinksProps } from './components/LegalLinks';
export { LegalText } from './components/LegalText';
export type { Inline, LegalBlock, LegalDocument, LegalSection } from './content/document';
export { INSTITUTION, type Institution } from './content/institution';
export { LEGAL_PENDING, pending, type PendingId, type PendingValue } from './content/pending';
export {
  CONSENT_BOXES,
  PRIVACY_NOTICE,
  type ConsentBox,
  type ConsentBoxKey,
} from './content/privacy-notice';
export { PRIVACY_POLICY } from './content/privacy-policy';
export { TERMS_OF_USE } from './content/terms-of-use';
export { LEGAL_DOCUMENTS_VERSION } from './content/version';
export { PRIVACY_POLICY_PATH, TERMS_OF_USE_PATH } from './routes';
