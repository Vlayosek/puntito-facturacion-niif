/**
 * Adaptador de Integración con AutorizadorEC API REST
 * 
 * Abstrae la generación de JSON de facturación electrónica, comunicación con los
 * web services de AutorizadorEC (Pruebas y Producción), y manejo de respuestas SRI.
 */

export class AutorizadorEcProvider {
  constructor(apiKey = 'DEMO_KEY_SANDBOX', environment = 'TEST') {
    this.apiKey = apiKey;
    this.environment = environment;
    // URL base de AutorizadorEC API (Simulada / Producción)
    this.baseUrl = environment === 'PROD' 
      ? 'https://api.autorizadorec.com/v1' 
      : 'https://sandbox.autorizadorec.com/v1';
  }

  /**
   * Transforma una factura interna del SaaS al formato DTO JSON exigido por la API AutorizadorEC
   */
  buildPayload(tenant, customer, totals, items, secuencialStr) {
    const fechaEmision = new Date().toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return {
      emisor: {
        ruc: tenant.ruc,
        razonSocial: tenant.razonSocial,
        nombreComercial: tenant.nombreComercial || tenant.razonSocial,
        direccionMatriz: tenant.direccionMatriz,
        establecimiento: tenant.establecimiento || '001',
        puntoEmision: tenant.puntoEmision || '001',
        obligadoContabilidad: tenant.obligadoContabilidad ? 'SI' : 'NO',
        regimen: tenant.regimenSRI
      },
      comprobante: {
        tipoComprobante: '01', // 01 = Factura
        secuencial: secuencialStr,
        fechaEmision: fechaEmision,
        comprador: {
          tipoIdentificacion: customer.tipoIdentificacionSRI, // 04, 05, 06, 07
          identificacion: customer.identificacion,
          razonSocial: customer.razonSocial,
          direccion: customer.direccion || 'Quito, Ecuador',
          email: customer.email
        },
        totales: {
          totalSinImpuestos: totals.subtotalSinImpuestos,
          totalDescuento: totals.totalDescuento,
          propina: 0,
          importeTotal: totals.importeTotal,
          moneda: 'DOLAR',
          impuestos: [
            ...(totals.subtotal15 > 0 ? [{
              codigo: '2', // IVA
              codigoPorcentaje: '4', // 15%
              baseImponible: totals.subtotal15,
              valor: totals.totalIva
            }] : []),
            ...(totals.subtotal0 > 0 ? [{
              codigo: '2',
              codigoPorcentaje: '0', // 0%
              baseImponible: totals.subtotal0,
              valor: 0
            }] : [])
          ]
        },
        detalles: items.map((item, index) => ({
          codigoPrincipal: item.codigo || `PROD-${index + 1}`,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          descuento: item.valorDescuento,
          precioTotalSinImpuesto: item.subtotalNeto,
          impuestos: [{
            codigo: '2',
            codigoPorcentaje: item.codigoPorcentajeSRI,
            tarifa: item.tarifaIva,
            baseImponible: item.subtotalNeto,
            valor: item.valorIva
          }]
        })),
        infoAdicional: [
          ...totals.leyendasLegales.map(leyenda => ({ nombre: 'Régimen', valor: leyenda })),
          { nombre: 'Email', valor: customer.email },
          { nombre: 'Generado por', valor: 'SaaS Facturación NIIF' }
        ]
      }
    };
  }

  /**
   * Envía la factura a la API de AutorizadorEC
   * En entorno sandbox de demostración, simula el proceso completo del SRI
   */
  async sendInvoice(payload) {
    // Si estamos en modo de prueba / simulación de laboratorio:
    if (this.apiKey.startsWith('DEMO') || this.environment === 'TEST') {
      return this._simulateSRIResponse(payload);
    }

    try {
      const response = await fetch(`${this.baseUrl}/facturas/emitir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (error) {
      console.error('Error al comunicar con AutorizadorEC API:', error);
      throw new Error(`Fallo en la comunicación con AutorizadorEC: ${error.message}`);
    }
  }

  /**
   * Simula la respuesta síncrona del SRI entregada por AutorizadorEC
   */
  _simulateSRIResponse(payload) {
    const now = new Date();
    const fechaFormatted = now.toISOString().replace(/[-:T.]/g, '').substring(0, 14);
    const ruc = payload.emisor.ruc;
    const tipoComprobante = payload.comprobante.tipoComprobante;
    const establecimiento = payload.emisor.establecimiento;
    const puntoEmision = payload.emisor.puntoEmision;
    const secuencial = payload.comprobante.secuencial;
    const codigoNumerico = '12345678';
    const tipoEmision = '1';

    // Formato de Clave de Acceso SRI (49 dígitos)
    // Fecha (8) + TipoComp (2) + RUC (13) + Ambiente (1) + Estab (3) + PtoEmi (3) + Secuencial (9) + CodNum (8) + TipoEmi (1) + DV (1)
    const fecha8 = now.toISOString().substring(0, 10).replace(/-/g, '').split('').reverse().join('');
    const rawClave = `${fecha8}${tipoComprobante}${ruc}1${establecimiento}${puntoEmision}${secuencial}${codigoNumerico}${tipoEmision}`;
    const claveAcceso = `${rawClave}7`; // Dígito verificador simulado

    return {
      status: 'SUCCESS',
      code: 200,
      message: 'Comprobante procesado y Autorizado por el SRI exitosamente',
      data: {
        estadoSRI: 'AUTORIZADO',
        claveAcceso: claveAcceso,
        numeroAutorizacion: claveAcceso,
        fechaAutorizacion: now.toLocaleString('es-EC'),
        ambiente: this.environment,
        rideUrl: `https://sandbox.autorizadorec.com/ride/pdf/${claveAcceso}`,
        xmlUrl: `https://sandbox.autorizadorec.com/xml/${claveAcceso}.xml`,
        payloadEnviado: payload
      }
    };
  }
}
