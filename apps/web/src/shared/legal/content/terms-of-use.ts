import { list, paragraph, type LegalDocument } from './document';
import { INSTITUTION as school } from './institution';
import { pending } from './pending';

/** Términos de uso de la plataforma. Pendientes de revisión jurídica del colegio. */
export const TERMS_OF_USE: LegalDocument = {
  title: 'Términos de uso',
  summary: 'Reglas para usar la Plataforma GNS de manera responsable y segura.',
  sections: [
    {
      id: 'objeto',
      heading: 'Objeto y aceptación',
      blocks: [
        paragraph(
          `La Plataforma GNS es la plataforma institucional de ${school.displayName}, en Montería, para planear clases, registrar los formatos institucionales, hacer la formación docente y consultar el asistente de preguntas frecuentes. Al aceptar estos términos te comprometes a usarla según las reglas de este documento.`,
        ),
      ],
    },
    {
      id: 'cuenta',
      heading: 'Tu cuenta',
      blocks: [
        paragraph(
          'La cuenta es personal e intransferible. La crea la administración de la plataforma; nadie se registra por su cuenta.',
        ),
        list(
          'No compartas tu contraseña ni dejes tu sesión abierta en equipos de uso común.',
          'Eres responsable de lo que se haga con tu cuenta.',
          'Avisa al colegio si sospechas que alguien más la usó.',
        ),
      ],
    },
    {
      id: 'roles',
      heading: 'Roles',
      blocks: [
        list(
          'Docente: planea, registra sus formatos, hace su formación y consulta el asistente; ve solo sus propios registros.',
          'Coordinación: revisa, ajusta, aprueba o devuelve los registros; asigna grados y áreas; crea los planes de formación; consulta la bitácora.',
          'Administración: crea los usuarios y asigna sus roles.',
        ),
      ],
    },
    {
      id: 'estudiantes',
      heading: 'Datos de los estudiantes',
      blocks: [
        paragraph(
          'Registra de los estudiantes solo el nombre de pila. Nunca documentos de identidad, direcciones, teléfonos, datos de salud, diagnósticos ni fotos. No uses la información de la plataforma fuera de los fines institucionales.',
        ),
      ],
    },
    {
      id: 'repositorio',
      heading: 'Repositorio de la comunidad',
      blocks: [
        paragraph(
          'El repositorio reúne actividades y materiales que los docentes comparten con la comunidad del colegio.',
        ),
        list(
          'La autoría del material es de quien lo creó; no lo presentes como propio si no lo es.',
          'El material compartido se usa solo con fines pedagógicos de la comunidad del colegio.',
          'Comparte únicamente material que puedas compartir y que no contenga datos de estudiantes distintos del nombre de pila.',
        ),
      ],
    },
    {
      id: 'conductas',
      heading: 'Conductas prohibidas',
      blocks: [
        paragraph(
          'Las conductas contrarias a la seguridad de la información están tipificadas como delitos por la Ley 1273 de 2009. En la plataforma está prohibido:',
        ),
        list(
          'acceder sin autorización a la cuenta o a los datos de otra persona;',
          'interceptar datos o intentar saltarse los controles de acceso por rol;',
          'dañar, alterar o inutilizar la plataforma o sus datos;',
          'usar o divulgar datos personales sin autorización;',
          'suplantar a otra persona.',
        ),
        paragraph(
          'Toda acción relevante queda registrada en una bitácora que no se modifica ni se borra.',
        ),
      ],
    },
    {
      id: 'datos-personales',
      heading: 'Tratamiento de datos personales',
      blocks: [
        paragraph(
          'El tratamiento de tus datos se explica en la Política de tratamiento de la información, que forma parte de estos términos. Ambos documentos comparten una misma versión.',
        ),
      ],
    },
    {
      id: 'vigencia',
      heading: 'Vigencia y cambios',
      blocks: [
        paragraph('Fecha de vigencia: ', pending('effective-date'), '.'),
        paragraph(
          'Si estos términos cambian, se publica una nueva versión y la plataforma te pedirá aceptar de nuevo antes de continuar.',
        ),
      ],
    },
  ],
};
