'use client';

import {
  SEARCH_MIN_LENGTH,
  SharedActivityType,
  type SharedActivity,
  type SharedActivityListFilters,
} from '@gns/shared';
import { useEffect, useState } from 'react';

import { useSession } from '@/shared/session';
import { Button, Notice, SegmentedFilter, Select, TextInput } from '@/shared/ui';

import { setSharedActivityFavorite } from '../api/shared-activities';
import { readyOr, useActivityCatalogs } from '../hooks/use-activity-catalogs';
import { useQueryParams } from '@/shared/data';
import { useSharedActivities } from '../hooks/use-shared-activities';
import { ACTIVITY_TYPE_OPTIONS } from '../model/activity-types';
import { ActivityCard } from './activity-card';
import { LoadError, Loading } from '@/shared/data';
import styles from './repository-panel.module.css';
import { ShareActivityDialog, type ShareActivityMode } from './share-activity-dialog';
import { WithdrawDialog } from './withdraw-dialog';

const SEARCH_DELAY_MS = 300;
const FAVORITES = 'favoritas';
const MINE = 'mias';

const QUICK_FILTERS = [
  { value: FAVORITES, label: 'Mis favoritas' },
  { value: MINE, label: 'Mías' },
];

function activityTypeFromUrl(value: string | null): SharedActivityType | undefined {
  return Object.values(SharedActivityType).find((type) => type === value);
}

