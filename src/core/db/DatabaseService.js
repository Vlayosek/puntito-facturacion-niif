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
   * Obtiene o crea la empresa emisora en PostgreSQL
   */
  static async getOrCreateTenant(tenantData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let res = await client.query(
        'SELECT id_cliente FROM puntito.tbm_cliente WHERE ruc = $1',
        [tenantData.ruc]
      );

      let idCliente;
      if (res.rowCount > 0) {
        idCliente = res.rows[0].id_cliente;
      } else {
        const codigoCliente = `CLI-${Date.now().toString().slice(-6)}`;
        const ins = await client.query(
          `INSERT INTO puntito.tbm_cliente (codigo_cliente, ruc, razon_social, nombre_comercial, email, telefono)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_cliente`,
          [codigoCliente, tenantData.ruc, tenantData.razonSocial, tenantData.nombreComercial, tenantData.email || 'emisor@ejemplo.ec', tenantData.telefono || '0999999999']
        );
        idCliente = ins.rows[0].id_cliente;
      }

      res = await client.query(
        'SELECT id_emisor FROM facturacion.tbm_emisor WHERE id_cliente_puntito = $1 AND ruc = $2',
        [idCliente, tenantData.ruc]
      );

      let idEmisor;
      if (res.rowCount > 0) {
        idEmisor = res.rows[0].id_emisor;
      } else {
        const ins = await client.query(
          `INSERT INTO facturacion.tbm_emisor (id_cliente_puntito, ruc, razon_social, nombre_comercial, direccion_matriz, regimen_sri, obligado_contabilidad)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_emisor`,
          [idCliente, tenantData.ruc, tenantData.razonSocial, tenantData.nombreComercial, tenantData.direccionMatriz || 'Quito, Ecuador', tenantData.regimenSRI || 'REGIMEN_GENERAL', tenantData.obligadoContabilidad ? 'SI' : 'NO']
        );
        idEmisor = ins.rows[0].id_emisor;
      }

      const codEstab = tenantData.establecimiento || '001';
      const ptoEmi = tenantData.puntoEmision || '001';
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
          [idCliente, idEmisor, codEstab, ptoEmi, tenantData.direccionMatriz || 'Quito, Ecuador']
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
   * Obtiene o crea el cliente/comprador final o paciente en PostgreSQL
   */
  static async getOrCreateCustomer(idClientePuntito, customerData) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT id_fe_cliente FROM facturacion.tbm_cliente WHERE id_cliente_puntito = $1 AND tipo_identificacion = $2 AND identificacion = $3',
        [idClientePuntito, customerData.tipoIdentificacionSRI, customerData.identificacion]
      );

      if (res.rowCount > 0) {
        return res.rows[0].id_fe_cliente;
      }

      const ins = await client.query(
        `INSERT INTO facturacion.tbm_cliente (id_cliente_puntito, tipo_identificacion, identificacion, razon_social, email, telefono)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_fe_cliente`,
        [idClientePuntito, customerData.tipoIdentificacionSRI, customerData.identificacion, customerData.razonSocial, customerData.email, customerData.telefono || '']
      );

      return ins.rows[0].id_fe_cliente;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el siguiente secuencial autorumétrico usando la función PostgreSQL
   */
  static async getNextSequential(idClientePuntito, idEstablecimiento, codDoc = '01') {
    const res = await pool.query(
      'SELECT facturacion.get_next_sequential($1, $2, $3) AS secuencial',
      [idClientePuntito, idEstablecimiento, codDoc]
    );
    return res.rows[0].secuencial;
  }

  /**
   * Guarda una transacción completa en PostgreSQL (Factura SRI + Detalle + Asiento Contable NIIF)
   */
  static async saveInvoiceTransaction({ tenantIds, customerId, codDoc = '01', secuencialStr, totals, items, sriResponse, journalEntry }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sriData = sriResponse.data || {};
      const claveAcceso = sriData.claveAcceso || `CLAVE-MOCK-${Date.now()}`;
      const estadoSRI = sriData.estadoSRI || 'AUTORIZADO';
      const rideUrl = `/ride-viewer.html?clave=${claveAcceso}`;

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
          codDoc, secuencialStr, '12345678', claveAcceso,
          estadoSRI, totals.subtotalSinImpuestos, totals.totalDescuento, totals.totalIva, totals.importeTotal,
          JSON.stringify(sriData.payloadEnviado || {}), JSON.stringify(sriResponse), claveAcceso,
          rideUrl, sriData.xmlUrl || ''
        ]
      );
      const idDocumento = insDoc.rows[0].id_documento;

      for (const item of items) {
        await client.query(
          `INSERT INTO facturacion.tbt_documento_detalle (
            id_documento, codigo_principal, descripcion, cantidad, precio_unitario, descuento, precio_total_sin_imp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [idDocumento, item.codigo || 'PROD', item.descripcion, item.cantidad, item.precioUnitario, item.valorDescuento || 0, item.subtotalNeto]
        );
      }

      const insAsiento = await client.query(
        `INSERT INTO contabilidad.tbt_asiento (
          id_cliente_puntito, id_documento, numero_asiento, fecha, concepto, total_debe, total_haber, is_balanced
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7) RETURNING id_asiento`,
        [tenantIds.idCliente, idDocumento, journalEntry.entryId, journalEntry.concept, journalEntry.totalDebit, journalEntry.totalCredit, journalEntry.isBalanced]
      );
      const idAsiento = insAsiento.rows[0].id_asiento;

      for (const line of journalEntry.lines) {
        let resCuenta = await client.query(
          'SELECT id_cuenta FROM contabilidad.tbm_plan_cuentas WHERE id_cliente_puntito = $1 AND codigo_cuenta = $2',
          [tenantIds.idCliente, line.accountCode]
        );
        let idCuenta;
        if (resCuenta.rowCount > 0) {
          idCuenta = resCuenta.rows[0].id_cuenta;
        } else {
          const insCuenta = await client.query(
            `INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel)
             VALUES ($1, $2, $3, $4, $5) RETURNING id_cuenta`,
            [tenantIds.idCliente, line.accountCode, line.accountName, 'GENERAL', 4]
          );
          idCuenta = insCuenta.rows[0].id_cuenta;
        }

        await client.query(
          `INSERT INTO contabilidad.tbt_asiento_detalle (id_asiento, id_cuenta, debe, haber)
           VALUES ($1, $2, $3, $4)`,
          [idAsiento, idCuenta, line.debit, line.credit]
        );
      }

      await client.query('COMMIT');
      return idDocumento;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene una factura por su clave de acceso
   */
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

  /**
   * Obtiene la lista de facturas emitidas registradas en PostgreSQL
   */
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

  /**
   * Obtiene el Libro Diario registrado en PostgreSQL
   */
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
        `SELECT l.debit, l.haber as credit, c.codigo_cuenta as account_code, c.nombre_cuenta as account_name
         FROM contabilidad.tbt_asiento_detalle l
         JOIN contabilidad.tbm_plan_cuentas c ON l.id_cuenta = c.id_cuenta
         WHERE l.id_asiento = $1`,
        [row.id_asiento]
      );

      entries.push({
        entryId: row.numero_asiento,
        invoiceRef: row.invoice_ref || 'FACTURA',
        date: row.fecha.toISOString().substring(0, 10),
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
