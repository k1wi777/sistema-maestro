import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { ModuleRef, Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import type { AuditLogService } from '../../modules/auditoria/audit-log.service';
import { REDACTED } from './audit-data';
import { AuditInterceptor } from './audit.interceptor';
import type { AuditedOptions } from './audited.decorator';

const ID = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c';

function setup(
  redact: readonly string[] | undefined,
  states: (Record<string, unknown> | null)[],
  extra: { describe?: (snapshot: Record<string, unknown>) => string | null; detail?: string } = {},
) {
  const record = jest.fn<Promise<void>, [Record<string, unknown>]>().mockResolvedValue(undefined);
  const load = jest.fn();
  for (const state of states) {
    load.mockResolvedValueOnce(state);
  }
  const options = {
    type: 'diario',
    action: 'Acción',
    entity: 'tabla',
    snapshot: class {},
    redact,
    detail: extra.detail,
  } as AuditedOptions;
  const interceptor = new AuditInterceptor(
    { get: () => options } as unknown as Reflector,
    { get: () => ({ load, describe: extra.describe }) } as unknown as ModuleRef,
    { record } as unknown as AuditLogService,
    { run: <T>(fn: () => Promise<T>) => fn() },
  );
  const context = {
    getHandler: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ params: { id: ID }, body: {}, user: { id: ID, role: 'docente' } }),
    }),
  } as unknown as ExecutionContext;
  const run = () =>
    lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: ID }) } as CallHandler));
  return { record, run };
}

describe('AuditInterceptor con redact', () => {
  it('oculta el contenido de un alta (sin estado anterior)', async () => {
    const { record, run } = setup(['description'], [null, { id: ID, description: 'texto', n: 1 }]);
    await run();
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      dataBefore: null,
      dataAfter: { id: ID, description: REDACTED, n: 1 },
    });
  });

  it('en una edición muestra qué campo cambió pero no su valor', async () => {
    const { record, run } = setup(
      ['description'],
      [
        { description: 'antes', n: 1 },
        { description: 'después', n: 1 },
      ],
    );
    await run();
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      dataBefore: { description: REDACTED },
      dataAfter: { description: REDACTED },
    });
  });

  it('sin cambios en los campos ocultos no los incluye', async () => {
    const { record, run } = setup(
      ['description'],
      [
        { description: 'igual', n: 1 },
        { description: 'igual', n: 2 },
      ],
    );
    await run();
    expect(record.mock.calls[0]?.[0]).toMatchObject({ dataBefore: { n: 1 }, dataAfter: { n: 2 } });
  });

  it('sin la opción deja los datos como están', async () => {
    const { record, run } = setup(undefined, [null, { description: 'texto' }]);
    await run();
    expect(record.mock.calls[0]?.[0]).toMatchObject({ dataAfter: { description: 'texto' } });
  });
});

describe('AuditInterceptor con describe', () => {
  const describeState = (snapshot: Record<string, unknown>) => `Grupo · ${String(snapshot.n)}`;

  it('usa el detalle calculado del estado posterior cuando no hay otro', async () => {
    const { record, run } = setup(undefined, [null, { n: 3 }], { describe: describeState });
    await run();
    expect(record.mock.calls[0]?.[0]).toMatchObject({ detail: 'Grupo · 3' });
  });

  it('el detalle estático prevalece sobre el calculado', async () => {
    const { record, run } = setup(undefined, [null, { n: 3 }], {
      describe: describeState,
      detail: 'Fijo',
    });
    await run();
    expect(record.mock.calls[0]?.[0]).toMatchObject({ detail: 'Fijo' });
  });

  it('tras un borrado calcula el detalle del estado anterior', async () => {
    const { record, run } = setup(undefined, [{ n: 5 }, null], { describe: describeState });
    await run();
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      detail: 'Grupo · 5',
      dataBefore: { n: 5 },
      dataAfter: null,
    });
  });

  it('sin ningún estado no calcula nada', async () => {
    const { record, run } = setup(undefined, [null, null], { describe: describeState });
    await run();
    expect(record.mock.calls[0]?.[0]).toMatchObject({ detail: null });
  });
});
