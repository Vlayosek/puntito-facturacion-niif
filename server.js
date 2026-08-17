import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { TaxEngine, SRI_REGIMES } from './src/core/tax/TaxEngine.js';
import { AutorizadorEcProvider } from './src/core/sri/AutorizadorEcProvider.js';
import { AccountingEngine } from './src/core/accounting/AccountingEngine.js';
import { DEFAULT_CHART_OF_ACCOUNTS } from './src/core/accounting/defaultChartOfAccounts.js';
import { DatabaseService } from './src/core/db/DatabaseService.js';
import { CatalogService } from './src/core/catalog/CatalogService.js';
import { AuthService } from './src/core/auth/AuthService.js';
import { authenticate } from './src/core/auth/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==============================================================================
// RUTAS PUBLICAS (sin autenticacion)
// ==============================================================================

/** Estado del servidor y configuracion publica */
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    environment: process.env.AUTORIZADOR_EC_ENV || 'TEST',
    database: process.env.PGDATABASE || 'puntitodb'
  });
});

/** Catalogos SRI oficiales (tipos de identificacion, tarifas IVA, formas de pago) */
app.get('/api/catalogs', async (req, res) => {
  try {
    const catalogs = await CatalogService.getAllCatalogs();
    res.json({ success: true, data: catalogs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Plan de cuentas NIIF por defecto */
app.get('/api/accounting/chart-of-accounts', (req, res) => {
  res.json({ success: true, data: DEFAULT_CHART_OF_ACCOUNTS });
});

// ==============================================================================
// AUTENTICACION JWT
// ==============================================================================

/** Login — retorna token JWT valido por 8 horas */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    const result = await AuthService.login(usuario, password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

/** Registrar nuevo usuario (requiere estar autenticado como admin) */
app.post('/api/auth/register', authenticate, async (req, res) => {
  try {
    if (req.user.usuario !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo el usuario administrador (admin) puede registrar nuevos usuarios.'
      });
    }

    const { usuario, nombre, email, password } = req.body;
    // El nuevo usuario pertenece a la misma empresa del admin autenticado
    const result = await AuthService.createUser({
      idCliente: req.user.idCliente,
      usuario, nombre, email, password
    });
    res.json({ success: true, ...result, message: 'Usuario creado exitosamente' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/** Cambiar contrasena del usuario autenticado */
app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    await AuthService.changePassword(req.user.idUsuario, passwordActual, passwordNueva);
    res.json({ success: true, message: 'Contrasena actualizada exitosamente' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/** Listar usuarios de la empresa del usuario autenticado */
app.get('/api/auth/users', authenticate, async (req, res) => {
  try {
    const users = await AuthService.listUsers(req.user.idCliente);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Me — retorna info del usuario autenticado */
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ==============================================================================
// CONFIGURACION POR EMPRESA (tbc_configuracion) -- requiere autenticacion
// ==============================================================================

/** Obtener configuracion de AutorizadorEC de la empresa autenticada */
app.get('/api/admin/configuracion', authenticate, async (req, res) => {
  try {
    const config = await DatabaseService.getConfiguracion(req.user.idCliente);
    res.json({
      success: true,
      configured: Boolean(config?.autorizador_ec_api_key),
      ambiente: config?.ambiente || '1',
      env: config?.autorizador_ec_env || 'TEST'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Guardar API Key de AutorizadorEC para la empresa autenticada */
app.post('/api/admin/configuracion', authenticate, async (req, res) => {
  try {
    if (req.user.usuario !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo el usuario administrador (admin) puede modificar la API Key.'
      });
    }

    const { apiKey, ambiente } = req.body;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ success: false, error: 'API Key requerida' });
    }
    await DatabaseService.saveConfiguracion(req.user.idCliente, apiKey, ambiente || '1');
    res.json({ success: true, message: 'Configuracion de AutorizadorEC guardada para tu empresa.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================================================================
// ENDPOINTS PROTEGIDOS — requieren JWT valido
// ==============================================================================

app.get('/api/accounting/ledger', authenticate, async (req, res) => {
  try {
    const entries = await DatabaseService.getJournalEntries(req.user.idCliente);
    res.json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/invoices', authenticate, async (req, res) => {
  try {
    const invoices = await DatabaseService.getInvoices(req.user.idCliente);
    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/invoices/:claveAcceso', authenticate, async (req, res) => {
  try {
    const invoice = await DatabaseService.getInvoiceByClave(req.params.claveAcceso);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Factura no encontrada' });
    }
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================================================================
// ENDPOINT UNIVERSAL DE FACTURACION SRI + NIIF (protegido)
// ==============================================================================
app.post('/api/v1/invoices/emit', authenticate, async (req, res) => {
  try {
    const { tenantConfig, comprador, items, formaPago } = req.body;

    // Obtener API Key de tbc_configuracion de la empresa autenticada
    const config = await DatabaseService.getConfiguracion(req.user.idCliente);
    if (!config || !config.autorizador_ec_api_key) {
      return res.status(400).json({
        success: false,
        error: 'Tu empresa no tiene API Key de AutorizadorEC configurada. Ve a Configuracion > API Key para agregarla.',
        code: 'NO_API_KEY'
      });
    }
    const activeApiKey = config.autorizador_ec_api_key;
    const activeEnv = config.autorizador_ec_env || 'TEST';

    // Cargar los datos REALES del emisor pertenecientes a la empresa del usuario autenticado (req.user.idCliente)
    let emisorTenant = await DatabaseService.getTenantByClienteId(req.user.idCliente);

    if (!emisorTenant) {
      return res.status(400).json({
        success: false,
        error: `No se encontraron datos de emisor para tu empresa (${req.user.empresaNombre || 'ID #' + req.user.idCliente}).`
      });
    }

    if (tenantConfig && tenantConfig.regimenSRI) {
      // Si el usuario selecciono un Regimen SRI especifico en la UI, aplicarlo
      emisorTenant.regimenSRI = tenantConfig.regimenSRI;
    }

    const tenantIds = await DatabaseService.getOrCreateTenant(emisorTenant);

    // Resolver tipo de identificacion desde CatalogService (lee de BD)
    const tipoId = await CatalogService.resolveIdentificationType(comprador?.identificacion);

    const customerId = await DatabaseService.getOrCreateCustomer(tenantIds.idCliente, {
      tipoIdentificacionSRI: tipoId.code,
      identificacion: comprador?.identificacion || '9999999999999',
      razonSocial: comprador?.nombre || comprador?.razonSocial || 'CONSUMIDOR FINAL',
      email: comprador?.email || 'cliente@ejemplo.ec'
    });

    const secuencialStr = await DatabaseService.getNextSequential(tenantIds.idCliente, tenantIds.idEstablecimiento, '01');
    const invoiceNumber = `${emisorTenant.establecimiento}-${emisorTenant.puntoEmision}-${secuencialStr}`;

    const normalizedItems = (items || []).map(item => ({
      codigo: item.codigo || item.codigoPrincipal || item.sku || 'PROD',
      descripcion: item.descripcion || item.nombre || 'Producto / Servicio General',
      cantidad: Number(item.cantidad) || 1,
      precioUnitario: Number(item.precioUnitario) || 0,
      porcentajeDescuento: Number(item.descuento || item.porcentajeDescuento) || 0,
      aplicaIva15: item.aplicaIva15 !== undefined ? Boolean(item.aplicaIva15) : true
    }));

    const totals = TaxEngine.calculateTotals(normalizedItems, emisorTenant.regimenSRI);

    const sriProvider = new AutorizadorEcProvider(activeApiKey, activeEnv);
    const payloadSRI = sriProvider.buildPayload(
      emisorTenant,
      { tipoIdentificacionSRI: tipoId.code, identificacion: comprador.identificacion, razonSocial: comprador.nombre || comprador.razonSocial, email: comprador.email },
      totals,
      totals.items,
      secuencialStr
    );
    const sriResponse = await sriProvider.sendInvoice(payloadSRI);

    const accountingEngine = new AccountingEngine();
    const journalEntry = accountingEngine.generateJournalEntryFromInvoice({
      invoiceNumber,
      date: new Date().toISOString().substring(0, 10),
      totals,
      paymentMethod: formaPago || 'EFECTIVO',
      businessType: totals.subtotal15 > 0 ? 'BIENES' : 'SERVICIOS'
    });

    const idDocumento = await DatabaseService.saveInvoiceTransaction({
      tenantIds,
      customerId,
      codDoc: '01',
      secuencialStr,
      totals,
      items: totals.items,
      sriResponse,
      journalEntry,
      formaPago
    });

    res.json({
      success: true,
      idDocumento,
      result: {
        module: 'SaaS_Universal',
        invoiceNumber,
        customer: {
          tipoIdentificacionSRI: tipoId.code,
          identificacion: comprador.identificacion,
          razonSocial: comprador.nombre || comprador.razonSocial
        },
        totals,
        sriResponse,
        journalEntry
      }
    });
  } catch (error) {
    console.error('Error en Endpoint Universal de Facturacion:', error);
    const errMsg = error.message || (error.errors && error.errors[0]?.message) || error.toString() || 'Error desconocido';
    res.status(500).json({ success: false, error: errMsg, code: error.code });
  }
});

// Modulo Medico (re-route al endpoint universal)
app.post('/api/modules/medical/emit-invoice', authenticate, async (req, res) => {
  req.body = {
    tenantConfig: req.body.tenantConfig,
    comprador: { identificacion: req.body.patient?.identificacion, nombre: req.body.patient?.nombreCompleto, email: req.body.patient?.email },
    items: [{ codigo: 'MED-001', descripcion: `Consulta Medica: ${req.body.consultationDetails?.especialidad || 'General'}`, cantidad: 1, precioUnitario: req.body.consultationDetails?.honorario || 50, aplicaIva15: false }],
    formaPago: req.body.paymentMethod
  };
  return app._router.handle(Object.assign(req, { url: '/api/v1/invoices/emit' }), res);
});

// Modulo Retail/POS (re-route al endpoint universal)
app.post('/api/modules/retail/emit-invoice', authenticate, async (req, res) => {
  req.body = {
    tenantConfig: req.body.tenantConfig,
    comprador: { identificacion: req.body.customerData?.identificacion, nombre: req.body.customerData?.razonSocial, email: req.body.customerData?.email },
    items: req.body.cartItems,
    formaPago: req.body.paymentMethod
  };
  return app._router.handle(Object.assign(req, { url: '/api/v1/invoices/emit' }), res);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Puntito SaaS Facturacion SRI + NIIF + Auth JWT`);
  console.log(`Servidor local: http://localhost:${PORT}`);
  console.log(`Login:          POST http://localhost:${PORT}/api/auth/login`);
  console.log(`Catalogos SRI:  GET  http://localhost:${PORT}/api/catalogs`);
  console.log(`Emitir factura: POST http://localhost:${PORT}/api/v1/invoices/emit`);
  console.log(`=======================================================`);
});
