'use client';

import { joinNames, type CatalogGradeScope } from '@/shared/records';
import { SegmentedFilter, type SegmentedOption } from '@/shared/ui';

import type { InboxScope } from '../model/inbox-scope';

interface InboxScopeFilterProps {
  /** Grados de la coordinadora: dan nombre a «Mis grados». */
  grades: readonly CatalogGradeScope[];
  scope: InboxScope;
  onChange: (scope: InboxScope) => void;
}

/** «Mis grados · Kinder y Transition» / «Todo el colegio»: el alcance de las bandejas de coordinación. */
export function InboxScopeFilter({ grades, scope, onChange }: InboxScopeFilterProps) {
  const options: SegmentedOption<InboxScope>[] = [
    { value: 'mine', label: `Mis grados · ${joinNames(grades.map((grade) => grade.name))}` },
    { value: 'all', label: 'Todo el colegio' },
  ];
  return (
    <SegmentedFilter
      label="Ver registros de"
      options={options}
      value={scope}
      onChange={(value) => onChange(value)}
    />
  );
}
