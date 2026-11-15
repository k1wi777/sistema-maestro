import { createZodDto as baseCreateZodDto, type ZodDto } from 'nestjs-zod';

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Normaliza un esquema JSON: `type: [X, "null"]` pasa a `type: X, nullable: true`.
 *
 * Zod 4 emite `.nullable()` de un primitivo como `type: ["string", "null"]` y
 * `@nestjs/swagger` lo lee como «arreglo de», de modo que `string | null` quedaba
 * documentado como `string[]`. Recorre `properties`, `items`, `anyOf`/`oneOf`/`allOf`
 * y `additionalProperties`; el resto de claves se copia tal cual.
 */
export function normalizeNullableTypes(schema: unknown): unknown {
  if (!isObject(schema)) return schema;
  const result: JsonObject = { ...schema };

  if (Array.isArray(result.type)) {
    const types = result.type as unknown[];
    const nonNull = types.filter((type) => type !== 'null');
    if (!types.includes('null') || nonNull.length !== 1) {
      throw new Error(
        `Esquema OpenAPI no soportado: type ${JSON.stringify(types)}. Solo se admite [X, "null"].`,
      );
    }
    result.type = nonNull[0];
    result.nullable = true;
  }

  if (isObject(result.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, normalizeNullableTypes(value)]),
    );
  }
  if (result.items !== undefined) {
    result.items = Array.isArray(result.items)
      ? result.items.map(normalizeNullableTypes)
      : normalizeNullableTypes(result.items);
  }
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branches = result[key];
    if (Array.isArray(branches)) result[key] = branches.map(normalizeNullableTypes);
  }
  if (isObject(result.additionalProperties)) {
    result.additionalProperties = normalizeNullableTypes(result.additionalProperties);
  }
  return result;
}

const normalizeFactory = (factory: () => unknown): unknown =>
  normalizeNullableTypes({ type: 'object', properties: factory() });

const normalizedProperties = (factory: () => unknown): unknown =>
  (normalizeFactory(factory) as { properties: unknown }).properties;

/**
 * `createZodDto` de nestjs-zod con el contrato OpenAPI corregido: los campos que
 * aceptan `null` se documentan con `nullable: true`. Es la única forma permitida de
 * crear un DTO (lo exige ESLint). `name` fija el nombre de la clase (y `<name>_Output`)
 * en los DTO que no se heredan, como las uniones; sin él, el DTO toma el nombre de la
 * clase que lo hereda.
 */
export function createZodDto<
  TSchema extends Parameters<typeof baseCreateZodDto>[0],
  TCodec extends boolean = false,
>(schema: TSchema, options?: { codec: TCodec }, name?: string): ZodDto<TSchema, TCodec> {
  const Base = baseCreateZodDto(schema, options) as unknown as {
    new (): object;
    _OPENAPI_METADATA_FACTORY(): unknown;
    Output: { new (): object; _OPENAPI_METADATA_FACTORY(): unknown };
  };

  class NormalizedZodDto extends (Base as unknown as new () => object) {
    static _OPENAPI_METADATA_FACTORY(): unknown {
      return normalizedProperties(() => Base._OPENAPI_METADATA_FACTORY.call(this));
    }

    static get Output(): unknown {
      // El receptor es `this`: el nombre `<Clase>_Output` sale de la clase que hereda.
      const BaseOutput = Reflect.get(Base, 'Output', this);
      class NormalizedOutput extends (BaseOutput as unknown as new () => object) {
        static _OPENAPI_METADATA_FACTORY(): unknown {
          return normalizedProperties(() => BaseOutput._OPENAPI_METADATA_FACTORY.call(this));
        }
      }
      Object.defineProperty(NormalizedOutput, 'name', { value: BaseOutput.name });
      return NormalizedOutput;
    }
  }

  // El nombre por defecto es el de nestjs-zod; así `class X extends createZodDto(...)` se
  // documenta con el nombre de X y los DTO sin heredar siguen la misma regla.
  Object.defineProperty(NormalizedZodDto, 'name', { value: name ?? Base.name });
  return NormalizedZodDto as unknown as ZodDto<TSchema, TCodec>;
}
