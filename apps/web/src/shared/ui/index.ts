// API pública del sistema de diseño GNS. Las features importan solo desde '@/shared/ui'.
export { ActionBar, type ActionBarProps } from './components/ActionBar';
export { ActionMenu, type ActionMenuItem, type ActionMenuProps } from './components/ActionMenu';
export { BrandMark, type BrandMarkProps } from './components/BrandMark';
export {
  Button,
  ButtonLink,
  type ButtonLinkProps,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './components/Button';
export { Card, type CardProps } from './components/Card';
export { Checkbox, type CheckboxProps } from './components/Checkbox';
export { DataTable, type DataTableColumn, type DataTableProps } from './components/DataTable';
export { Dialog, type DialogProps } from './components/Dialog';
export { Field, type FieldControlProps, type FieldProps } from './components/Field';
export { Notice, type NoticeProps, type NoticeTone } from './components/Notice';
export { Observation, type ObservationProps } from './components/Observation';
export { PageContainer, type PageContainerProps } from './components/PageContainer';
export { PageHeader, type PageHeaderProps } from './components/PageHeader';
export { RecordCard, type RecordCardProps, type RecordTone } from './components/RecordCard';
export {
  SegmentedFilter,
  type SegmentedFilterProps,
  type SegmentedOption,
} from './components/SegmentedFilter';
export { Select, type SelectOption, type SelectProps } from './components/Select';
export { StatusBadge, type StatusBadgeProps, type StatusTone } from './components/StatusBadge';
export { StepSummary, type StepSummaryItem, type StepSummaryProps } from './components/StepSummary';
export {
  Stepper,
  type SaveState,
  type StepperProps,
  type StepperStep,
  type StepState,
} from './components/Stepper';
export { Tabs, type TabItem, type TabsProps } from './components/Tabs';
export { TextArea, type TextAreaProps } from './components/TextArea';
export { TextInput, type TextInputProps } from './components/TextInput';
export { Icon, type IconFill, type IconProps } from './icons/Icon';
export { isOpenStrokeIcon } from './icons/registry';
export type { FillableIconName, IconName, OpenStrokeIconName } from './icons/registry';
export { THEME_INIT_SCRIPT } from './theme/theme';
export { ThemeToggle } from './theme/ThemeToggle';
