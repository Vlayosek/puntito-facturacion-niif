import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { SRI_REGIMES } from './src/core/tax/TaxEngine.js';
import { MedicalClinicAdapter } from './src/adapters/MedicalClinicAdapter.js';
import { RetailStoreAdapter } from './src/adapters/RetailStoreAdapter.js';
import { DEFAULT_CHART_OF_ACCOUNTS } from './src/core/accounting/defaultChartOfAccounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Estado en memoria para demostración interactiva
let mockLedger = [];

// API Endpoint: Obtener Plan de Cuentas NIIF
app.get('/api/accounting/chart-of-accounts', (req, res) => {
  res.json({ success: true, data: DEFAULT_CHART_OF_ACCOUNTS });
});

// API Endpoint: Obtener Libro Diario Registrado
app.get('/api/accounting/ledger', (req, res) => {
  res.json({ success: true, count: mockLedger.length, data: mockLedger });
});

// API Endpoint: Emitir Factura desde Módulo Médico
app.post('/api/modules/medical/emit-invoice', async (req, res) => {
  try {
    const { tenantConfig, patient, consultationDetails, paymentMethod } = req.body;

    const defaultTenant = tenantConfig || {
      ruc: '1792123456001',
      razonSocial: 'CONSULTORIO MEDICO DR. PEREZ C.LTDA.',
      nombreComercial: 'Centro Médico Especializado',
      direccionMatriz: 'Av. Amazonas N24-15 y Colón, Quito',
      regimenSRI: SRI_REGIMES.REGIMEN_GENERAL,
      obligadoContabilidad: true,
      establecimiento: '001',
      puntoEmision: '002'
    };

    const adapter = new MedicalClinicAdapter(defaultTenant);
    const result = await adapter.processPatientConsultation({
      patient: patient || {
        identificacion: '1723456789',
        nombreCompleto: 'Juan Carlos López',
        email: 'juan.lopez@ejemplo.ec',
        direccion: 'Quito - Sector La Carolina'
      },
      consultationDetails: consultationDetails || {
        especialidad: 'Cardiología',
        diagnosticoCie10: 'I10 - Hipertensión esencial',
        honorario: 60.00,
        descuento: 0
      },
      paymentMethod: paymentMethod || 'EFECTIVO'
    });

    // Guardar en el Libro Diario en memoria
    mockLedger.push(result.journalEntry);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoint: Emitir Factura desde Módulo POS / Tienda
app.post('/api/modules/retail/emit-invoice', async (req, res) => {
  try {
    const { tenantConfig, customerData, cartItems, paymentMethod } = req.body;

    const defaultTenant = tenantConfig || {
      ruc: '0992876543001',
      razonSocial: 'COMERCIAL EL SOL S.A.S.',
      nombreComercial: 'Minimarket El Sol',
      direccionMatriz: 'Av. 9 de Octubre 412, Guayaquil',
      regimenSRI: SRI_REGIMES.RIMPE_EMPRENDEDOR,
      obligadoContabilidad: false,
      establecimiento: '001',
      puntoEmision: '001'
    };

    const adapter = new RetailStoreAdapter(defaultTenant);
    const result = await adapter.processPosSale({
      customerData: customerData || {
        identificacion: '0987654321001',
        razonSocial: 'CORPORACION MULTISERVICIOS CIA. LTDA.',
        email: 'compras@multiservicios.ec'
      },
      cartItems: cartItems || [
        { sku: 'ART-101', nombre: 'Silla Ergonómica Oficina', cantidad: 2, precioUnitario: 45.00, aplicaIva15: true },
        { sku: 'ART-202', nombre: 'Servicio de Instalación Básica', cantidad: 1, precioUnitario: 20.00, aplicaIva15: true }
      ],
      paymentMethod: paymentMethod || 'TRANSFERENCIA'
    });

    mockLedger.push(result.journalEntry);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SaaS Facturación SRI + Contabilidad NIIF Ejecutándose!`);
  console.log(`🌐 Servidor local: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
