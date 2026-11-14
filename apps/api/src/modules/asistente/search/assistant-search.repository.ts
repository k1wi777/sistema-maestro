export interface FaqMatch {
  id: string;
  category: string;
  question: string;
  answer: string;
  source: string | null;
  /** Fracción de lexemas de la consulta cubiertos, en (0, 1]. */
  score: number;
  /** Lexemas hallados en la pregunta o sus palabras clave (peso fuerte). */
  strongMatches: number;
}

export interface AssistantSearchRepository {
  /**
   * Cuántos lexemas significativos tiene el texto: sus raíces en español (`gns_spanish`) menos las
   * palabras de relleno `filler`. Cero significa que no hay nada que buscar ni que registrar.
   */
  countSignificantLexemes(text: string, filler: string): Promise<number>;
  /** Preguntas activas con puntaje mayor que cero para el texto, de mayor a menor puntaje. */
  scoreMatches(text: string, filler: string): Promise<FaqMatch[]>;
}

export const ASSISTANT_SEARCH_REPOSITORY = Symbol('ASSISTANT_SEARCH_REPOSITORY');
