/**
 * Plan de Cuentas Estándar NIIF para PYMES en Ecuador
 * Estructura jerárquica obligatoria para reportar al SRI y Superintendencia de Compañías.
 */
export const DEFAULT_CHART_OF_ACCOUNTS = [
  // 1. ACTIVOS
  { code: '1', name: 'ACTIVO', type: 'ACTIVO', level: 1, parent: null },
  { code: '1.1', name: 'ACTIVO CORRIENTE', type: 'ACTIVO', level: 2, parent: '1' },
  { code: '1.1.01', name: 'Efectivo y Equivalentes de Efectivo', type: 'ACTIVO', level: 3, parent: '1.1' },
  { code: '1.1.01.01', name: 'Caja General', type: 'ACTIVO', level: 4, parent: '1.1.01', isSelectable: true },
  { code: '1.1.01.02', name: 'Bancos Nacionales', type: 'ACTIVO', level: 4, parent: '1.1.01', isSelectable: true },
  { code: '1.1.02', name: 'Cuentas y Documentos por Cobrar', type: 'ACTIVO', level: 3, parent: '1.1' },
  { code: '1.1.02.01', name: 'Clientes Locales (Cuentas por Cobrar)', type: 'ACTIVO', level: 4, parent: '1.1.02', isSelectable: true },

  // 2. PASIVOS
  { code: '2', name: 'PASIVO', type: 'PASIVO', level: 1, parent: null },
  { code: '2.1', name: 'PASIVO CORRIENTE', type: 'PASIVO', level: 2, parent: '2' },
  { code: '2.1.03', name: 'Obligaciones con el Administración Tributaria (SRI)', type: 'PASIVO', level: 3, parent: '2.1' },
  { code: '2.1.03.01', name: 'IVA Ventas por Pagar (SRI)', type: 'PASIVO', level: 4, parent: '2.1.03', isSelectable: true },
  { code: '2.1.03.02', name: 'Retenciones en la Fuente por Pagar', type: 'PASIVO', level: 4, parent: '2.1.03', isSelectable: true },

  // 3. PATRIMONIO
  { code: '3', name: 'PATRIMONIO NETO', type: 'PATRIMONIO', level: 1, parent: null },
  { code: '3.1.01', name: 'Capital Social', type: 'PATRIMONIO', level: 3, parent: '3', isSelectable: true },

  // 4. INGRESOS
  { code: '4', name: 'INGRESOS', type: 'INGRESO', level: 1, parent: null },
  { code: '4.1', name: 'INGRESOS DE ACTIVIDADES ORDINARIAS', type: 'INGRESO', level: 2, parent: '4' },
  { code: '4.1.01', name: 'Ventas y Prestación de Servicios', type: 'INGRESO', level: 3, parent: '4.1' },
  { code: '4.1.01.01', name: 'Ingresos por Servicios Médicos / Profesionales (IVA 0%)', type: 'INGRESO', level: 4, parent: '4.1.01', isSelectable: true },
  { code: '4.1.01.02', name: 'Ingresos por Venta de Bienes (IVA 15%)', type: 'INGRESO', level: 4, parent: '4.1.01', isSelectable: true },
  { code: '4.1.01.03', name: 'Ingresos por Servicios Generales (IVA 15%)', type: 'INGRESO', level: 4, parent: '4.1.01', isSelectable: true },

  // 5. GASTOS
  { code: '5', name: 'GASTOS', type: 'GASTO', level: 1, parent: null },
  { code: '5.1', name: 'GASTOS OPERACIONALES', type: 'GASTO', level: 2, parent: '5' },
  { code: '5.1.01.01', name: 'Costo de Ventas', type: 'GASTO', level: 4, parent: '5.1', isSelectable: true }
];
