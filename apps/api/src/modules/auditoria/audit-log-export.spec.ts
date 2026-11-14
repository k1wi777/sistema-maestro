import { CSV_BOM } from '../../shared/csv/csv';
import { exportCsv, exportFileName, exportRows } from './audit-log-export';
import type { AuditLogRow } from './audit-log-read.repository';

const row = (overrides: Partial<AuditLogRow> = {}): AuditLogRow => ({
  id: '42',
  occurredAt: new Date('2026-11-15T04:30:05Z'),
  user: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', name: 'Ana Pérez' },
  role: 'coordinador',
  type: 'planeacion',
  action: 'Aprobó la planeación',
  entity: 'planeacion',
  entityId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  detail: 'Sin observaciones',
  ...overrides,
});

describe('exportRows (R12)', () => {
  it('writes the columns in order with the Colombia time', () => {
    expect(exportRows([row()])).toEqual([
      [
        '42',
        '2026-11-14 23:30:05',
        'Ana Pérez',
        'coordinador',
        'planeacion',
        'Aprobó la planeación',
        'planeacion',
        '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        'Sin observaciones',
      ],
    ]);
  });

  it('leaves the user and optional cells empty', () => {
    const [cells] = exportRows([row({ user: null, entity: null, entityId: null, detail: null })]);

    expect(cells?.[2]).toBe('');
    expect(cells?.slice(6)).toEqual(['', '', '']);
  });
});

describe('exportCsv (R11)', () => {
  it('starts with the BOM and the header separated by semicolons', () => {
    const csv = exportCsv([row()]);

    expect(csv.startsWith(`${CSV_BOM}N.º;Fecha y hora;Usuario;Rol;Tipo;Acción;Entidad;`)).toBe(
      true,
    );
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('neutralizes formulas in the action and the detail', () => {
    const csv = exportCsv([row({ action: '=HYPERLINK("x")', detail: '+1' })]);

    expect(csv).toContain(`;"'=HYPERLINK(""x"")";`);
    expect(csv).toContain(";'+1\r\n");
  });
});

describe('exportFileName (R11)', () => {
  it('uses the Colombia date', () => {
    expect(exportFileName(new Date('2026-11-15T04:30:00Z'))).toBe('bitacora-2026-11-14.csv');
  });
});
