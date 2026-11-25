'use client';

import { useState } from 'react';

import {
  ActionBar,
  ActionMenu,
  BrandMark,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  FormatCard,
  Icon,
  Notice,
  Observation,
  PageContainer,
  PageHeader,
  RecordCard,
  SegmentedFilter,
  Select,
  StatStrip,
  StatusBadge,
  Stepper,
  StepSummary,
  Tabs,
  TextArea,
  TextInput,
  ThemeToggle,
  type FillableIconName,
  type OpenStrokeIconName,
  type SaveState,
  type StepperStep,
} from '@/shared/ui';
import { AccessDeniedNotice, SessionEndedNotice } from '@/shared/session';

import styles from './showcase.module.css';

// Todos los datos son demo con nombres inventados.
interface DemoTeacher {
  id: string;
  name: string;
  area: string;
  plans: number;
  status: 'Al día' | 'Con observaciones' | 'Pendiente';
}

const TEACHERS: DemoTeacher[] = [
  { id: 't1', name: 'Marcela Rojas', area: 'Matemáticas', plans: 12, status: 'Al día' },
  {
    id: 't2',
    name: 'Laura Méndez',
    area: 'Lengua castellana',
    plans: 9,
    status: 'Con observaciones',
  },
  { id: 't3', name: 'Sara Gómez', area: 'Ciencias naturales', plans: 4, status: 'Pendiente' },
];

const STATUS_TONE = {
  'Al día': 'success',
  'Con observaciones': 'warning',
  Pendiente: 'neutral',
} as const;

const OPEN_ICONS: OpenStrokeIconName[] = [
  'ruta',
  'check',
  'flecha',
  'siguiente',
  'volver',
  'mas',
  'subir',
  'salir',
  'historial',
  'externo',
  'enviar',
  'anular',
  'bitacora',
];

const FILLABLE_ICON_NAMES: FillableIconName[] = [
  'plan',
  'formatos',
  'chat',
  'piar',
  'gente',
  'guardar',
  'lapiz',
  'estrella',
  'medalla',
  'llama',
  'idea',
];

const WIZARD_STEPS = [
  { id: 'datos', title: 'Datos generales', hint: 'Grado, área y fecha' },
  { id: 'objetivos', title: 'Objetivos', hint: 'Qué se espera lograr' },
  { id: 'momentos', title: 'Momentos de la clase', hint: 'Inicio, desarrollo, cierre' },
  { id: 'resumen', title: 'Resumen', hint: 'Revisar y enviar' },
] as const;

const FILTER_OPTIONS = [
  { value: 'todas', label: 'Todas', count: 25 },
  { value: 'borrador', label: 'Borrador', count: 6 },
  { value: 'enviada', label: 'Enviadas', count: 11 },
  { value: 'revisada', label: 'Revisadas', count: 8 },
];

type FilterValue = 'todas' | 'borrador' | 'enviada' | 'revisada';

