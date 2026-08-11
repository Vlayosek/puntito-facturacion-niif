/**
 * Adaptador Operativo para Clínicas Odontológicas y Consultorios Dentales
 * 
 * Traduce citas agendadas, pacientes y procedimientos dentales (Limpieza, Calza, Endodoncia)
 * a comprobantes de Facturación Electrónica SRI (IVA 0% por Servicios de Salud) y Asientos Contables NIIF.
 */

import { TaxEngine } from '../core/tax/TaxEngine.js';
import { AutorizadorEcProvider } from '../core/sri/AutorizadorEcProvider.js';
import { AccountingEngine } from '../core/accounting/AccountingEngine.js';

export class DentistAppointmentAdapter {
  constructor(tenantConfig, autorizadorKey = 'DEMO_KEY_SANDBOX') {
    this.tenant = tenantConfig;
    this.sriProvider = new AutorizadorEcProvider(autorizadorKey, 'TEST');
    this.accountingEngine = new AccountingEngine();
    this.secuencialCounter = 1;
  }

  /**
   * Procesa la atención de una cita odontológica finalizada
   */
  async processDentalAppointment({ patient, appointmentDetails, paymentMethod = 'EFECTIVO' }) {
    const tipoIdSRI = TaxEngine.getSRITypeIdentification(patient.identificacion);
    const customerSRI = {
      tipoIdentificacionSRI: tipoIdSRI.code,
      identificacion: patient.identificacion || '9999999999999',
      razonSocial: patient.nombreCompleto || 'CONSUMIDOR FINAL',
      direccion: patient.direccion || 'Quito, Ecuador',
      email: patient.email || 'paciente@ejemplo.com'
    };

    // Los servicios de salud odontológica están gravados con Tarifa 0% de IVA según LRTI Art. 56
    const items = [{
      codigo: appointmentDetails.codigoProcedimiento || 'ODONT-001',
      descripcion: `Atención Odontológica: ${appointmentDetails.procedimiento} - Odontólogo: ${appointmentDetails.nombreDentista}`,
      cantidad: 1,
      precioUnitario: appointmentDetails.costoProcedimiento,
      porcentajeDescuento: appointmentDetails.descuento || 0,
      aplicaIva15: false
    }];

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
      businessType: 'SERVICIOS_MEDICOS'
    });

    return {
      module: 'CONSULTORIO_ODONTOLOGICO',
      invoiceNumber,
      customer: customerSRI,
      totals,
      sriResponse,
      journalEntry
    };
  }
}
