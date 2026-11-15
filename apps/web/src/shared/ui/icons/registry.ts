import {
  Backpack,
  Ban,
  Baby,
  Cake,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Flame,
  GraduationCap,
  GripVertical,
  Handshake,
  Heart,
  History,
  Info,
  Languages,
  Layers,
  Lightbulb,
  LifeBuoy,
  Lock,
  LogOut,
  Medal,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Monitor,
  Moon,
  NotepadText,
  Pencil,
  PiggyBank,
  Plus,
  Route,
  Save,
  Send,
  Star,
  Sun,
  Ticket,
  TrendingUp,
  TriangleAlert,
  Upload,
  Users,
  Utensils,
  X,
  ArrowRight,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import { PiarIcon } from './custom/piar-icon';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/*
 * Registro de iconos con nombres GNS (los del tablero v47). Cada nombre apunta a un
 * icono de Lucide o, si Lucide no lo tiene, a un SVG propio en ./custom.
 *
 * Regla de relleno del tablero (layer-iconos.css): el trazo fino es la voz por defecto;
 * el relleno suave («tone») o sólido («solid») es solo para la sección activa, las
 * baldosas de icono, las observaciones y los premios. Los iconos de trazo abierto
 * (flechas, marcas, líneas) nunca se rellenan: el relleno los deformaría.
 */
export const OPEN_STROKE_ICONS = {
  ruta: Route,
  check: Check,
  flecha: ArrowRight,
  siguiente: ChevronRight,
  volver: ChevronLeft,
  tendencia: TrendingUp,
  x: X,
  mas: Plus,
  subir: Upload,
  bajar: Download,
  salir: LogOut,
  historial: History,
  externo: ExternalLink,
  arriba: ChevronUp,
  abajo: ChevronDown,
  arrastre: GripVertical,
  anular: Ban,
  idiomas: Languages,
  acuerdo: Handshake,
  cubiertos: Utensils,
  grafica: ChartNoAxesColumn,
  enviar: Send,
  puntos: Ellipsis,
} satisfies Record<string, IconComponent>;

export const FILLABLE_ICONS = {
  plan: NotepadText,
  formatos: FileCheck,
  documento: FileText,
  chat: MessageCircle,
  comentario: MessageSquare,
  piar: PiarIcon,
  gente: Users,
  bitacora: Clock,
  guardar: Save,
  lapiz: Pencil,
  estrella: Star,
  tiquete: Ticket,
  medalla: Medal,
  llama: Flame,
  idea: Lightbulb,
  corazon: Heart,
  capas: Layers,
  candado: Lock,
  ahorro: PiggyBank,
  pastel: Cake,
  sol: Sun,
  luna: Moon,
  pantalla: Monitor,
  salvavidas: LifeBuoy,
  ojo: Eye,
  megafono: Megaphone,
  birrete: GraduationCap,
  bebe: Baby,
  morral: Backpack,
  info: Info,
  alerta: TriangleAlert,
  error: CircleAlert,
  exito: CircleCheck,
  cerrado: CircleX,
} satisfies Record<string, IconComponent>;

export type OpenStrokeIconName = keyof typeof OPEN_STROKE_ICONS;
export type FillableIconName = keyof typeof FILLABLE_ICONS;
export type IconName = OpenStrokeIconName | FillableIconName;

export function isOpenStrokeIcon(name: IconName): name is OpenStrokeIconName {
  return name in OPEN_STROKE_ICONS;
}

export const ICONS: Record<IconName, IconComponent> = { ...OPEN_STROKE_ICONS, ...FILLABLE_ICONS };
