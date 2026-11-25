// API pública de las piezas de juego compartidas por la vista del docente y la vista previa de
// coordinación. Importa solo desde '@/shared/training-games'.
export { default as gameFrame } from './game-frame.module.css';
export { FloatingGain } from './floating-gain';
export { MatchColumns, type MatchColumnsProps } from './match-columns';
export { Passport, type PassportCard } from './passport';
export {
  evaluateWith,
  formatInputValue,
  formatMoneyInput,
  formatSimulatorValue,
  inputValueOf,
  NOT_CALCULABLE,
  parseMoneyInput,
  sharedKey,
  valuesForConfig,
  type SharedValues,
} from './simulator';
export { SimulatorPanel, type SimulatorChangeHandler } from './simulator-panel';
export { StatementCard } from './statement-card';
export { WheelCard } from './wheel-card';
export { WheelFace, type WheelFaceCard } from './wheel-face';
export {
  wheelSegments,
  type WheelCardConfig,
  type WheelCardRef,
  type WheelColor,
  type WheelSegment,
} from './wheel';
