/**
 * Motor de Contabilidad NIIF para PYMES (Ecuador)
 * Genera y valida asientos contables por Partida Doble (Debe = Haber)
 */

import { DEFAULT_CHART_OF_ACCOUNTS } from './defaultChartOfAccounts.js';

export class AccountingEngine {
  constructor(customChartOfAccounts = null) {
    this.chartOfAccounts = customChartOfAccounts || DEFAULT_CHART_OF_ACCOUNTS;
  }

  /**
   * Genera automáticamente un Asiento Contable NIIF a partir de una Factura de Venta
   */
  generateJournalEntryFromInvoice({ invoiceNumber, date, totals, paymentMethod = 'EFECTIVO', businessType = 'SERVICIOS' }) {
    const lines = [];

    // 1. DETERMINAR CUENTA DE ENTRADA (DEBE - ACTIVO)
    let debitAccountCode = '1.1.01.01'; // Caja General por defecto
    let debitAccountName = 'Caja General';

    if (paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'BANCO') {
      debitAccountCode = '1.1.01.02';
      debitAccountName = 'Bancos Nacionales';
    } else if (paymentMethod === 'CREDITO') {
      debitAccountCode = '1.1.02.01';
      debitAccountName = 'Clientes Locales (Cuentas por Cobrar)';
    }

    // Línea 1: Ingreso de Dinero o Cartera (DEBE)
    lines.push({
      accountCode: debitAccountCode,
      accountName: debitAccountName,
      debit: totals.importeTotal,
      credit: 0
    });

    // 2. DETERMINAR CUENTA DE INGRESO (HABER - INGRESO)
    let creditAccountCode = '4.1.01.01';
    let creditAccountName = 'Ingresos por Servicios Médicos / Profesionales (IVA 0%)';

    if (businessType === 'BIENES' || totals.subtotal15 > 0) {
      creditAccountCode = '4.1.01.02';
      creditAccountName = 'Ingresos por Venta de Bienes (IVA 15%)';
    }

    // Línea 2: Registro del Ingreso Bruto (HABER)
    lines.push({
      accountCode: creditAccountCode,
      accountName: creditAccountName,
      debit: 0,
      credit: totals.subtotalSinImpuestos
    });

    // 3. DETERMINAR PASIVO TRIBUTARIO SRI (HABER - PASIVO IVA)
    if (totals.totalIva > 0) {
      lines.push({
        accountCode: '2.1.03.01',
        accountName: 'IVA Ventas por Pagar (SRI)',
        debit: 0,
        credit: totals.totalIva
      });
    }

    // 4. VALIDACIÓN DE PARTIDA DOBLE (DEBE === HABER)
    const totalDebit = Number(lines.reduce((sum, l) => sum + l.debit, 0).toFixed(2));
    const totalCredit = Number(lines.reduce((sum, l) => sum + l.credit, 0).toFixed(2));
    const isBalanced = totalDebit === totalCredit;

    if (!isBalanced) {
      console.warn(`Desbalance en Asiento Contable! Debe: ${totalDebit}, Haber: ${totalCredit}`);
    }

    return {
      entryId: `ASI-${Date.now().toString().slice(-6)}`,
      invoiceRef: invoiceNumber,
      date: date || new Date().toISOString().substring(0, 10),
      concept: `Venta según Factura No. ${invoiceNumber} (${paymentMethod})`,
      totalDebit,
      totalCredit,
      isBalanced,
      lines
    };
  }
}
