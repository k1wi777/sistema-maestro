import { link, list, paragraph, type LegalDocument } from './document';
import { INSTITUTION as school } from './institution';
import { pending } from './pending';

/** Política de tratamiento de la información. Pendiente de revisión jurídica del colegio. */
export const PRIVACY_POLICY: LegalDocument = {
  title: 'Política de tratamiento de la información',
  summary:
    'Explica qué datos personales trata la Plataforma GNS, de quién, para qué, cómo se protegen y cómo ejercer tus derechos.',
  sections: [
    {
      id: 'responsable',
      heading: 'Responsable del tratamiento',
      blocks: [
        paragraph(
          `${school.legalName}, identificado con NIT ${school.nit}, es el responsable del tratamiento de los datos personales que se registran en la Plataforma GNS.`,
        ),
        list(
          `Dirección: ${school.address}.`,
          `Teléfonos: ${school.phones}.`,
          `Correo electrónico: ${school.email}.`,
          `Representante legal: ${school.legalRepresentative}.`,
          `Licencia de funcionamiento: ${school.operatingLicense}.`,
          `Código DANE: ${school.daneCode}.`,
        ),
      ],
    },
    {
      id: 'marco-normativo',
      heading: 'Marco normativo',
      blocks: [
        paragraph('Esta política se rige por:'),
        list(
          'la Constitución Política de Colombia, artículo 15 (derecho a la intimidad y hábeas data) y artículo 44 (derechos de los niños);',
          'la Ley 1581 de 2012, de protección de datos personales;',
          'el Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015;',
          'la Ley 1098 de 2006, Código de la Infancia y la Adolescencia;',
          'la Ley 1273 de 2009, sobre delitos informáticos;',
          'la Ley 2170 de 2021.',
        ),
      ],
    },
    {
      id: 'datos-tratados',
      heading: 'Qué datos guarda la plataforma, de quién y para qué',
      blocks: [
        paragraph('De los docentes y del personal de coordinación y administración:'),
        list(
          'nombre, correo institucional y rol en la plataforma;',
          'grados y áreas asignados;',
          'credenciales de acceso (la contraseña se guarda cifrada) y sesiones abiertas;',
          'la aceptación del aviso de tratamiento de datos, con su fecha y versión;',
          'los registros pedagógicos que crean: planeaciones, diarios de campo y observaciones;',
          'su avance en el plan de formación, los resultados de las actividades y los certificados;',
          'las preguntas que escriben al asistente de preguntas frecuentes.',
        ),
        paragraph(
          'De los estudiantes se registra únicamente el nombre de pila, dentro de los registros pedagógicos que crean los docentes.',
        ),
        paragraph('Estos datos se usan para:'),
        list(
          'la planeación de clases con el modelo pedagógico GNS;',
          'los formatos institucionales (diario de campo y observador del estudiante);',
          'la formación y el acompañamiento docente;',
          'la revisión, el ajuste y la aprobación de los registros por coordinación académica;',
          'la trazabilidad de las acciones realizadas en la plataforma.',
        ),
      ],
    },
    {
      id: 'estudiantes',
      heading: 'Lo que nunca se registra de los estudiantes',
      blocks: [
        paragraph(
          'Los datos de niñas, niños y adolescentes se tratan respetando su interés superior y sus derechos fundamentales. Por eso la plataforma no admite, en ningún campo:',
        ),
        list(
          'documentos de identidad;',
          'direcciones;',
          'teléfonos;',
          'datos de salud ni diagnósticos;',
          'fotos.',
        ),
      ],
    },
    {
      id: 'manual-convivencia',
      heading: 'Coherencia con el Manual de Convivencia',
      blocks: [
        paragraph(
          'Esta política es coherente con el Manual de Convivencia del colegio: respeta la confidencialidad del Comité de Convivencia y reconoce las videograbaciones como datos sensibles. La plataforma no es el lugar para registrar los asuntos del Comité de Convivencia.',
        ),
      ],
    },
    {
      id: 'bitacora',
      heading: 'Bitácora de actividad',
      blocks: [
        paragraph(
          'Cada acción relevante queda en una bitácora con la fecha, la hora, el usuario, su rol y el detalle. La bitácora es de solo inserción: no se modifica ni se borra, y administración la consulta como auditora de la plataforma. Los registros pedagógicos enviados no se borran: pasan a estado «anulado» y queda constancia. Un borrador que nunca se envió lo puede descartar quien lo escribió; se borra y la bitácora registra el descarte sin su contenido.',
        ),
      ],
    },
    {
      id: 'autorizacion',
      heading: 'Autorización y su registro',
      blocks: [
        paragraph(
          'Sin tu autorización previa, expresa e informada no puedes usar ninguna sección de la plataforma. Al ingresar por primera vez, y cada vez que cambie la versión de este documento o de los términos de uso, se te pide marcar tres casillas: haber leído el aviso y la política, autorizar el tratamiento de tus datos y aceptar los términos de uso.',
        ),
        paragraph(
          'La aceptación queda registrada con la fecha y la hora, la versión de los textos y las casillas marcadas. Puedes revocar la autorización conforme a la ley, por los canales indicados más abajo.',
        ),
      ],
    },
    {
      id: 'derechos',
      heading: 'Derechos del titular',
      blocks: [
        paragraph('Según el artículo 8 de la Ley 1581 de 2012, puedes:'),
        list(
          'conocer, actualizar y rectificar tus datos personales;',
          'solicitar prueba de la autorización otorgada;',
          'ser informado sobre el uso que se ha dado a tus datos;',
          'presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley;',
          'revocar la autorización y solicitar la supresión de tus datos cuando no se respeten los principios, derechos y garantías legales;',
          'acceder de forma gratuita a tus datos personales.',
        ),
      ],
    },
    {
      id: 'consultas-reclamos',
      heading: 'Consultas y reclamos',
      blocks: [
        paragraph('Puedes presentar consultas y reclamos por estos canales del colegio:'),
        list(
          `correo electrónico: ${school.email};`,
          `dirección: ${school.address};`,
          'el buzón de PQRS del sitio web del colegio:',
        ),
        link('Abrir el buzón de PQRS', school.claimsFormUrl),
        paragraph('Área responsable de atenderlos: ', school.claimsArea, '.'),
        paragraph('Plazos de respuesta:'),
        list(
          'consultas: 10 días hábiles, prorrogables por 5 días hábiles más;',
          'reclamos: 15 días hábiles, prorrogables por 8 días hábiles más.',
        ),
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies y almacenamiento del navegador',
      blocks: [
        paragraph('La plataforma usa solo lo indispensable para funcionar:'),
        list(
          'cookies de sesión (gns_access y gns_refresh), que el navegador no puede leer desde la página y que sirven para mantener tu sesión iniciada;',
          'la preferencia de tema claro u oscuro (gns-theme), guardada en tu navegador.',
        ),
        paragraph('La plataforma no usa cookies de publicidad ni de seguimiento propias.'),
        paragraph(
          'Algunos módulos de formación incluyen videos de YouTube en modo de privacidad mejorada (youtube-nocookie.com). YouTube (Google) no guarda cookies hasta que reproduces el video; al reproducirlo, puede almacenar datos en tu navegador según su propia política de privacidad. Si lo prefieres, usa el enlace «Ver en YouTube».',
        ),
      ],
    },
    {
      id: 'encargados',
      heading: 'Encargados del tratamiento',
      blocks: [
        paragraph(
          'Los proveedores que alojan la plataforma y almacenan sus archivos actúan como encargados del tratamiento: ',
          pending('processors'),
          '.',
        ),
      ],
    },
    {
      id: 'vigencia',
      heading: 'Vigencia y cambios',
      blocks: [
        paragraph('Fecha de vigencia: ', pending('effective-date'), '.'),
        paragraph(
          'Si este documento o los términos de uso cambian, se publica una nueva versión y la plataforma te pedirá aceptar de nuevo antes de continuar.',
        ),
      ],
    },
  ],
};
