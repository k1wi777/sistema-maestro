import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { AssistantSearchRepository, FaqMatch } from './assistant-search.repository';

// Lexemas significativos de la consulta: raíces de `gns_spanish` menos las de relleno. El texto de la
// persona solo viaja como parámetro de la plantilla etiquetada; nunca se concatena al SQL.
const queryLexemes = (text: string, filler: string) => Prisma.sql`
  SELECT lexeme
  FROM unnest(to_tsvector('gns_spanish', ${text}::text)) AS t(lexeme, positions, weights)
  WHERE lexeme NOT IN (
    SELECT lexeme FROM unnest(to_tsvector('gns_spanish', ${filler}::text)) AS f(lexeme, positions, weights)
  )
`;

interface ScoreRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  source: string | null;
  score: number;
  strong_matches: number;
}

@Injectable()
export class PrismaAssistantSearchRepository implements AssistantSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countSignificantLexemes(text: string, filler: string): Promise<number> {
    const rows = await this.prisma.db.$queryRaw<{ total: number }[]>(
      Prisma.sql`SELECT count(*)::int AS total FROM (${queryLexemes(text, filler)}) AS q`,
    );
    return rows[0]?.total ?? 0;
  }

  // El documento se calcula en la consulta (pregunta y palabras clave con peso A, respuesta con peso
  // D): con decenas de filas el recorrido secuencial es inmediato y no hace falta columna ni índice.
  // Un lexema cuenta 1 si aparece con peso A y 0,25 si solo está en la respuesta; los de 4 o más
  // letras coinciden por prefijo («tard» alcanza «tardanz»). Puntaje = suma / lexemas de la consulta.
  async scoreMatches(text: string, filler: string): Promise<FaqMatch[]> {
    const rows = await this.prisma.db.$queryRaw<ScoreRow[]>(Prisma.sql`
      WITH q AS (${queryLexemes(text, filler)}),
      n AS (SELECT count(*) AS total FROM q),
      docs AS (
        SELECT f.id,
               setweight(to_tsvector('gns_spanish', f.pregunta || ' ' || coalesce(f.palabras_clave, '')), 'A')
               || setweight(to_tsvector('gns_spanish', f.respuesta), 'D') AS doc
        FROM pregunta_frecuente f
        WHERE f.activa
      ),
      per_lexeme AS (
        SELECT d.id,
               q.lexeme,
               bool_or('A' = ANY (dl.weights)) AS strong
        FROM docs d
        CROSS JOIN q
        JOIN LATERAL unnest(d.doc) AS dl(lexeme, positions, weights)
          ON dl.lexeme = q.lexeme
          OR (length(q.lexeme) >= 4 AND starts_with(dl.lexeme, q.lexeme))
        GROUP BY d.id, q.lexeme
      )
      SELECT f.id::text AS id,
             f.categoria AS category,
             f.pregunta AS question,
             f.respuesta AS answer,
             f.fuente AS source,
             (sum(CASE WHEN p.strong THEN 1 ELSE 0.25 END) / n.total)::float8 AS score,
             (count(*) FILTER (WHERE p.strong))::int AS strong_matches
      FROM per_lexeme p
      JOIN pregunta_frecuente f ON f.id = p.id
      CROSS JOIN n
      GROUP BY f.id, n.total
      ORDER BY score DESC, strong_matches DESC, f.pregunta ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      question: row.question,
      answer: row.answer,
      source: row.source,
      score: row.score,
      strongMatches: row.strong_matches,
    }));
  }
}