/** Repositorio de la comunidad: buscar, filtrar, marcar favoritas, compartir y usar actividades. */
export function RepositoryPanel() {
  const { state: session } = useSession();
  const userId = session.status === 'authenticated' ? session.user.id : undefined;
  const { params, update } = useQueryParams();

  const levelId = params.get('nivel') ?? undefined;
  const gradeId = params.get('grado') ?? undefined;
  const areaId = params.get('area') ?? undefined;
  const learningCorner = params.get('rincon') ?? undefined;
  const activityType = activityTypeFromUrl(params.get('tipo'));
  const urlQuery = params.get('q') ?? undefined;
  const onlyFavorites = params.get(FAVORITES) === '1';
  const onlyMine = params.get(MINE) === '1';
  const quick = [onlyFavorites ? FAVORITES : null, onlyMine ? MINE : null].filter(
    (value): value is string => value !== null,
  );

  const [searchText, setSearchText] = useState(urlQuery ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ShareActivityMode | null>(null);
  const [withdrawing, setWithdrawing] = useState<SharedActivity | null>(null);

  const catalogs = useActivityCatalogs(levelId);
  const searchTooShort =
    searchText.trim().length > 0 && searchText.trim().length < SEARCH_MIN_LENGTH;

  // La búsqueda espera 300 ms tras la última letra y no se envía con menos de 2 caracteres.
  useEffect(() => {
    const trimmed = searchText.trim();
    const wanted = trimmed.length >= SEARCH_MIN_LENGTH ? trimmed : undefined;
    if (wanted === urlQuery) {
      return;
    }
    const timer = window.setTimeout(() => update({ q: wanted }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchText, urlQuery, update]);

  // Con grado se envía solo `gradeId`: la API ya incluye las actividades de todo el nivel.
  const filters: SharedActivityListFilters = {
    q: urlQuery,
    levelId: gradeId ? undefined : levelId,
    gradeId,
    areaId,
    learningCorner,
    activityType,
    authorId: onlyMine ? userId : undefined,
    favorites: onlyFavorites ? true : undefined,
  };
  const list = useSharedActivities(filters);

  const levelOptions = readyOr(catalogs.levels).map((level) => ({
    value: level.id,
    label: level.name,
  }));
  const gradeOptions = [...readyOr(catalogs.grades)]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((grade) => ({ value: grade.id, label: grade.name }));
  const areaOptions = readyOr(catalogs.areas).map((area) => ({ value: area.id, label: area.name }));
  const cornerOptions = readyOr(catalogs.corners).map((corner) => ({
    value: corner,
    label: corner,
  }));

  async function toggleFavorite(activity: SharedActivity) {
    const wanted = !activity.isFavorite;
    setMessage(null);
    const apply = (value: boolean) =>
      list.mutate((items) =>
        items.map((item) => (item.id === activity.id ? { ...item, isFavorite: value } : item)),
      );
    apply(wanted);
    const result = await setSharedActivityFavorite(activity.id, wanted);
    if (!result.ok) {
      apply(!wanted);
      setMessage(`No pudimos actualizar la favorita «${activity.title}»: ${result.error.message}`);
    }
  }

  if (!userId) {
    return null;
  }
  const filtered = Boolean(
    urlQuery || levelId || gradeId || areaId || learningCorner || activityType || quick.length > 0,
  );

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <p className={styles.lead}>
          Actividades, juegos y recursos creados por docentes GNS. Filtra, marca tus favoritas y
          úsalas en tus planeaciones.
        </p>
        <Button startIcon="mas" onClick={() => setDialog({ kind: 'create' })}>
          Compartir una actividad
        </Button>
      </div>

      <div className={styles.filters}>
        <div className={styles.search}>
          <TextInput
            label="Buscar"
            type="search"
            maxLength={100}
            placeholder="Ej. emociones, fracciones, Sweet Home"
            value={searchText}
            help={searchTooShort ? 'Escribe al menos 2 caracteres para buscar.' : undefined}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>
        <Select
          label="Nivel"
          placeholder="Todos los niveles"
          options={levelOptions}
          value={levelId ?? ''}
          onChange={(event) => update({ nivel: event.target.value, grado: null, rincon: null })}
        />
        <Select
          label="Grado"
          placeholder="Todos"
          options={gradeOptions}
          value={gradeId ?? ''}
          disabled={!levelId}
          onChange={(event) => update({ grado: event.target.value })}
        />
        <Select
          label="Área"
          placeholder="Todas las áreas"
          options={areaOptions}
          value={areaId ?? ''}
          onChange={(event) => update({ area: event.target.value })}
        />
        <Select
          label="Rincón o zona"
          placeholder="Todos los rincones"
          options={cornerOptions}
          value={learningCorner ?? ''}
          onChange={(event) => update({ rincon: event.target.value })}
        />
        <Select
          label="Tipo"
          placeholder="Todos los tipos"
          options={ACTIVITY_TYPE_OPTIONS}
          value={activityType ?? ''}
          onChange={(event) => update({ tipo: event.target.value })}
        />
      </div>
      <div className={styles.quick}>
        <SegmentedFilter
          multiple
          label="Mostrar solo"
          options={QUICK_FILTERS}
          values={quick}
          onChange={(values) =>
            update({
              [FAVORITES]: values.includes(FAVORITES) ? '1' : null,
              [MINE]: values.includes(MINE) ? '1' : null,
            })
          }
        />
      </div>

      <div aria-live="polite" className={styles.live}>
        {message ? <Notice tone="warning">{message}</Notice> : null}
      </div>

      {list.status === 'loading' ? <Loading>Cargando actividades…</Loading> : null}
      {list.status === 'error' && list.error ? (
        <LoadError
          error={list.error}
          title="No pudimos cargar el repositorio"
          onRetry={list.reload}
        />
      ) : null}
      {list.status === 'ready' && list.items.length === 0 ? (
        <Notice tone="info" title={filtered ? 'Sin resultados' : 'El repositorio está vacío'}>
          {filtered
            ? 'Ninguna actividad cumple estos filtros. Cambia o quita alguno para ver más.'
            : 'Aún nadie ha compartido actividades. Sé el primero con «Compartir una actividad».'}
        </Notice>
      ) : null}
      {list.status === 'ready' && list.items.length > 0 ? (
        <>
          <p className={styles.count} role="status">
            {list.totalItems === 1 ? '1 actividad' : `${list.totalItems} actividades`}
          </p>
          <ul className={styles.grid}>
            {list.items.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                own={activity.author.id === userId}
                onToggleFavorite={(item) => void toggleFavorite(item)}
                onEdit={(item) => setDialog({ kind: 'edit', activity: item })}
                onWithdraw={setWithdrawing}
              />
            ))}
          </ul>
          {list.error ? <LoadError error={list.error} onRetry={list.loadMore} /> : null}
          {list.hasMore ? (
            <div className={styles.more}>
              <Button variant="outline" disabled={list.loadingMore} onClick={list.loadMore}>
                {list.loadingMore ? 'Cargando…' : 'Cargar más'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {dialog ? (
        <ShareActivityDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onSaved={(activity, kind) => {
            setDialog(null);
            setMessage(
              activity === null
                ? 'No hiciste cambios.'
                : kind === 'create'
                  ? `Publicaste «${activity.title}» en el repositorio.`
                  : `Guardaste los cambios de «${activity.title}».`,
            );
            list.reload();
          }}
        />
      ) : null}
      {withdrawing ? (
        <WithdrawDialog
          activity={withdrawing}
          onClose={() => setWithdrawing(null)}
          onWithdrawn={() => {
            setMessage(`Retiraste «${withdrawing.title}» del repositorio.`);
            setWithdrawing(null);
            list.reload();
          }}
        />
      ) : null}
    </div>
  );
}
