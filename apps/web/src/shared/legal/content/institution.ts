import { pending, type PendingValue } from './pending';

/** Datos del colegio confirmados (PEI, sitio web y el propio colegio) y los que siguen pendientes. */
export interface Institution {
  /** Nombre con el que la plataforma identifica al colegio. */
  readonly displayName: string;
  /** Nombre legal confirmado por el colegio. */
  readonly legalName: string;
  readonly nit: string;
  readonly address: string;
  readonly phones: string;
  readonly email: string;
  readonly legalRepresentative: string;
  readonly operatingLicense: string;
  readonly daneCode: string;
  readonly claimsArea: PendingValue;
  readonly claimsFormUrl: string;
}

export const INSTITUTION: Institution = {
  displayName: 'George Noble School',
  legalName: 'George Noble School',
  nit: '900.358.305-3',
  address: 'Carrera 6 # 78-70, barrio Sevilla, Montería',
  phones: '7818321 y 7854810',
  email: 'info@gnsm.edu.co',
  legalRepresentative: 'la rectora Saide Del Carmen Barguil Chamatt',
  operatingLicense: 'Resolución 1094 de 2021 de la Secretaría de Educación Municipal',
  daneCode: '323001009404',
  claimsArea: pending('claims-area'),
  claimsFormUrl:
    'https://docs.google.com/forms/d/1OA77ZT_3ipkLeaCwau8gbIhj2_OQuqlzeq0e9NY7MFQ/viewform',
};
