import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'puntitodb'
});

export class DatabaseService {
  /**
   * Helper para mapear métodos de pago a códigos de catálogo SRI tbc_forma_pago
   */
  static mapFormaPagoSRI(formaPagoStr) {
    if (!formaPagoStr) return '01';
    const upper = String(formaPagoStr).toUpperCase();
    if (upper.includes('EFECTIVO') || upper === '01') return '01';
    if (upper.includes('DEBITO') || upper.includes('DÉBITO') || upper === '16') return '16';
    if (upper.includes('CREDITO') || upper.includes('CRÉDITO') || upper === '19') return '19';
    if (upper.includes('TRANSFERENCIA') || upper.includes('BANCO') || upper === '20') return '20';
    return '20'; // Default a Transferencia con uso del sistema financiero
  }

  /**
   * Obtiene o crea la empresa emisora y su establecimiento en puntito y facturación
   */
  static async getOrCreateTenant(tenantData = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cleanRuc = String(tenantData.ruc || '1792123456001').trim().substring(0, 13);
      const cleanRazonSocial = String(tenantData.razonSocial || 'EMPRESA EMISORA S.A.').trim().substring(0, 300);
      const cleanNombreComercial = String(tenantData.nombreComercial || cleanRazonSocial).trim().substring(0, 300);
      const cleanDireccion = String(tenantData.direccionMatriz || 'Quito, Ecuador').trim().substring(0, 300);
      const cleanRegimen = String(tenantData.regimenSRI || 'REGIMEN_GENERAL').trim().substring(0, 30);
      const esObligado = (tenantData.obligadoContabilidad === true || tenantData.obligadoContabilidad === 'SI') ? 'SI' : 'NO';

      // 1. puntito.tbm_cliente
      let res = await client.query(
        'SELECT id_cliente FROM puntito.tbm_cliente WHERE ruc = $1',
        [cleanRuc]
      );

      let idCliente;
      if (res.rowCount > 0) {
        idCliente = res.rows[0].id_cliente;
      } else {
        const codigoCliente = `CLI-${Date.now().toString().slice(-6)}`;
        const ins = await client.query(
          `INSERT INTO puntito.tbm_cliente (codigo_cliente, ruc, razon_social, nombre_comercial, email, telefono)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_cliente`,
          [codigoCliente, cleanRuc, cleanRazonSocial, cleanNombreComercial, tenantData.email || 'emisor@ejemplo.ec', tenantData.telefono || '0999999999']
        );
        idCliente = ins.rows[0].id_cliente;
      }

      // 2. facturacion.tbm_emisor
      res = await client.query(
        'SELECT id_emisor FROM facturacion.tbm_emisor WHERE id_cliente_puntito = $1 AND ruc = $2',
        [idCliente, cleanRuc]
      );

      let idEmisor;
      if (res.rowCount > 0) {
        idEmisor = res.rows[0].id_emisor;
      } else {
        const ins = await client.query(
          `INSERT INTO facturacion.tbm_emisor (id_cliente_puntito, ruc, razon_social, nombre_comercial, direccion_matriz, regimen_sri, obligado_contabilidad)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_emisor`,
          [idCliente, cleanRuc, cleanRazonSocial, cleanNombreComercial, cleanDireccion, cleanRegimen, esObligado]
        );
        idEmisor = ins.rows[0].id_emisor;
      }

      // 3. facturacion.tbm_establecimiento
      const codEstab = String(tenantData.establecimiento || '001').padStart(3, '0').substring(0, 3);
      const ptoEmi = String(tenantData.puntoEmision || '001').padStart(3, '0').substring(0, 3);

      res = await client.query(
        'SELECT id_establecimiento FROM facturacion.tbm_establecimiento WHERE id_cliente_puntito = $1 AND codigo_establecimiento = $2 AND punto_emision = $3',
        [idCliente, codEstab, ptoEmi]
      );

      let idEstablecimiento;
      if (res.rowCount > 0) {
        idEstablecimiento = res.rows[0].id_establecimiento;
      } else {
        const ins = await client.query(
          `INSERT INTO facturacion.tbm_establecimiento (id_cliente_puntito, id_emisor, codigo_establecimiento, punto_emision, direccion)
           VALUES ($1, $2, $3, $4, $5) RETURNING id_establecimiento`,
          [idCliente, idEmisor, codEstab, ptoEmi, cleanDireccion]
        );
        idEstablecimiento = ins.rows[0].id_establecimiento;
      }

      await client.query('COMMIT');
      return { idCliente, idEmisor, idEstablecimiento };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene o crea el cliente comprador de la factura
   */
  static async getOrCreateCustomer(idClientePuntito, customerData = {}) {
    const client = await pool.connect();
    try {
      const allowedTypes = ['04', '05', '06', '07', '08'];
      const tipoId = allowedTypes.includes(customerData.tipoIdentificacionSRI) ? customerData.tipoIdentificacionSRI : '07';
      const cleanId = String(customerData.identificacion || '9999999999999').trim().substring(0, 20);
      const cleanNombre = String(customerData.razonSocial || customerData.nombre || 'CONSUMIDOR FINAL').trim().substring(0, 300);
      const cleanEmail = String(customerData.email || 'cliente@ejemplo.ec').trim().substring(0, 300);

      const res = await client.query(
        'SELECT id_fe_cliente FROM facturacion.tbm_cliente WHERE id_cliente_puntito = $1 AND tipo_identificacion = $2 AND identificacion = $3',
        [idClientePuntito, tipoId, cleanId]
      );

      if (res.rowCount > 0) {
        return res.rows[0].id_fe_cliente;
      }

      const ins = await client.query(
        `INSERT INTO facturacion.tbm_cliente (id_cliente_puntito, tipo_identificacion, identificacion, razon_social, email, telefono)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_fe_cliente`,
        [idClientePuntito, tipoId, cleanId, cleanNombre, cleanEmail, customerData.telefono || '']
      );

      return ins.rows[0].id_fe_cliente;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el siguiente secuencial numérico único del SRI
   */
  static async getNextSequential(idClientePuntito, idEstablecimiento, codDoc = '01') {
    const res = await pool.query(
      'SELECT facturacion.get_next_sequential($1, $2, $3) AS secuencial',
      [idClientePuntito, idEstablecimiento, codDoc]
    );
    return res.rows[0].secuencial;
  }

  /**
   * Guarda una transacción completa: Factura + Detalles + Impuestos + Método Pago + Asiento NIIF + Detalles Asiento
   */
  static async saveInvoiceTransaction({ tenantIds, customerId, codDoc = '01', secuencialStr, totals, items, sriResponse, journalEntry, formaPago = 'EFECTIVO' }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sriData = sriResponse?.data || {};
      const claveAcceso = String(sriData.claveAcceso || `CLAVE-MOCK-${Date.now()}`).substring(0, 49);
      const estadoSRI = String(sriData.estadoSRI || 'AUTORIZADO').substring(0, 15);
      const rideUrl = `/ride-viewer.html?clave=${claveAcceso}`;
      const cleanSecuencial = String(secuencialStr || '000000001').padStart(9, '0').substring(0, 9);
      const codigoNumerico = String(sriData.codigoNumerico || '12345678').padStart(8, '0').substring(0, 8);

      const subSinImp = Number(totals.subtotalSinImpuestos || (totals.subtotal15 + totals.subtotal0)) || 0;
      const totDesc = Number(totals.totalDescuento) || 0;
      const totIva = Number(totals.totalIva) || 0;
      const impTot = Number(totals.importeTotal) || 0;

      // 1. Guardar en facturacion.tbt_documento
      const insDoc = await client.query(
        `INSERT INTO facturacion.tbt_documento (
          id_cliente_puntito, id_emisor, id_establecimiento, id_fe_cliente,
          cod_doc, fecha_emision, secuencial, codigo_numerico, clave_acceso,
          estado, total_sin_impuestos, total_descuento, total_iva, importe_total,
          payload_enviado_json, respuesta_sri_json, numero_autorizacion, fecha_autorizacion,
          url_ride_pdf, url_xml
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), $17, $18)
        RETURNING id_documento`,
        [
          tenantIds.idCliente, tenantIds.idEmisor, tenantIds.idEstablecimiento, customerId,
          codDoc, cleanSecuencial, codigoNumerico, claveAcceso,
          estadoSRI, subSinImp, totDesc, totIva, impTot,
          JSON.stringify(sriData.payloadEnviado || {}), JSON.stringify(sriResponse || {}), claveAcceso,
          rideUrl, sriData.xmlUrl || ''
        ]
      );
      const idDocumento = insDoc.rows[0].id_documento;

      // 2. Guardar en facturacion.tbt_documento_detalle y facturacion.tbt_detalle_impuesto
      for (const item of (items || [])) {
        const descripcionTxt = String(item.descripcion || item.nombre || 'Producto / Servicio General').trim().substring(0, 300);
        const codigoTxt = String(item.codigo || item.codigoPrincipal || item.sku || 'PROD').trim().substring(0, 25);
        const cantidad = Number(item.cantidad) || 1;
        const precioUnitario = Number(item.precioUnitario) || 0;
        const descuento = Number(item.valorDescuento || item.descuento) || 0;
        const precioTotalSinImp = Number(item.subtotalNeto || (cantidad * precioUnitario - descuento)) || 0;

        const insDet = await client.query(
          `INSERT INTO facturacion.tbt_documento_detalle (
            id_documento, codigo_principal, descripcion, cantidad, precio_unitario, descuento, precio_total_sin_imp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_detalle`,
          [idDocumento, codigoTxt, descripcionTxt, cantidad, precioUnitario, descuento, precioTotalSinImp]
        );
        const idDetalle = insDet.rows[0].id_detalle;

        // Impuesto por ítem (IVA 15% o 0%)
        const codPorcentaje = item.codigoPorcentajeSRI || (item.aplicaIva15 ? '4' : '0');
        const tarifa = item.tarifaIva || (item.aplicaIva15 ? 15 : 0);
        const valorIva = item.valorIva || (item.aplicaIva15 ? Number((precioTotalSinImp * 0.15).toFixed(2)) : 0);

        await client.query(
          `INSERT INTO facturacion.tbt_detalle_impuesto (
            id_detalle, codigo_impuesto, codigo_porcentaje, tarifa, base_imponible, valor
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [idDetalle, '2', codPorcentaje, tarifa, precioTotalSinImp, valorIva]
        );
      }

      // 3. Guardar en facturacion.tbt_pago
      const codigoFormaPago = this.mapFormaPagoSRI(formaPago);
      await client.query(
        `INSERT INTO facturacion.tbt_pago (id_documento, forma_pago, total)
         VALUES ($1, $2, $3)`,
        [idDocumento, codigoFormaPago, impTot]
      );

      // 4. Guardar Asiento Contable en contabilidad.tbt_asiento
      const numAsiento = String(journalEntry.entryId || `ASI-${Date.now()}`).substring(0, 30);
      const conceptoTxt = String(journalEntry.concept || 'Asiento Contable de Facturación').substring(0, 500);

      const insAsiento = await client.query(
        `INSERT INTO contabilidad.tbt_asiento (
          id_cliente_puntito, id_documento, numero_asiento, fecha, concepto, total_debe, total_haber, is_balanced
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7) RETURNING id_asiento`,
        [tenantIds.idCliente, idDocumento, numAsiento, conceptoTxt, Number(journalEntry.totalDebit) || impTot, Number(journalEntry.totalCredit) || impTot, Boolean(journalEntry.isBalanced)]
      );
      const idAsiento = insAsiento.rows[0].id_asiento;

      // 5. Guardar Detalle del Asiento en contabilidad.tbt_asiento_detalle
      for (const line of (journalEntry.lines || [])) {
        const cleanAccountCode = String(line.accountCode || '1.1.01.01').substring(0, 30);
        const cleanAccountName = String(line.accountName || 'Caja General').substring(0, 200);

        let resCuenta = await client.query(
          'SELECT id_cuenta FROM contabilidad.tbm_plan_cuentas WHERE id_cliente_puntito = $1 AND codigo_cuenta = $2',
          [tenantIds.idCliente, cleanAccountCode]
        );
        let idCuenta;
        if (resCuenta.rowCount > 0) {
          idCuenta = resCuenta.rows[0].id_cuenta;
        } else {
          const insCuenta = await client.query(
            `INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel)
             VALUES ($1, $2, $3, $4, $5) RETURNING id_cuenta`,
            [tenantIds.idCliente, cleanAccountCode, cleanAccountName, 'GENERAL', 4]
          );
          idCuenta = insCuenta.rows[0].id_cuenta;
        }

        await client.query(
          `INSERT INTO contabilidad.tbt_asiento_detalle (id_asiento, id_cuenta, debe, haber)
           VALUES ($1, $2, $3, $4)`,
          [idAsiento, idCuenta, Number(line.debit) || 0, Number(line.credit) || 0]
        );
      }

      await client.query('COMMIT');
      return idDocumento;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error guardando transacción en PostgreSQL:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  static async getInvoiceByClave(claveAcceso) {
    const resDoc = await pool.query(
      `SELECT d.*, c.razon_social as comprador_nombre, c.identificacion as comprador_id, c.email as comprador_email
       FROM facturacion.tbt_documento d
       LEFT JOIN facturacion.tbm_cliente c ON d.id_fe_cliente = c.id_fe_cliente
       WHERE d.clave_acceso = $1`,
      [claveAcceso]
    );
    if (resDoc.rowCount === 0) return null;

    const doc = resDoc.rows[0];
    const resDetalles = await pool.query(
      'SELECT * FROM facturacion.tbt_documento_detalle WHERE id_documento = $1',
      [doc.id_documento]
    );

    return { ...doc, detalles: resDetalles.rows };
  }

  static async getInvoices(idClientePuntito = 1) {
    const res = await pool.query(
      `SELECT d.id_documento, d.secuencial, d.clave_acceso, d.estado, d.fecha_emision, d.importe_total,
              d.url_ride_pdf, d.url_xml, c.razon_social as comprador_nombre, c.identificacion as comprador_id
       FROM facturacion.tbt_documento d
       LEFT JOIN facturacion.tbm_cliente c ON d.id_fe_cliente = c.id_fe_cliente
       ORDER BY d.id_documento DESC LIMIT 20`
    );
    return res.rows;
  }

  static async getJournalEntries(idClientePuntito = 1) {
    const resAsientos = await pool.query(
      `SELECT a.id_asiento, a.numero_asiento, a.fecha, a.concepto, a.total_debe, a.total_haber, a.is_balanced, d.secuencial as invoice_ref
       FROM contabilidad.tbt_asiento a
       LEFT JOIN facturacion.tbt_documento d ON a.id_documento = d.id_documento
       ORDER BY a.id_asiento DESC LIMIT 20`
    );

    const entries = [];
    for (const row of resAsientos.rows) {
      const resLines = await pool.query(
        `SELECT l.debe as debit, l.haber as credit, c.codigo_cuenta as account_code, c.nombre_cuenta as account_name
         FROM contabilidad.tbt_asiento_detalle l
         JOIN contabilidad.tbm_plan_cuentas c ON l.id_cuenta = c.id_cuenta
         WHERE l.id_asiento = $1`,
        [row.id_asiento]
      );

      entries.push({
        entryId: row.numero_asiento,
        invoiceRef: row.invoice_ref || 'FACTURA',
        date: row.fecha ? row.fecha.toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
        concept: row.concepto,
        totalDebit: Number(row.total_debe),
        totalCredit: Number(row.total_haber),
        isBalanced: row.is_balanced,
        lines: resLines.rows.map(l => ({
          accountCode: l.account_code,
          accountName: l.account_name,
          debit: Number(l.debit),
          credit: Number(l.credit)
        }))
      });
    }

    return entries;
  }
}
