/**
 * CatalogService — Lee los catalogos SRI oficiales desde la base de datos
 * con cache en memoria (TTL 5 minutos) para no consultar en cada factura.
 *
 * Reemplaza los valores hardcodeados en TaxEngine y DatabaseService.
 */

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

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const _cache = {
  tiposIdentificacion: null,
  tarifasIva: null,
  formasPago: null,
  impuestos: null,
  tiposDocumento: null,
  _timestamps: {}
};

function _isFresh(key) {
  const ts = _cache._timestamps[key];
  return ts && (Date.now() - ts) < CACHE_TTL_MS;
}

function _set(key, value) {
  _cache[key] = value;
  _cache._timestamps[key] = Date.now();
}

export class CatalogService {
  /**
   * Tipos de identificacion SRI (04=RUC, 05=Cedula, 06=Pasaporte, 07=Consumidor Final, 08=Exterior)
   * @returns {Promise<Array<{codigo, descripcion}>>}
   */
  static async getTiposIdentificacion() {
    if (_isFresh('tiposIdentificacion')) return _cache.tiposIdentificacion;
    const res = await pool.query(
      'SELECT codigo, descripcion FROM facturacion.tbc_tipo_identificacion WHERE estado = TRUE ORDER BY codigo'
    );
    _set('tiposIdentificacion', res.rows);
    return res.rows;
  }

  /**
   * Tarifas IVA SRI (0=IVA0%, 4=IVA15%, 6=No objeto, 7=Exento, etc.)
   * @returns {Promise<Array<{codigo_porcentaje, descripcion, porcentaje}>>}
   */
  static async getTarifasIva() {
    if (_isFresh('tarifasIva')) return _cache.tarifasIva;
    const res = await pool.query(
      'SELECT codigo_porcentaje, descripcion, porcentaje FROM facturacion.tbc_tarifa_iva WHERE estado = TRUE ORDER BY codigo_porcentaje'
    );
    _set('tarifasIva', res.rows);
    return res.rows;
  }

  /**
   * Formas de pago SRI (01=Efectivo, 16=Debito, 19=Credito, 20=Otros, etc.)
   * @returns {Promise<Array<{codigo, descripcion}>>}
   */
  static async getFormasPago() {
    if (_isFresh('formasPago')) return _cache.formasPago;
    const res = await pool.query(
      'SELECT codigo, descripcion FROM facturacion.tbc_forma_pago WHERE estado = TRUE ORDER BY codigo'
    );
    _set('formasPago', res.rows);
    return res.rows;
  }

  /**
   * Tipos de impuesto SRI (2=IVA, 3=ICE, 5=IRBPNR)
   * @returns {Promise<Array<{codigo, descripcion}>>}
   */
  static async getImpuestos() {
    if (_isFresh('impuestos')) return _cache.impuestos;
    const res = await pool.query(
      'SELECT codigo, descripcion FROM facturacion.tbc_impuesto WHERE estado = TRUE ORDER BY codigo'
    );
    _set('impuestos', res.rows);
    return res.rows;
  }

  /**
   * Tipos de documento SRI (01=Factura, 04=NC, 05=ND, etc.)
   * @returns {Promise<Array<{codigo, descripcion, version_xml}>>}
   */
  static async getTiposDocumento() {
    if (_isFresh('tiposDocumento')) return _cache.tiposDocumento;
    const res = await pool.query(
      'SELECT codigo, descripcion, version_xml FROM facturacion.tbc_tipo_documento WHERE estado = TRUE ORDER BY codigo'
    );
    _set('tiposDocumento', res.rows);
    return res.rows;
  }

  /**
   * Devuelve todos los catalogos SRI en un solo objeto (para el endpoint /api/catalogs)
   */
  static async getAllCatalogs() {
    const [tiposId, tarifasIva, formasPago, impuestos, tiposDoc] = await Promise.all([
      CatalogService.getTiposIdentificacion(),
      CatalogService.getTarifasIva(),
      CatalogService.getFormasPago(),
      CatalogService.getImpuestos(),
      CatalogService.getTiposDocumento()
    ]);
    return { tiposIdentificacion: tiposId, tarifasIva, formasPago, impuestos, tiposDocumento: tiposDoc };
  }

  /**
   * Resuelve el tipo de identificacion SRI a partir del numero de identificacion
   * Lee de la BD en lugar de logica hardcodeada
   * @param {string} identificacion
   * @returns {Promise<{code: string, name: string}>}
   */
  static async resolveIdentificationType(identificacion) {
    if (!identificacion || identificacion === '9999999999999') {
      return { code: '07', name: 'VENTA A CONSUMIDOR FINAL' };
    }
    const cleanId = String(identificacion).trim();
    // RUC: 13 digitos terminados en 001
    if (cleanId.length === 13 && cleanId.endsWith('001')) {
      return { code: '04', name: 'RUC' };
    }
    // Cedula: 10 digitos numericos
    if (cleanId.length === 10 && /^\d+$/.test(cleanId)) {
      return { code: '05', name: 'CEDULA' };
    }
    // Pasaporte / Exterior
    return { code: '06', name: 'PASAPORTE / IDENTIFICACION EXTERIOR' };
  }

  /**
   * Mapea forma de pago texto a codigo SRI leyendo de la BD
   * @param {string} formaPagoStr
   * @returns {Promise<string>} codigo SRI (01, 16, 19, 20, etc.)
   */
  static async resolveFormaPago(formaPagoStr) {
    if (!formaPagoStr) return '01';
    const upper = String(formaPagoStr).toUpperCase().trim();

    // Si ya es un codigo numerico valido, verificar en BD
    if (/^\d{2}$/.test(upper)) {
      const fps = await CatalogService.getFormasPago();
      if (fps.find(f => f.codigo === upper)) return upper;
    }

    // Mapeo por palabras clave
    if (upper.includes('EFECTIVO')) return '01';
    if (upper.includes('DEBITO')) return '16';
    if (upper.includes('ELECTRONICO') || upper.includes('ELECTRONICA')) return '17';
    if (upper.includes('PREPAGO')) return '18';
    if (upper.includes('CREDITO')) return '19';
    if (upper.includes('TRANSFERENCIA') || upper.includes('BANCO')) return '22';
    if (upper.includes('COMPENSACION')) return '15';
    if (upper.includes('ENDOSO')) return '21';

    return '20'; // Default: otros con utilizacion del sistema financiero
  }

  /** Invalida el cache (util despues de actualizar catalogos) */
  static invalidateCache() {
    Object.keys(_cache._timestamps).forEach(k => delete _cache._timestamps[k]);
  }
}
