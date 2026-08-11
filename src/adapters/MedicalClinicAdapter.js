/**
 * Adaptador Operativo para Consultorios Médicos / Profesionales de la Salud
 * 
 * Traduce eventos de la consulta médica (Pacientes, Citas, Honorarios)
 * a peticiones de Facturación SRI (AutorizadorEC) y Asientos Contables NIIF.
 */

import { TaxEngine, SRI_REGIMES } from '../core/tax/TaxEngine.js';
import { AutorizadorEcProvider } from '../core/sri/AutorizadorEcProvider.js';
import { AccountingEngine } from '../core/accounting/AccountingEngine.js';

export class MedicalClinicAdapter {
  constructor(tenantConfig, autorizadorKey = 'DEMO_KEY_SANDBOX') {
    this.tenant = tenantConfig;
    this.sriProvider = new AutorizadorEcProvider(autorizadorKey, 'TEST');
    this.accountingEngine = new AccountingEngine();
    this.secuencialCounter = 1;
  }

  /**
   * Procesa la atención de un paciente y genera todo el ciclo tributario y contable
   */
  async processPatientConsultation({ patient, consultationDetails, paymentMethod = 'EFECTIVO' }) {
    // 1. Preparar comprador según reglas SRI
    const tipoIdSRI = TaxEngine.getSRITypeIdentification(patient.identificacion);
    const customerSRI = {
      tipoIdentificacionSRI: tipoIdSRI.code,
      identificacion: patient.identificacion || '9999999999999',
      razonSocial: patient.nombreCompleto || 'CONSUMIDOR FINAL',
      direccion: patient.direccion || 'Quito, Ecuador',
      email: patient.email || 'paciente@ejemplo.com'
    };

    // 2. Definir ítems de la consulta médica
    // Nota Médica: Los servicios de salud están grabados con Tarifa 0% de IVA en Ecuador según la Ley de Régimen Tributario Interno
    const items = [{
      codigo: consultationDetails.codigoServicio || 'MED-001',
      descripcion: `Consulta Médica: ${consultationDetails.especialidad || 'General'} - Diagnóstico: ${consultationDetails.diagnosticoCie10 || 'Atención General'}`,
      cantidad: 1,
      precioUnitario: consultationDetails.honorario,
      porcentajeDescuento: consultationDetails.descuento || 0,
      aplicaIva15: false // Servicios médicos = IVA 0% por ley
    }];

    // 3. Calcular Impuestos SRI
    const totals = TaxEngine.calculateTotals(items, this.tenant.regimenSRI);

    // 4. Formatear Secuencial SRI (9 dígitos)
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
      businessType: 'SERVICIOS_MEDICOS'
    });

    return {
      module: 'CONSULTORIO_MEDICO',
      invoiceNumber,
      customer: customerSRI,
      totals,
      sriResponse,
      journalEntry
    };
  }
}
