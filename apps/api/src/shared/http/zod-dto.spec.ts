import { z } from 'zod';
import { createZodDto, normalizeNullableTypes } from './zod-dto';

const schema = z.object({
  title: z.string().nullable(),
  tags: z.array(z.string()),
  nested: z.object({ flag: z.boolean().nullable() }),
  list: z.array(z.object({ note: z.string().nullable() })),
});

type Dto = {
  _OPENAPI_METADATA_FACTORY(): Record<string, Record<string, unknown>>;
  Output: Dto;
  name: string;
};

describe('createZodDto', () => {
  class SampleDto extends createZodDto(schema) {}
  const dto = SampleDto as unknown as Dto;

  it('documents a top-level nullable as nullable, not as an array', () => {
    expect(dto._OPENAPI_METADATA_FACTORY().title).toMatchObject({ type: 'string', nullable: true });
  });

  it('normalizes nested nullables', () => {
    const properties = dto._OPENAPI_METADATA_FACTORY();
    const nested = properties.nested as { properties: Record<string, unknown> };
    const list = properties.list as { items: { properties: Record<string, unknown> } };
    expect(nested.properties.flag).toMatchObject({ type: 'boolean', nullable: true });
    expect(list.items.properties.note).toMatchObject({ type: 'string', nullable: true });
  });

  it('keeps a real array untouched', () => {
    const tags = dto._OPENAPI_METADATA_FACTORY().tags;
    expect(tags).toMatchObject({ type: 'array', items: { type: 'string' } });
    expect(tags?.nullable).toBeUndefined();
  });

  it('keeps the schema, the validation and the Output with its own name', () => {
    expect(SampleDto.schema).toBe(schema);
    expect(
      SampleDto.create({ title: null, tags: [], nested: { flag: null }, list: [] }),
    ).toBeDefined();
    expect(dto.Output.name).toBe('SampleDto_Output');
    expect(dto.Output._OPENAPI_METADATA_FACTORY().title).toMatchObject({
      type: 'string',
      nullable: true,
    });
  });

  it('uses an explicit name for the DTO and its Output', () => {
    const named = createZodDto(schema, undefined, 'NamedDto') as unknown as Dto;
    expect(named.name).toBe('NamedDto');
    expect(named.Output.name).toBe('NamedDto_Output');
  });

  it('fails on a type with several non-null types', () => {
    expect(() => normalizeNullableTypes({ type: ['string', 'number', 'null'] })).toThrow(
      /no soportado/,
    );
  });
});
