import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { TaxEngine, SRI_REGIMES } from './src/core/tax/TaxEngine.js';
import { AutorizadorEcProvider } from './src/core/sri/AutorizadorEcProvider.js';
import { AccountingEngine } from './src/core/accounting/AccountingEngine.js';
import { MedicalClinicAdapter } from './src/adapters/MedicalClinicAdapter.js';
import { RetailStoreAdapter } from './src/adapters/RetailStoreAdapter.js';
import { DentistAppointmentAdapter } from './src/adapters/DentistAppointmentAdapter.js';
import { DEFAULT_CHART_OF_ACCOUNTS } from './src/core/accounting/defaultChartOfAccounts.js';
import { DatabaseService } from './src/core/db/DatabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint: Obtener Configuración Actual y API Key
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    apiKeyConfigured: Boolean(process.env.AUTORIZADOR_EC_API_KEY && !process.env.AUTORIZADOR_EC_API_KEY.startsWith('DEMO')),
    environment: process.env.AUTORIZADOR_EC_ENV || 'TEST',
    database: process.env.PGDATABASE || 'puntitodb'
  });
});

// API Endpoint: Guardar/Actualizar API Key en .env
app.post('/api/config/api-key', (req, res) => {
  try {
    const { apiKey, environment } = req.body;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key requerida' });
    }

    process.env.AUTORIZADOR_EC_API_KEY = apiKey.trim();
    if (environment) process.env.AUTORIZADOR_EC_ENV = environment;

    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');
    envContent = envContent.replace(/AUTORIZADOR_EC_API_KEY=.*/g, `AUTORIZADOR_EC_API_KEY=${apiKey.trim()}`);
    if (environment) {
      envContent = envContent.replace(/AUTORIZADOR_EC_ENV=.*/g, `AUTORIZADOR_EC_ENV=${environment}`);
    }
    fs.writeFileSync(envPath, envContent, 'utf-8');

    res.json({ success: true, message: 'API Key guardada exitosamente en .env y cargada en memoria.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoint: Obtener Plan de Cuentas NIIF
app.get('/api/accounting/chart-of-accounts', (req, res) => {
  res.json({ success: true, data: DEFAULT_CHART_OF_ACCOUNTS });
});

// API Endpoint: Obtener Libro Diario Registrado en PostgreSQL
app.get('/api/accounting/ledger', async (req, res) => {
  try {
    const entries = await DatabaseService.getJournalEntries(1);
    res.json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoint: Obtener Lista de Facturas Guardadas en PostgreSQL
app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await DatabaseService.getInvoices(1);
    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoint: Obtener Factura Específica por Clave de Acceso (para RIDE PDF)
app.get('/api/invoices/:claveAcceso', async (req, res) => {
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
// ENDPOINT UNIVERSAL DE FACTURACIÓN SRI + NIIF PARA CUALQUIER SISTEMA EXTERNO
// (Turnos Dentales, Veterinarias, POS, E-commerce, Laravel, React, Mobile)
// ==============================================================================
app.post('/api/v1/invoices/emit', async (req, res) => {
  try {
    const { tenantConfig, comprador, items, formaPago, apiKey } = req.body;
    const activeApiKey = apiKey || process.env.AUTORIZADOR_EC_API_KEY || 'DEMO_KEY_SANDBOX';

    const emisorTenant = tenantConfig || {
      ruc: '1792123456001',
      razonSocial: 'EMPRESA / PROFESIONAL MULTISERVICIOS S.A.',
      nombreComercial: 'Servicios Integrales',
      direccionMatriz: 'Quito, Ecuador',
      regimenSRI: SRI_REGIMES.REGIMEN_GENERAL,
      obligadoContabilidad: true,
      establecimiento: '001',
      puntoEmision: '001'
    };

    const tenantIds = await DatabaseService.getOrCreateTenant(emisorTenant);

    const tipoId = TaxEngine.getSRITypeIdentification(comprador?.identificacion);
    const customerId = await DatabaseService.getOrCreateCustomer(tenantIds.idCliente, {
      tipoIdentificacionSRI: tipoId.code,
      identificacion: comprador?.identificacion || '9999999999999',
      razonSocial: comprador?.nombre || comprador?.razonSocial || 'CONSUMIDOR FINAL',
      email: comprador?.email || 'cliente@ejemplo.ec'
    });

    const secuencialStr = await DatabaseService.getNextSequential(tenantIds.idCliente, tenantIds.idEstablecimiento, '01');
    const invoiceNumber = `${emisorTenant.establecimiento}-${emisorTenant.puntoEmision}-${secuencialStr}`;

    const totals = TaxEngine.calculateTotals(items, emisorTenant.regimenSRI);

    const sriProvider = new AutorizadorEcProvider(activeApiKey, process.env.AUTORIZADOR_EC_ENV || 'TEST');
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
      journalEntry
    });

    res.json({
      success: true,
      idDocumento,
      invoiceNumber,
      claveAcceso: sriResponse.data?.claveAcceso,
      rideUrl: `/ride-viewer.html?clave=${sriResponse.data?.claveAcceso}`,
      journalEntry
    });
  } catch (error) {
    console.error('Error en Endpoint Universal de Facturación:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoints legacy para los módulos de simulación
app.post('/api/modules/medical/emit-invoice', async (req, res) => {
  req.url = '/api/v1/invoices/emit';
  req.body = {
    tenantConfig: req.body.tenantConfig,
    comprador: { identificacion: req.body.patient?.identificacion, nombre: req.body.patient?.nombreCompleto, email: req.body.patient?.email },
    items: [{ codigo: 'MED-001', descripcion: `Consulta Médica: ${req.body.consultationDetails?.especialidad || 'General'}`, cantidad: 1, precioUnitario: req.body.consultationDetails?.honorario || 50, aplicaIva15: false }],
    formaPago: req.body.paymentMethod,
    apiKey: req.body.apiKey
  };
  return app._router.handle(req, res);
});

app.post('/api/modules/retail/emit-invoice', async (req, res) => {
  req.url = '/api/v1/invoices/emit';
  req.body = {
    tenantConfig: req.body.tenantConfig,
    comprador: { identificacion: req.body.customerData?.identificacion, nombre: req.body.customerData?.razonSocial, email: req.body.customerData?.email },
    items: req.body.cartItems,
    formaPago: req.body.paymentMethod,
    apiKey: req.body.apiKey
  };
  return app._router.handle(req, res);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Puntito SaaS Facturacion SRI + PostgreSQL Activo`);
  console.log(`Servidor local: http://localhost:${PORT}`);
  console.log(`Endpoint Universal: POST http://localhost:${PORT}/api/v1/invoices/emit`);
  console.log(`=======================================================`);
});