export function Showcase() {
  const [filter, setFilter] = useState<FilterValue>('todas');
  const [multi, setMulti] = useState<string[]>(['lengua']);
  const [currentStep, setCurrentStep] = useState<string>('datos');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [visited, setVisited] = useState<string[]>([]);
  const [objectives, setObjectives] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastAction, setLastAction] = useState('Ninguna todavía');

  function changeStep(nextId: string) {
    // Aquí la feature real guardaría el paso que se deja; la muestra lo simula en memoria.
    setSaveState('saving');
    setVisited((previous) =>
      previous.includes(currentStep) ? previous : [...previous, currentStep],
    );
    window.setTimeout(() => setSaveState('saved'), 400);
    setCurrentStep(nextId);
  }

  const steps: StepperStep[] = WIZARD_STEPS.map((step) => ({
    id: step.id,
    title: step.title,
    hint: step.hint,
    state:
      step.id === 'objetivos' && objectives.trim() === '' && visited.includes('objetivos')
        ? 'empty'
        : visited.includes(step.id)
          ? 'done'
          : 'pending',
  }));

  return (
    <PageContainer>
      <PageHeader
        context="Sistema de diseño"
        title="Muestra de componentes"
        description="Todos los componentes de la plataforma con datos demo. Cambia el tema para verlos en claro y oscuro."
        actions={<ThemeToggle />}
        back={{ href: '/muestra', label: 'Volver a la muestra' }}
      />

      <div className={styles.stack}>
        <Card title="Marca y tipografía">
          <div className={styles.row}>
            <BrandMark tagline="Montería, Colombia" />
          </div>
          <h3 className={styles.sampleTitle}>Títulos en Plus Jakarta Sans</h3>
          <p>
            El texto corrido usa Inter. Ningún texto baja de 12 px, y el contraste cumple 4.5 a 1 en
            claro y en oscuro.
          </p>
          <p className={styles.small}>
            Texto auxiliar de 13 px, con tildes y eñes: ¿cómo está el año?
          </p>
        </Card>

        <Card title="Iconos">
          <p className={styles.small}>
            Trazo fino por defecto. Los de trazo abierto nunca se rellenan.
          </p>
          <ul className={styles.icons} aria-label="Iconos de trazo">
            {OPEN_ICONS.map((name) => (
              <li key={name}>
                <Icon name={name} />
                <span>{name}</span>
              </li>
            ))}
          </ul>
          <p className={styles.small}>
            Intensidades: trazo, tono y sólido (solo en iconos rellenables).
          </p>
          <ul className={styles.icons} aria-label="Iconos con relleno">
            {FILLABLE_ICON_NAMES.map((name, index) => (
              <li key={name}>
                <Icon
                  name={name}
                  size={24}
                  fill={index % 3 === 0 ? 'none' : index % 3 === 1 ? 'tone' : 'solid'}
                />
                <span>{name}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Botones">
          <div className={styles.row}>
            <Button startIcon="guardar">Guardar</Button>
            <Button variant="danger" endIcon="enviar">
              Enviar
            </Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost" startIcon="volver">
              Fantasma
            </Button>
            <Button variant="primary" disabled>
              Deshabilitado
            </Button>
          </div>
          <div className={styles.row}>
            <Button size="sm">Pequeño</Button>
            <Button size="sm" variant="outline" startIcon="mas">
              Añadir
            </Button>
            <Button variant="void" startIcon="anular">
              Anular registro
            </Button>
          </div>
        </Card>

        <Card title="Campos">
          <div className={styles.grid}>
            <TextInput
              label="Nombre de la planeación"
              help="Un nombre corto que reconozcas luego."
              placeholder="Ej.: Fracciones en la vida diaria"
              required
            />
            <TextInput label="Fecha de clase" type="date" />
            <Select
              label="Grado"
              placeholder="Selecciona un grado"
              options={[
                { value: '5a', label: 'Quinto A' },
                { value: '6b', label: 'Sexto B' },
              ]}
            />
            <TextInput
              label="Correo institucional"
              type="email"
              defaultValue="correo-invalido"
              error="Escribe un correo con el formato nombre@dominio."
            />
            <TextInput label="Campo deshabilitado" defaultValue="Solo lectura" disabled />
          </div>
          <TextArea
            label="Observaciones"
            help="Describe lo que viste en la clase."
            placeholder="Escribe aquí…"
          />
          <Checkbox
            label="Acepto el aviso de tratamiento de datos"
            help="Versión vigente del aviso."
          />
          <Checkbox label="Casilla con error" error="Debes marcarla para continuar." />
        </Card>

        <Card title="Avisos y observaciones">
          <div className={styles.stackTight}>
            <Notice tone="info" title="Información">
              Tu planeación se guarda cada vez que cambias de paso.
            </Notice>
            <Notice tone="success">La planeación fue enviada a coordinación.</Notice>
            <Notice tone="warning" title="Atención">
              Faltan dos momentos de la clase por completar.
            </Notice>
            <Notice tone="error">No pudimos guardar los cambios. Inténtalo de nuevo.</Notice>
            <Observation author="Coordinación" date="14 de noviembre">
              Ajusta el objetivo para que sea medible y menciona el recurso que usarás.
            </Observation>
          </div>
        </Card>

        <Card title="Tarjetas de registro y estados">
          <div className={styles.grid}>
            <RecordCard
              title="Fracciones en la vida diaria"
              tone="info"
              status={<StatusBadge tone="info">Borrador</StatusBadge>}
              meta={['Quinto A', 'Matemáticas']}
              actions={
                <Button size="sm" variant="outline">
                  Abrir
                </Button>
              }
            />
            <RecordCard
              title="El ciclo del agua"
              tone="warning"
              status={<StatusBadge tone="warning">Enviada</StatusBadge>}
              meta={['Sexto B', 'Ciencias naturales']}
              actions={
                <Button size="sm" variant="outline">
                  Abrir
                </Button>
              }
            />
            <RecordCard
              title="Textos instructivos"
              tone="success"
              status={<StatusBadge tone="success">Revisada</StatusBadge>}
              meta={['Quinto A', 'Lengua castellana']}
              actions={
                <Button size="sm" variant="outline">
                  Abrir
                </Button>
              }
            />
            <RecordCard
              title="Mapa de Colombia"
              tone="danger"
              status={<StatusBadge tone="danger">Con observaciones</StatusBadge>}
              meta={['Sexto B', 'Sociales']}
              actions={
                <Button size="sm" variant="outline">
                  Abrir
                </Button>
              }
            />
          </div>
          <div className={styles.row}>
            <StatusBadge>Neutral</StatusBadge>
            <StatusBadge tone="info">Información</StatusBadge>
            <StatusBadge tone="success">Éxito</StatusBadge>
            <StatusBadge tone="warning">Advertencia</StatusBadge>
            <StatusBadge tone="danger">Peligro</StatusBadge>
          </div>
        </Card>

        <Card title="Tarjetas de formato">
          <div className={styles.grid}>
            <FormatCard
              headingLevel={3}
              title="Planeación GNS"
              description="Planea tus clases con el modelo GNS y envíalas a revisión."
              icon="plan"
              href="/muestra"
            />
            <FormatCard
              headingLevel={3}
              title="Diarios de campo"
              description="Revisa el diario de cada grupo y día."
              icon="formatos"
              href="/muestra"
              badge={<StatusBadge tone="warning">3 pendientes</StatusBadge>}
            />
            <FormatCard
              headingLevel={3}
              title="PIAR · Inclusión"
              description="Llegará en una etapa posterior."
              icon="piar"
              soon
            />
          </div>
        </Card>

        <Card title="Indicadores">
          <div className={styles.stackTight}>
            <StatStrip
              label="Indicadores de ejemplo"
              items={[
                { key: 'pend', icon: 'historial', value: 7, label: 'Pendientes de revisión' },
                { key: 'obs', icon: 'comentario', value: 3, label: 'Con observaciones' },
                { key: 'rev', icon: 'check', value: 18, label: 'Revisadas' },
              ]}
            />
            <StatStrip
              neutral
              label="Indicadores seleccionables"
              items={[
                {
                  key: 'todas',
                  icon: 'plan',
                  value: 28,
                  label: 'Todas',
                  selected: filter === 'todas',
                  onSelect: () => setFilter('todas'),
                },
                {
                  key: 'borrador',
                  icon: 'lapiz',
                  value: 6,
                  label: 'Borradores',
                  selected: filter === 'borrador',
                  onSelect: () => setFilter('borrador'),
                },
                {
                  key: 'enviada',
                  icon: 'enviar',
                  value: 11,
                  label: 'Enviadas',
                  selected: filter === 'enviada',
                  onSelect: () => setFilter('enviada'),
                },
              ]}
            />
          </div>
        </Card>

        <Card title="Barra de filtros y estado vacío">
          <div className={styles.stackTight}>
            <FilterBar label="Filtros de ejemplo">
              <Select
                size="sm"
                label="Grado"
                placeholder="Todos los grados"
                options={[
                  { value: '5a', label: 'Quinto A' },
                  { value: '6b', label: 'Sexto B' },
                ]}
              />
              <TextInput size="sm" type="search" label="Buscar" placeholder="Nombre del docente" />
            </FilterBar>
            <EmptyState icon="plan" title="Aún no hay planeaciones">
              Cuando los docentes envíen planeaciones aparecerán aquí.
            </EmptyState>
          </div>
        </Card>

        <Card title="Tabla de datos">
          <DataTable<DemoTeacher>
            embedded
            caption="Docentes de ejemplo"
            getRowKey={(row) => row.id}
            columns={[
              { key: 'name', header: 'Docente', render: (row) => row.name },
              { key: 'area', header: 'Área', render: (row) => row.area },
              { key: 'plans', header: 'Planeaciones', numeric: true, render: (row) => row.plans },
              {
                key: 'status',
                header: 'Estado',
                render: (row) => (
                  <StatusBadge tone={STATUS_TONE[row.status]}>{row.status}</StatusBadge>
                ),
              },
            ]}
            rows={TEACHERS}
          />
        </Card>

        <Card title="Pestañas y filtros">
          <Tabs
            label="Secciones de ejemplo"
            tabs={[
              {
                id: 'planes',
                label: 'Planeaciones',
                content: <p>Contenido de las planeaciones.</p>,
              },
              { id: 'formatos', label: 'Formatos', content: <p>Contenido de los formatos.</p> },
              { id: 'formacion', label: 'Formación', content: <p>Contenido de la formación.</p> },
            ]}
          />
          <SegmentedFilter
            label="Filtrar por estado"
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(value) => setFilter(value as FilterValue)}
          />
          <SegmentedFilter
            appearance="underline"
            label="Alcance de ejemplo"
            options={[
              { value: 'todas', label: 'Mis grados' },
              { value: 'borrador', label: 'Todo el colegio' },
            ]}
            value={filter === 'todas' ? 'todas' : 'borrador'}
            onChange={setFilter}
          />
          <SegmentedFilter
            multiple
            label="Áreas visibles"
            options={[
              { value: 'mate', label: 'Matemáticas' },
              { value: 'lengua', label: 'Lengua' },
              { value: 'ciencias', label: 'Ciencias' },
            ]}
            values={multi}
            onChange={setMulti}
          />
        </Card>

        <Card title="Diálogo y menú de acciones">
          <div className={styles.row}>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              Abrir diálogo
            </Button>
            <ActionMenu
              label="Más"
              icon="puntos"
              items={[
                {
                  id: 'all',
                  label: 'Ver todo el formulario',
                  icon: 'capas',
                  onSelect: () => setLastAction('Ver todo el formulario'),
                },
                {
                  id: 'pdf',
                  label: 'Exportar PDF',
                  icon: 'bajar',
                  onSelect: () => setLastAction('Exportar PDF'),
                },
                { id: 'off', label: 'Acción no disponible', disabled: true, onSelect: () => {} },
              ]}
            />
          </div>
          <p className={styles.small}>Última acción del menú: {lastAction}</p>
          <Dialog
            open={dialogOpen}
            title="Anular planeación"
            description="La planeación queda anulada y no se puede editar; coordinación conserva la constancia."
            onClose={() => setDialogOpen(false)}
            footer={
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={() => setDialogOpen(false)}>
                  Anular planeación
                </Button>
              </>
            }
          >
            <TextArea label="Motivo" required />
          </Dialog>
        </Card>

        <section aria-labelledby="session-title">
          <h2 id="session-title" className={styles.sectionTitle}>
            Sesión y acceso
          </h2>
          <div className={styles.stackTight}>
            <SessionEndedNotice />
            <Card title="Acceso denegado">
              <AccessDeniedNotice homePath="/docente" embedded />
            </Card>
          </div>
        </section>

        <section aria-labelledby="wizard-title">
          <h2 id="wizard-title" className={styles.sectionTitle}>
            Formulario por pasos
          </h2>
          <Stepper
            label="Pasos de la planeación de ejemplo"
            steps={steps}
            currentId={currentStep}
            onStepChange={changeStep}
            saveState={saveState}
          />
          <Card
            title={WIZARD_STEPS.find((step) => step.id === currentStep)?.title}
            step={WIZARD_STEPS.findIndex((step) => step.id === currentStep) + 1}
          >
            {currentStep === 'resumen' ? (
              <StepSummary
                items={WIZARD_STEPS.filter((step) => step.id !== 'resumen').map((step) => ({
                  id: step.id,
                  title: step.title,
                  complete:
                    step.id === 'objetivos' ? objectives.trim() !== '' : visited.includes(step.id),
                  detail:
                    step.id === 'objetivos' && objectives.trim() === ''
                      ? 'Falta escribir el objetivo.'
                      : visited.includes(step.id) || step.id === 'objetivos'
                        ? 'Completo'
                        : 'No has pasado por este paso.',
                }))}
                onGoToStep={changeStep}
                note="Al enviar, coordinación recibe la planeación para su revisión."
                submitLabel="Enviar planeación"
                onSubmit={() => setSaveState('saved')}
              />
            ) : currentStep === 'objetivos' ? (
              <TextArea
                label="Objetivo de la clase"
                value={objectives}
                onChange={(event) => setObjectives(event.target.value)}
                help="Los pasos son libres: puedes saltar a cualquiera."
              />
            ) : (
              <p>
                Contenido del paso «{WIZARD_STEPS.find((step) => step.id === currentStep)?.title}».
                Cada vez que cambias de paso, el estado de guardado se actualiza.
              </p>
            )}
          </Card>
        </section>
      </div>

      <ActionBar
        status={<span>{saveState === 'saved' ? 'Cambios guardados' : 'Sin guardar'}</span>}
      >
        <Button
          variant="outline"
          size="sm"
          startIcon="guardar"
          onClick={() => setSaveState('saved')}
        >
          Guardar
        </Button>
        <Button variant="danger" size="sm" endIcon="enviar">
          Enviar
        </Button>
      </ActionBar>
    </PageContainer>
  );
}
