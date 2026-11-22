// API pública de shared/shell: menú de las tres vistas (docente, coordinación y administración) y sus marcadores.
export {
  VIEWS,
  firstSectionHref,
  isActiveSection,
  sectionByHref,
  sectionsOf,
  type NavGroup,
  type NavSection,
  type ViewConfig,
} from './navigation';
export { AppShell, type AppShellProps } from './AppShell';
export { useView, type CurrentView } from './view-context';
export { SectionPlaceholder } from './SectionPlaceholder';
