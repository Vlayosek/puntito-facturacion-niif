/**
 * Adaptador Operativo para Tiendas de Comercio / Puntos de Venta (POS)
 * 
 * Traduce ventas de mostrador / ítems de inventario a peticiones de Facturación SRI
 * (AutorizadorEC) y Asientos Contables NIIF automáticos.
 */

import { TaxEngine } from '../core/tax/TaxEngine.js';
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
    const tipoIdSRI = TaxEngine.getSRITypeIdentification(customerData?.identificacion);
    const customerSRI = {
      tipoIdentificacionSRI: tipoIdSRI.code,
      identificacion: customerData?.identificacion || '9999999999999',
      razonSocial: customerData?.razonSocial || 'CONSUMIDOR FINAL',
      direccion: customerData?.direccion || 'Quito, Ecuador',
      email: customerData?.email || 'cliente@ejemplo.com'
    };

    const items = cartItems.map(item => ({
      codigo: item.sku || 'PROD-POS',
      descripcion: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      porcentajeDescuento: item.descuento || 0,
      aplicaIva15: item.aplicaIva15 !== undefined ? item.aplicaIva15 : true
    }));

    const totals = TaxEngine.calculateTotals(items, this.tenant.regimenSRI);
    const secuencialStr = String(this.secuencialCounter++).padStart(9, '0');
    const invoiceNumber = `${this.tenant.establecimiento}-${this.tenant.puntoEmision}-${secuencialStr}`;

    const payload = this.sriProvider.buildPayload(this.tenant, customerSRI, totals, items, secuencialStr);
    const sriResponse = await this.sriProvider.sendInvoice(payload);

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
