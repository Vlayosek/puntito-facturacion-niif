/**
 * Adaptador Operativo para Tiendas de Comercio / Puntos de Venta (POS)
 * 
 * Traduce ventas de mostrador / ítems de inventario a peticiones de Facturación SRI
 * (AutorizadorEC) y Asientos Contables NIIF automáticos.
 */

import { TaxEngine, SRI_REGIMES } from '../core/tax/TaxEngine.js';
import { AutorizadorEcProvider } from '../core/sri/AutorizadorEcProvider.js';
import { AccountingEngine } from '../core/accounting/AccountingEngine.js';

export class RetailStoreAdapter {
  constructor(tenantConfig, autorizadorKey = 'DEMO_KEY_SANDBOX') {
    this.tenant = tenantConfig;
    this.sriProvider = new AutorizadorEcProvider(autorizadorKey, 'TEST');
    this.accountingEngine = new AccountingEngine();
    this.secuencialCounter = 100;
  }

  /**
   * Procesa una venta en punto de venta (POS)
   */
  async processPosSale({ customerData, cartItems, paymentMethod = 'EFECTIVO' }) {
    // 1. Identificación SRI del comprador
    const tipoIdSRI = TaxEngine.getSRITypeIdentification(customerData?.identificacion);
    const customerSRI = {
      tipoIdentificacionSRI: tipoIdSRI.code,
      identificacion: customerData?.identificacion || '9999999999999',
      razonSocial: customerData?.razonSocial || 'CONSUMIDOR FINAL',
      direccion: customerData?.direccion || 'Quito, Ecuador',
      email: customerData?.email || 'cliente@ejemplo.com'
    };

    // 2. Mapear ítems del carrito
    const items = cartItems.map(item => ({
      codigo: item.sku || 'PROD-POS',
      descripcion: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      porcentajeDescuento: item.descuento || 0,
      aplicaIva15: item.aplicaIva15 !== undefined ? item.aplicaIva15 : true
    }));

    // 3. Calcular Impuestos SRI según Régimen Emisor
    const totals = TaxEngine.calculateTotals(items, this.tenant.regimenSRI);

    // 4. Formatear Secuencial SRI
    const secuencialStr = String(this.secuencialCounter++).padStart(9, '0');
    const invoiceNumber = `${this.tenant.establecimiento}-${this.tenant.puntoEmision}-${secuencialStr}`;

    // 5. Construir Payload y enviar a AutorizadorEC API
    const payload = this.sriProvider.buildPayload(this.tenant, customerSRI, totals, items, secuencialStr);
    const sriResponse = await this.sriProvider.sendInvoice(payload);

    // 6. Generar Asiento Contable Automático NIIF
    const journalEntry = this.accountingEngine.generateJournalEntryFromInvoice({
      invoiceNumber,
      date: new Date().toISOString().substring(0, 10),
      totals,
      paymentMethod,
      businessType: 'BIENES'
    });

    return {
      module: 'TIENDA_POS',
      invoiceNumber,
      customer: customerSRI,
      totals,
      sriResponse,
      journalEntry
    };
  }
}
