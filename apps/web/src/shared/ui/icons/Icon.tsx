import type { CSSProperties } from 'react';

import {
  isOpenStrokeIcon,
  ICONS,
  type FillableIconName,
  type IconName,
  type OpenStrokeIconName,
} from './registry';

export type IconFill = 'none' | 'tone' | 'solid';

interface BaseIconProps {
  /** Tamaño en px (24×24 de origen). */
  size?: number;
  /** Texto accesible. Sin él, el icono es decorativo (`aria-hidden`). */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

// Unión discriminada: un icono de trazo abierto solo admite `fill="none"`.
type OpenStrokeIconProps = BaseIconProps & { name: OpenStrokeIconName; fill?: 'none' };
type FillableIconProps = BaseIconProps & { name: FillableIconName; fill?: IconFill };
// Para consumidores que reciben un `IconName` cualquiera: solo pueden pedir trazo.
type PlainIconProps = BaseIconProps & { name: IconName; fill?: 'none' };
export type IconProps = OpenStrokeIconProps | FillableIconProps | PlainIconProps;

const STROKE_WIDTH = 1.75;
const FILL_OPACITY: Record<IconFill, number> = { none: 0, tone: 0.28, solid: 1 };

export function Icon({ name, size = 20, label, fill = 'none', className, style }: IconProps) {
  const Glyph = ICONS[name];
  // Defensa en profundidad: aunque los tipos se esquiven, un icono abierto no se rellena.
  const effectiveFill: IconFill = isOpenStrokeIcon(name) ? 'none' : fill;

  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={STROKE_WIDTH}
      fill={effectiveFill === 'none' ? 'none' : 'currentColor'}
      fillOpacity={FILL_OPACITY[effectiveFill]}
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}
