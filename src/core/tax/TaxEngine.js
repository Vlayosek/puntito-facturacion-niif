/**
 * Motor de Cálculo Tributario SRI (Ecuador)
 * Cumple con la normativa tributaria del SRI (Tarifas IVA 15% / 0%, Regímenes RIMPE y Validación de Comprobantes)
 */

export const SRI_TAX_CODES = {
  IVA: '2',
  ICE: '3',
  IRBPNR: '5'
};

export const SRI_PERCENTAGE_CODES = {
  IVA_0: '0',
  IVA_15: '4', // Código SRI para tarifa IVA 15% (vigente)
  IVA_EXENTO: '6',
  IVA_NO_OBJETO: '7'
};

export const SRI_REGIMES = {
  RIMPE_POPULAR: 'RIMPE_POPULAR',
  RIMPE_EMPRENDEDOR: 'RIMPE_EMPRENDEDOR',
  REGIMEN_GENERAL: 'REGIMEN_GENERAL'
};

export class TaxEngine {
  /**
   * Calcula los totales de impuestos para un grupo de ítems
   * @param {Array} items Lista de ítems { precioUnitario, cantidad, porcentajeDescuento, aplicaIva15 }
   * @param {string} regimenEmisor Régimen SRI del emisor
   */
  static calculateTotals(items, regimenEmisor = SRI_REGIMES.REGIMEN_GENERAL) {
    let subtotal15 = 0;
    let subtotal0 = 0;
    let totalDescuento = 0;

    const processedItems = items.map(item => {
      const cantidad = Number(item.cantidad) || 1;
      const precioUnitario = Number(item.precioUnitario) || 0;
      const descuentoPorcentaje = Number(item.porcentajeDescuento) || 0;

      const subtotalBruto = cantidad * precioUnitario;
      const valorDescuento = (subtotalBruto * descuentoPorcentaje) / 100;
      const subtotalNeto = subtotalBruto - valorDescuento;

      // Si el emisor es RIMPE Popular, legalmente NO cobra IVA (todo va a IVA 0%)
      const cobraIva = regimenEmisor === SRI_REGIMES.RIMPE_POPULAR ? false : Boolean(item.aplicaIva15);

      let valorIva = 0;
      let codigoPorcentajeSRI = SRI_PERCENTAGE_CODES.IVA_0;

      if (cobraIva) {
        valorIva = Number((subtotalNeto * 0.15).toFixed(2));
        codigoPorcentajeSRI = SRI_PERCENTAGE_CODES.IVA_15;
        subtotal15 += subtotalNeto;
      } else {
        subtotal0 += subtotalNeto;
      }

      totalDescuento += valorDescuento;

      return {
        ...item,
        cantidad,
        precioUnitario,
        subtotalBruto,
        valorDescuento,
        subtotalNeto,
        codigoImpuestoSRI: SRI_TAX_CODES.IVA,
        codigoPorcentajeSRI,
        tarifaIva: cobraIva ? 15 : 0,
        valorIva,
        totalItem: subtotalNeto + valorIva
      };
    });

    const totalIva = Number((subtotal15 * 0.15).toFixed(2));
    const subtotalSinImpuestos = subtotal15 + subtotal0;
    const importeTotal = Number((subtotalSinImpuestos + totalIva).toFixed(2));

    // Determina leyendas legales obligatorias SRI
    const leyendasLegales = [];
    if (regimenEmisor === SRI_REGIMES.RIMPE_POPULAR) {
      leyendasLegales.push('Contribuyente Negocio Popular - Régimen RIMPE');
    } else if (regimenEmisor === SRI_REGIMES.RIMPE_EMPRENDEDOR) {
      leyendasLegales.push('Contribuyente Régimen RIMPE');
    }

    return {
      subtotal15: Number(subtotal15.toFixed(2)),
      subtotal0: Number(subtotal0.toFixed(2)),
      subtotalSinImpuestos: Number(subtotalSinImpuestos.toFixed(2)),
      totalDescuento: Number(totalDescuento.toFixed(2)),
      totalIva,
      importeTotal,
      leyendasLegales,
      items: processedItems
    };
  }

  /**
   * Determina el tipo de identificación SRI basado en el formato
   */
  static getSRITypeIdentification(identificacion) {
    if (!identificacion || identificacion === '9999999999999') {
      return { code: '07', name: 'CONSUMIDOR FINAL' };
    }
    const cleanId = String(identificacion).trim();
    if (cleanId.length === 13 && cleanId.endsWith('001')) {
      return { code: '04', name: 'RUC' };
    }
    if (cleanId.length === 10 && /^\d+$/.test(cleanId)) {
      return { code: '05', name: 'CÉDULA' };
    }
    return { code: '06', name: 'PASAPORTE / IDENTIFICACIÓN EXTERIOR' };
  }
}
