import { TrainingActivityType } from '@gns/shared';

// Generado a partir del prototipo (fuentes del Work Item); editar con cuidado.
// Actividades del módulo 8 (plan de beneficios). Cada configuración se valida con
// parseActivityConfig antes de insertarse. En los simuladores, el formato
// «porcentaje» expresa puntos porcentuales (13.5 = 13,5 %).

export interface ActivitySeed {
  type: TrainingActivityType;
  title: string;
  isRequired: boolean;
  config: Record<string, unknown>;
}

/** Número del módulo que recibe las actividades. */
export const BENEFITS_MODULE_NUMBER = '8';

export const BENEFITS_ACTIVITIES: readonly ActivitySeed[] = [
  {
    type: TrainingActivityType.WheelPassport,
    title: 'Ruleta de beneficios',
    isRequired: false,
    config: {
      insignia: 'Experto en Beneficios GNS',
      tarjetas: [
        {
          clave: 'ahorro',
          emoji: '🐷',
          titulo_corto: 'Ahorro mutuo',
          titulo: 'Ahorro mutuo',
          dato: 'El colegio aporta el 50% de lo que ahorras',
          hechos: [
            'Ahorras entre el 3% y el 10% de tu salario en el plan institucional con Protección AFP.',
            'GNS aporta el 50% del valor que ahorras.',
            'Úsalo para vivienda, educación, viajes o crecimiento patrimonial.',
            'Retiras tus aportes y los del colegio desde el 3.er año; retirar antes implica perder el aporte institucional.',
          ],
          pregunta: {
            enunciado: 'Si ahorras $100.000 al mes, ¿cuánto aporta el colegio?',
            opciones: ['$50.000', '$10.000'],
            correcta: 0,
          },
        },
        {
          clave: 'bono',
          emoji: '🏅',
          titulo_corto: 'Bono desempeño',
          titulo: 'Bono anual de desempeño',
          dato: 'Hasta 1 salario completo con evaluación mayor a 3.5',
          hechos: [
            'Aplica a docentes que finalizan el periodo académico con evaluación igual o superior a 2.',
            'Mayor a 2 y hasta 3: ⅓ de salario · mayor a 3 y hasta 3.5: ⅔ · mayor a 3.5 hasta 4: 1 salario.',
            'La evaluación: 20% autoevaluación y 80% jefe inmediato.',
            'Se paga 50% con la liquidación y 50% si continúas el siguiente año escolar.',
          ],
          pregunta: {
            enunciado: '¿Cuánto pesa la evaluación del jefe inmediato?',
            opciones: ['80%', '50%'],
            correcta: 0,
          },
        },
        {
          clave: 'bilingue',
          emoji: '🗣️',
          titulo_corto: 'Bilingüismo',
          titulo: 'Reconocimiento por bilingüismo',
          dato: '$1.000.000 al mes con nivel C1 certificado',
          hechos: [
            'Para docentes colombianos con certificación TOEFL ITP vigente en las 4 habilidades.',
            'Nivel B2: $660.000 al mes · Nivel C1: $1.000.000 al mes.',
            'Proporcional a la jornada y vigente durante el contrato y mientras el certificado esté activo.',
          ],
          pregunta: {
            enunciado: '¿Cuál es el nivel mínimo para recibir el reconocimiento?',
            opciones: ['B2', 'B1'],
            correcta: 0,
          },
        },
        {
          clave: 'poliza',
          emoji: '🤝',
          titulo_corto: 'Póliza exequial',
          titulo: 'Póliza exequial',
          dato: 'El colegio cubre el 50% con Funeraria Los Olivos',
          hechos: [
            'GNS cubre el 50% de la póliza exequial del plan institucional con Funeraria Los Olivos.',
            'Manifiestas tu interés y autorizas el descuento del otro 50% por nómina.',
            'Aplica mientras estés vinculado a la institución.',
          ],
          pregunta: {
            enunciado: '¿Qué porcentaje de la póliza cubre el colegio?',
            opciones: ['50%', '100%'],
            correcta: 0,
          },
        },
        {
          clave: 'quinquenio',
          emoji: '🎂',
          titulo_corto: 'Quinquenios',
          titulo: 'Quinquenios',
          dato: '50% del SMMLV por cada 5 años de servicio',
          hechos: [
            'Bono del 50% del SMMLV vigente por cada quinquenio de servicio continuo (en 2025: $711.750).',
            '5 años: primer quinquenio · 10 años: segundo · 15 años: tercero…',
            'Se entrega cerca del cumpleaños del colegio.',
          ],
          pregunta: {
            enunciado: '¿Cada cuántos años de servicio continuo se recibe?',
            opciones: ['Cada 5 años', 'Cada 3 años'],
            correcta: 0,
          },
        },
        {
          clave: 'antiguedad',
          emoji: '📈',
          titulo_corto: 'Antigüedad',
          titulo: 'Bono de antigüedad',
          dato: 'Desde el primer año: hasta 49% acumulado al año 24',
          hechos: [
            'Cada año de servicio continuo suma un porcentaje de antigüedad que se va acumulando.',
            'Años 1 a 4: 1% por año · años 5 a 9: 1.5% · años 10 a 14: 2% · años 15 a 19: 2.5% · años 20 a 24: 3%.',
            'Acumulado: 4% al año 4 · 13.5% al año 10 · 24% al año 15 · 37% al año 20 · 49% al año 24.',
            'Si te retiras, la antigüedad se reinicia desde cero al reingresar.',
          ],
          pregunta: {
            enunciado: 'Al cumplir 10 años de servicio, ¿cuál es el porcentaje acumulado?',
            opciones: ['13.5%', '10%'],
            correcta: 0,
          },
        },
        {
          clave: 'posgrado',
          emoji: '🎓',
          titulo_corto: 'Posgrados',
          titulo: 'Estudios de posgrado',
          dato: '30% condonable + préstamo por el 70%',
          hechos: [
            'GNS asume el 30% de la matrícula como crédito condonable y presta el 70% restante.',
            'Requisitos: 2 años de antigüedad y las 4 últimas evaluaciones semestrales superiores a 3.5.',
            'El 30% se condona con promedio académico de 3.8 o más y contrato de permanencia.',
          ],
          pregunta: {
            enunciado: '¿Qué antigüedad mínima se requiere?',
            opciones: ['2 años', '6 meses'],
            correcta: 0,
          },
        },
        {
          clave: 'cabana',
          emoji: '🏖️',
          titulo_corto: 'Cabaña Coveñas',
          titulo: 'Cabaña en Coveñas',
          dato: 'Hasta 16 personas frente al mar',
          hechos: [
            'Espacio frente al mar para descansar con familiares o personas cercanas.',
            'Requisitos: 1 año de antigüedad y desempeño de 3.0 o más; reserva con Talento Humano.',
            '1 o 2 noches: $105.054 · 3 noches: $157.581, más el consumo eléctrico.',
            'Cancela con 15 días de anticipación o pierdes el beneficio por 2 ciclos.',
          ],
          pregunta: {
            enunciado: '¿Con cuánta anticipación se debe cancelar una reserva?',
            opciones: ['15 días', '1 día'],
            correcta: 0,
          },
        },
        {
          clave: 'hijos',
          emoji: '🎒',
          titulo_corto: 'Educación hijos',
          titulo: 'Costos educativos para hijos',
          dato: '80% de descuento en matrícula, pensión y alimentación',
          hechos: [
            '80% de descuento para tus hijos en matrículas, pensiones, merienda y almuerzo.',
          ],
          pregunta: {
            enunciado: '¿De cuánto es el descuento para hijos?',
            opciones: ['80%', '40%'],
            correcta: 0,
          },
        },
        {
          clave: 'comida',
          emoji: '🍽️',
          titulo_corto: 'Alimentación',
          titulo: 'Alimentación',
          dato: 'Merienda y almuerzo por el 0.1% del SMMLV',
          hechos: [
            'Acceso a la cafetería para empleados con merienda y almuerzo.',
            'Costo: 0.1% del SMMLV; el beneficio se valora en $350.000 mensuales.',
          ],
          pregunta: {
            enunciado: '¿Qué incluye el beneficio de alimentación?',
            opciones: ['Merienda y almuerzo', 'Solo el desayuno'],
            correcta: 0,
          },
        },
        {
          clave: 'tiempo',
          emoji: '🎟️',
          titulo_corto: 'Tiempo libre',
          titulo: 'Tiquetera de tiempo libre',
          dato: '2 días al año + ½ día por tu cumpleaños',
          hechos: [
            'Permiso remunerado de 2 días al año (4 medias jornadas) para citas médicas y diligencias personales.',
            '½ día por tu cumpleaños, si es día hábil.',
            'Siempre con acuerdo previo con tu jefe inmediato.',
          ],
          pregunta: {
            enunciado: '¿En cuántas medias jornadas puedes usar los 2 días?',
            opciones: ['4', '2'],
            correcta: 0,
          },
        },
        {
          clave: 'licencias',
          emoji: '👶',
          titulo_corto: 'Licencias',
          titulo: 'Licencias extendidas',
          dato: 'Una semana más para papás y un mes más para mamás',
          hechos: [
            'Licencia de maternidad y paternidad extendida: una semana para hombres y un mes para mujeres.',
            'Licencia por matrimonio: una semana remunerada.',
          ],
          pregunta: {
            enunciado: '¿Cuánto dura la licencia por matrimonio?',
            opciones: ['Una semana', 'Un día'],
            correcta: 0,
          },
        },
        {
          clave: 'prestamo',
          emoji: '🛟',
          titulo_corto: 'Préstamo',
          titulo: 'Préstamo por calamidad o necesidades básicas',
          dato: 'Hasta 1.5 SMLV para momentos difíciles',
          hechos: [
            'Para situaciones de calamidad doméstica o necesidades básicas, con el fin de mejorar tu calidad de vida.',
            'Tope hasta 1.5 SMLV.',
          ],
          pregunta: {
            enunciado: '¿Cuál es el tope del préstamo?',
            opciones: ['Hasta 1.5 SMLV', 'Hasta 10 SMLV'],
            correcta: 0,
          },
        },
        {
          clave: 'referidos',
          emoji: '📣',
          titulo_corto: 'Referidos',
          titulo: 'Referidos GNS',
          dato: '20% del SMMLV por cada referido contratado',
          hechos: [
            'Si refieres a un profesional y es contratado, recibes el 20% del SMMLV.',
            'Se paga al tercer mes de ingreso, con ambas personas activas, y es acumulable.',
            'No aplica para personal administrativo ni si participas en la selección del candidato.',
          ],
          pregunta: {
            enunciado: '¿Cuándo se paga la bonificación por referido?',
            opciones: ['Al tercer mes del ingreso', 'El primer día'],
            correcta: 0,
          },
        },
      ],
    },
  },
  {
    type: TrainingActivityType.Match,
    title: 'Conecta',
    isRequired: true,
    config: {
      pares: [
        {
          concepto: 'Ahorro mutuo',
          dato: 'El colegio aporta el 50% de lo que ahorras',
          emoji: '🐷',
        },
        {
          concepto: 'Bono anual de desempeño',
          dato: 'Hasta 1 salario completo con evaluación mayor a 3.5',
          emoji: '🏅',
        },
        {
          concepto: 'Reconocimiento por bilingüismo',
          dato: '$1.000.000 al mes con nivel C1 certificado',
          emoji: '🗣️',
        },
        {
          concepto: 'Póliza exequial',
          dato: 'El colegio cubre el 50% con Funeraria Los Olivos',
          emoji: '🤝',
        },
        {
          concepto: 'Quinquenios',
          dato: '50% del SMMLV por cada 5 años de servicio',
          emoji: '🎂',
        },
        {
          concepto: 'Bono de antigüedad',
          dato: 'Desde el primer año: hasta 49% acumulado al año 24',
          emoji: '📈',
        },
        {
          concepto: 'Estudios de posgrado',
          dato: '30% condonable + préstamo por el 70%',
          emoji: '🎓',
        },
        {
          concepto: 'Cabaña en Coveñas',
          dato: 'Hasta 16 personas frente al mar',
          emoji: '🏖️',
        },
        {
          concepto: 'Costos educativos para hijos',
          dato: '80% de descuento en matrícula, pensión y alimentación',
          emoji: '🎒',
        },
        {
          concepto: 'Alimentación',
          dato: 'Merienda y almuerzo por el 0.1% del SMMLV',
          emoji: '🍽️',
        },
        {
          concepto: 'Tiquetera de tiempo libre',
          dato: '2 días al año + ½ día por tu cumpleaños',
          emoji: '🎟️',
        },
        {
          concepto: 'Licencias extendidas',
          dato: 'Una semana más para papás y un mes más para mamás',
          emoji: '👶',
        },
        {
          concepto: 'Préstamo por calamidad o necesidades básicas',
          dato: 'Hasta 1.5 SMLV para momentos difíciles',
          emoji: '🛟',
        },
        {
          concepto: 'Referidos GNS',
          dato: '20% del SMMLV por cada referido contratado',
          emoji: '📣',
        },
      ],
      pares_por_ronda: 5,
      rondas: 2,
      segundos_por_ronda: 45,
      umbral_aprobacion: 80,
    },
  },
  {
    type: TrainingActivityType.TrueOrMyth,
    title: '¿Verdad o mito?',
    isRequired: true,
    config: {
      afirmaciones: [
        {
          texto: 'El ahorro mutuo permite aportar entre el 3% y el 10% del salario.',
          es_verdad: true,
          explicacion: 'Mínimo 3% y máximo 10%.',
        },
        {
          texto: 'Los aportes del ahorro mutuo se pueden retirar desde el primer año.',
          es_verdad: false,
          explicacion: 'Mito: se retiran desde el 3.er año.',
        },
        {
          texto: 'Para el bono, la evaluación pesa 20% la autoevaluación y 80% el jefe inmediato.',
          es_verdad: true,
          explicacion: 'Así se calcula la evaluación.',
        },
        {
          texto: 'El bono de desempeño se paga completo junto con la liquidación.',
          es_verdad: false,
          explicacion: 'Mito: 50% con la liquidación y 50% si continúas el siguiente año.',
        },
        {
          texto: 'El reconocimiento de bilingüismo exige TOEFL ITP vigente en las 4 habilidades.',
          es_verdad: true,
          explicacion: 'Con nivel igual o superior a B2.',
        },
        {
          texto: 'Con nivel B1 certificado ya recibes reconocimiento de bilingüismo.',
          es_verdad: false,
          explicacion: 'Mito: el mínimo es B2.',
        },
        {
          texto:
            'Para usar la cabaña en Coveñas necesitas 1 año de antigüedad y desempeño de 3.0 o más.',
          es_verdad: true,
          explicacion: 'Y reserva previa con Talento Humano.',
        },
        {
          texto: 'Puedes cancelar la reserva de la cabaña un día antes sin penalidad.',
          es_verdad: false,
          explicacion: 'Mito: debes cancelar con 15 días de anticipación.',
        },
        {
          texto: 'El 30% del posgrado se condona con un promedio académico de 3.8 o superior.',
          es_verdad: true,
          explicacion: 'Además del contrato de permanencia.',
        },
        {
          texto: 'Si te retiras y vuelves a ingresar, conservas tu antigüedad acumulada.',
          es_verdad: false,
          explicacion: 'Mito: la antigüedad se reinicia desde cero.',
        },
        {
          texto: 'El ½ día de cumpleaños aplica cuando tu cumpleaños es día hábil.',
          es_verdad: true,
          explicacion: 'Con acuerdo previo con tu jefe inmediato.',
        },
        {
          texto: 'El 80% de descuento para hijos aplica solo a la matrícula.',
          es_verdad: false,
          explicacion: 'Mito: aplica a matrículas, pensiones, merienda y almuerzo.',
        },
      ],
      por_partida: 10,
      vidas: 3,
      segundos_por_afirmacion: 10,
      umbral_aprobacion: 80,
    },
  },
  {
    type: TrainingActivityType.Simulator,
    title: 'Simulador de ahorro mutuo',
    isRequired: false,
    config: {
      entradas: [
        {
          clave: 'salario',
          etiqueta: 'Salario mensual',
          tipo: 'moneda',
          min: 0,
          paso: 1000,
          solo_en_pantalla: true,
        },
        {
          clave: 'pct',
          etiqueta: 'Aporte al ahorro mutuo',
          tipo: 'porcentaje',
          min: 3,
          max: 10,
          paso: 1,
          inicial: 5,
        },
        {
          clave: 'anios',
          etiqueta: 'Años de ahorro',
          tipo: 'numero',
          min: 1,
          max: 10,
          paso: 1,
          inicial: 3,
        },
      ],
      constantes: [
        {
          clave: 'aporte_colegio',
          valor: 0.5,
        },
        {
          clave: 'meses',
          valor: 12,
        },
      ],
      calculos: [
        {
          clave: 'mensual',
          expresion: {
            op: 'divide',
            args: [
              {
                op: 'multiplica',
                args: [
                  {
                    ref: 'salario',
                  },
                  {
                    ref: 'pct',
                  },
                ],
              },
              100,
            ],
          },
        },
        {
          clave: 'colegio',
          expresion: {
            op: 'multiplica',
            args: [
              {
                ref: 'mensual',
              },
              {
                ref: 'aporte_colegio',
              },
            ],
          },
        },
        {
          clave: 'total',
          expresion: {
            op: 'multiplica',
            args: [
              {
                op: 'suma',
                args: [
                  {
                    ref: 'mensual',
                  },
                  {
                    ref: 'colegio',
                  },
                ],
              },
              {
                ref: 'meses',
              },
              {
                ref: 'anios',
              },
            ],
          },
        },
        {
          clave: 'retiro_anticipado',
          expresion: {
            op: 'compara',
            comparacion: 'menor',
            args: [
              {
                ref: 'anios',
              },
              3,
            ],
          },
        },
      ],
      resultados: [
        {
          clave: 'mensual',
          etiqueta: 'Tú aportas al mes',
          formato: 'moneda',
        },
        {
          clave: 'colegio',
          etiqueta: 'GNS te aporta al mes (50%)',
          formato: 'moneda',
        },
        {
          clave: 'total',
          etiqueta: 'Ahorro estimado',
          formato: 'moneda',
        },
      ],
      notas: [
        {
          texto: 'Recuerda: los retiros se habilitan desde el 3.er año.',
          cuando: 'retiro_anticipado',
        },
        {
          texto: 'Estimado con 12 aportes al año y sin rendimientos del fondo.',
        },
      ],
    },
  },
  {
    type: TrainingActivityType.Simulator,
    title: 'Simulador de bono de desempeño',
    isRequired: false,
    config: {
      entradas: [
        {
          clave: 'salario',
          etiqueta: 'Salario mensual',
          tipo: 'moneda',
          min: 0,
          paso: 1000,
          solo_en_pantalla: true,
        },
        {
          clave: 'auto',
          etiqueta: 'Autoevaluación',
          tipo: 'numero',
          min: 1,
          max: 4,
          paso: 0.1,
          inicial: 3.5,
        },
        {
          clave: 'jefe',
          etiqueta: 'Evaluación del jefe inmediato',
          tipo: 'numero',
          min: 1,
          max: 4,
          paso: 0.1,
          inicial: 3.4,
        },
      ],
      constantes: [
        {
          clave: 'peso_auto',
          valor: 0.2,
        },
        {
          clave: 'peso_jefe',
          valor: 0.8,
        },
      ],
      calculos: [
        {
          clave: 'nota',
          expresion: {
            op: 'redondea',
            decimales: 2,
            args: [
              {
                op: 'suma',
                args: [
                  {
                    op: 'multiplica',
                    args: [
                      {
                        ref: 'peso_auto',
                      },
                      {
                        ref: 'auto',
                      },
                    ],
                  },
                  {
                    op: 'multiplica',
                    args: [
                      {
                        ref: 'peso_jefe',
                      },
                      {
                        ref: 'jefe',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          clave: 'fraccion',
          expresion: {
            tramos: {
              clave: 'nota',
              hasta: [
                {
                  hasta: 2,
                  valor: 0,
                },
                {
                  hasta: 3,
                  valor: {
                    op: 'divide',
                    args: [1, 3],
                  },
                },
                {
                  hasta: 3.5,
                  valor: {
                    op: 'divide',
                    args: [2, 3],
                  },
                },
              ],
              resto: 1,
            },
          },
        },
        {
          clave: 'bono',
          expresion: {
            op: 'multiplica',
            args: [
              {
                ref: 'salario',
              },
              {
                ref: 'fraccion',
              },
            ],
          },
        },
        {
          clave: 'mitad',
          expresion: {
            op: 'divide',
            args: [
              {
                ref: 'bono',
              },
              2,
            ],
          },
        },
        {
          clave: 'sin_bono',
          expresion: {
            op: 'compara',
            comparacion: 'igual',
            args: [
              {
                ref: 'fraccion',
              },
              0,
            ],
          },
        },
      ],
      resultados: [
        {
          clave: 'nota',
          etiqueta: 'Tu evaluación',
          formato: 'numero',
        },
        {
          clave: 'fraccion',
          etiqueta: 'Fracción del salario',
          formato: 'numero',
        },
        {
          clave: 'bono',
          etiqueta: 'Bono estimado',
          formato: 'moneda',
        },
        {
          clave: 'mitad',
          etiqueta: 'Con la liquidación (50%)',
          formato: 'moneda',
        },
        {
          clave: 'mitad',
          etiqueta: 'Si continúas el siguiente año (50%)',
          formato: 'moneda',
        },
      ],
      notas: [
        {
          texto: 'Con esta evaluación no hay bono.',
          cuando: 'sin_bono',
        },
        {
          texto: 'Es un reconocimiento institucional, no un derecho adquirido.',
        },
      ],
    },
  },
  {
    type: TrainingActivityType.Simulator,
    title: 'Simulador de bono de antigüedad',
    isRequired: false,
    config: {
      entradas: [
        {
          clave: 'anios',
          etiqueta: 'Años de servicio',
          tipo: 'numero',
          min: 0,
          max: 24,
          paso: 1,
          inicial: 6,
        },
      ],
      constantes: [],
      calculos: [
        {
          clave: 'acumulado',
          expresion: {
            tramos: {
              clave: 'anios',
              hasta: [
                {
                  hasta: 0,
                  valor: 0,
                },
                {
                  hasta: 4,
                  valor: {
                    ref: 'anios',
                  },
                },
                {
                  hasta: 9,
                  valor: {
                    op: 'suma',
                    args: [
                      4,
                      {
                        op: 'multiplica',
                        args: [
                          1.5,
                          {
                            op: 'resta',
                            args: [
                              {
                                ref: 'anios',
                              },
                              4,
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
                {
                  hasta: 14,
                  valor: {
                    op: 'suma',
                    args: [
                      11.5,
                      {
                        op: 'multiplica',
                        args: [
                          2,
                          {
                            op: 'resta',
                            args: [
                              {
                                ref: 'anios',
                              },
                              9,
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
                {
                  hasta: 19,
                  valor: {
                    op: 'suma',
                    args: [
                      21.5,
                      {
                        op: 'multiplica',
                        args: [
                          2.5,
                          {
                            op: 'resta',
                            args: [
                              {
                                ref: 'anios',
                              },
                              14,
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
              resto: {
                op: 'suma',
                args: [
                  34,
                  {
                    op: 'multiplica',
                    args: [
                      3,
                      {
                        op: 'resta',
                        args: [
                          {
                            ref: 'anios',
                          },
                          19,
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        {
          clave: 'tasa_anio',
          expresion: {
            tramos: {
              clave: 'anios',
              hasta: [
                {
                  hasta: 0,
                  valor: 0,
                },
                {
                  hasta: 4,
                  valor: 1,
                },
                {
                  hasta: 9,
                  valor: 1.5,
                },
                {
                  hasta: 14,
                  valor: 2,
                },
                {
                  hasta: 19,
                  valor: 2.5,
                },
              ],
              resto: 3,
            },
          },
        },
        {
          clave: 'quinquenios',
          expresion: {
            op: 'piso',
            args: [
              {
                op: 'divide',
                args: [
                  {
                    ref: 'anios',
                  },
                  5,
                ],
              },
            ],
          },
        },
      ],
      resultados: [
        {
          clave: 'acumulado',
          etiqueta: 'Bono de antigüedad acumulado',
          formato: 'porcentaje',
        },
        {
          clave: 'tasa_anio',
          etiqueta: 'Porcentaje que suma este año',
          formato: 'porcentaje',
        },
        {
          clave: 'quinquenios',
          etiqueta: 'Quinquenios cumplidos (50% del SMMLV c/u)',
          formato: 'numero',
        },
      ],
      notas: [
        {
          texto: 'Aplica con servicio continuo; si hay retiro, se reinicia desde cero.',
        },
      ],
    },
  },
  {
    type: TrainingActivityType.Simulator,
    title: 'Simulador de cabaña en Coveñas',
    isRequired: false,
    config: {
      entradas: [
        {
          clave: 'antiguedad',
          etiqueta: 'Antigüedad',
          tipo: 'opcion',
          opciones: [
            {
              etiqueta: 'Menos de 1 año',
              valor: 0,
            },
            {
              etiqueta: '1 año o más',
              valor: 1,
            },
          ],
          inicial: 1,
        },
        {
          clave: 'evaluacion',
          etiqueta: 'Última evaluación de desempeño',
          tipo: 'numero',
          min: 1,
          max: 4,
          paso: 0.1,
          inicial: 3.4,
        },
        {
          clave: 'personas',
          etiqueta: 'Número de personas',
          tipo: 'numero',
          min: 1,
          max: 20,
          paso: 1,
          inicial: 8,
        },
        {
          clave: 'noches',
          etiqueta: 'Noches',
          tipo: 'opcion',
          opciones: [
            {
              etiqueta: '1 noche',
              valor: 1,
            },
            {
              etiqueta: '2 noches',
              valor: 2,
            },
            {
              etiqueta: '3 noches',
              valor: 3,
            },
          ],
          inicial: 2,
        },
      ],
      constantes: [
        {
          clave: 'min_antiguedad',
          valor: 1,
        },
        {
          clave: 'min_evaluacion',
          valor: 3,
        },
        {
          clave: 'max_personas',
          valor: 16,
        },
        {
          clave: 'noches_tarifa_corta',
          valor: 2,
        },
        {
          clave: 'costo_corto',
          valor: 105054,
        },
        {
          clave: 'costo_largo',
          valor: 157581,
        },
      ],
      calculos: [
        {
          clave: 'cumple_antiguedad',
          expresion: {
            op: 'compara',
            comparacion: 'mayor_igual',
            args: [
              {
                ref: 'antiguedad',
              },
              {
                ref: 'min_antiguedad',
              },
            ],
          },
        },
        {
          clave: 'cumple_evaluacion',
          expresion: {
            op: 'compara',
            comparacion: 'mayor_igual',
            args: [
              {
                ref: 'evaluacion',
              },
              {
                ref: 'min_evaluacion',
              },
            ],
          },
        },
        {
          clave: 'cumple_personas',
          expresion: {
            op: 'compara',
            comparacion: 'menor_igual',
            args: [
              {
                ref: 'personas',
              },
              {
                ref: 'max_personas',
              },
            ],
          },
        },
        {
          clave: 'cumple',
          expresion: {
            op: 'todos',
            args: [
              {
                ref: 'cumple_antiguedad',
              },
              {
                ref: 'cumple_evaluacion',
              },
              {
                ref: 'cumple_personas',
              },
            ],
          },
        },
        {
          clave: 'no_cumple',
          expresion: {
            op: 'no',
            args: [
              {
                ref: 'cumple',
              },
            ],
          },
        },
        {
          clave: 'tarifa',
          expresion: {
            op: 'si',
            args: [
              {
                op: 'compara',
                comparacion: 'menor_igual',
                args: [
                  {
                    ref: 'noches',
                  },
                  {
                    ref: 'noches_tarifa_corta',
                  },
                ],
              },
              {
                ref: 'costo_corto',
              },
              {
                ref: 'costo_largo',
              },
            ],
          },
        },
        {
          clave: 'costo',
          expresion: {
            op: 'si',
            args: [
              {
                ref: 'cumple',
              },
              {
                ref: 'tarifa',
              },
              0,
            ],
          },
        },
      ],
      resultados: [
        {
          clave: 'cumple_antiguedad',
          etiqueta: '1 año o más de antigüedad',
          formato: 'si_no',
        },
        {
          clave: 'cumple_evaluacion',
          etiqueta: 'Desempeño de 3.0 o más',
          formato: 'si_no',
        },
        {
          clave: 'cumple_personas',
          etiqueta: 'Máximo 16 personas',
          formato: 'si_no',
        },
        {
          clave: 'cumple',
          etiqueta: 'Cumples los requisitos',
          formato: 'si_no',
        },
        {
          clave: 'costo',
          etiqueta: 'Costo de la reserva',
          formato: 'moneda',
        },
      ],
      notas: [
        {
          texto: 'Aún no cumples: revisa los requisitos marcados.',
          cuando: 'no_cumple',
        },
        {
          texto: 'Más el consumo eléctrico (promedio $110.000 por fin de semana).',
        },
        {
          texto: 'Reserva con Talento Humano. Cancela con 15 días de anticipación.',
        },
      ],
    },
  },
  {
    type: TrainingActivityType.Simulator,
    title: 'Simulador de bilingüismo',
    isRequired: false,
    config: {
      entradas: [
        {
          clave: 'nivel',
          etiqueta: 'Nivel de inglés certificado',
          tipo: 'opcion',
          opciones: [
            {
              etiqueta: 'B1 o inferior',
              valor: 0,
            },
            {
              etiqueta: 'B2',
              valor: 660000,
            },
            {
              etiqueta: 'C1',
              valor: 1000000,
            },
          ],
          inicial: 660000,
        },
        {
          clave: 'jornada',
          etiqueta: 'Jornada',
          tipo: 'porcentaje',
          min: 25,
          max: 100,
          paso: 25,
          inicial: 100,
        },
      ],
      constantes: [],
      calculos: [
        {
          clave: 'valor',
          expresion: {
            op: 'divide',
            args: [
              {
                op: 'multiplica',
                args: [
                  {
                    ref: 'nivel',
                  },
                  {
                    ref: 'jornada',
                  },
                ],
              },
              100,
            ],
          },
        },
        {
          clave: 'aplica',
          expresion: {
            op: 'compara',
            comparacion: 'mayor',
            args: [
              {
                ref: 'valor',
              },
              0,
            ],
          },
        },
        {
          clave: 'no_aplica',
          expresion: {
            op: 'no',
            args: [
              {
                ref: 'aplica',
              },
            ],
          },
        },
      ],
      resultados: [
        {
          clave: 'valor',
          etiqueta: 'Reconocimiento mensual estimado',
          formato: 'moneda',
        },
      ],
      notas: [
        {
          texto: 'El nivel mínimo es B2 en las 4 habilidades.',
          cuando: 'no_aplica',
        },
        {
          texto:
            'Requiere TOEFL ITP vigente. Se paga proporcional a la jornada y se suspende durante licencias, incapacidades o ausencias.',
        },
      ],
    },
  },
];
