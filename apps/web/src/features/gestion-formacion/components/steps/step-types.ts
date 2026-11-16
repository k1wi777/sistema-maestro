import type { ModuleEditor } from '../../hooks/use-module-editor';

/** Lo que recibe cada paso del editor: el estado compartido y su número visible. */
export interface StepProps {
  editor: ModuleEditor;
  number: number;
}
