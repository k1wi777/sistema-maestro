import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { ModuleRef, Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import type { AuditLogService } from '../../modules/auditoria/audit-log.service';
import { REDACTED } from './audit-data';
import { AuditInterceptor } from './audit.interceptor';
import type { AuditedOptions } from './audited.decorator';

const ID = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c';

function setup(redact: readonly string[] | undefined, states: (Record<string, unknown> | null)[]) {
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
  } as AuditedOptions;
  const interceptor = new AuditInterceptor(
    { get: () => options } as unknown as Reflector,
    { get: () => ({ load }) } as unknown as ModuleRef,
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
