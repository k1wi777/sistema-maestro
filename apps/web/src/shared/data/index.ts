// API pública de shared/data: carga de datos de la API con descarte de respuestas viejas, listas paginadas y parámetros de la URL.
export { LoadError, Loading } from './load-error';
export { usePagedList, type PagedList } from './use-paged-list';
export { useQueryParams } from './use-query-params';
export { useRemote, type Remote, type RemoteState } from './use-remote';
