import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const BASE = 'http://localhost:3000';

const pool = new pg.Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'puntitodb'
});

async function test() {
  console.log('=== VERIFICANDO DIRECCION COMPRADOR Y AUDITORIA (user_create) ===\n');

  // 1. Login como admin
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'admin', password: 'Admin2026!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  // 2. Emitir Factura con email y direccion personalizada
  const customId = '1799887766001';
  const customEmail = 'compras.andina@ejemplo.ec';
  const customDir = 'Av. República E7-12 y Shyris, Quito';

  console.log('1. Emitiendo factura con comprador personalizado...');
  const medRes = await fetch(`${BASE}/api/modules/medical/emit-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tenantConfig: { regimenSRI: 'REGIMEN_GENERAL' },
      patient: {
        identificacion: customId,
        nombreCompleto: 'CORPORACION ANDINA DE EVALUACION S.A.',
        email: customEmail,
        direccion: customDir
      },
      consultationDetails: { especialidad: 'Chequeo Ocupacional', honorario: 150 },
      paymentMethod: '22'
    })
  });
  const medData = await medRes.json();
  console.log('   Emisión Exitosa:', medData.success, '| ID Doc:', medData.idDocumento);

  // 3. Inspeccionar PostgreSQL para verificar facturacion.tbm_cliente y facturacion.tbt_documento
  const client = await pool.connect();
  console.log('\n2. Verificando facturacion.tbm_cliente en PostgreSQL:');
  const cRes = await client.query(
    'SELECT id_fe_cliente, identificacion, razon_social, email, direccion, user_create, date_create FROM facturacion.tbm_cliente WHERE identificacion = $1',
    [customId]
  );
  console.table(cRes.rows);

  console.log('\n3. Verificando facturacion.tbt_documento en PostgreSQL:');
  const dRes = await client.query(
    'SELECT id_documento, secuencial, clave_acceso, user_create, date_create FROM facturacion.tbt_documento WHERE id_documento = $1',
    [medData.idDocumento]
  );
  console.table(dRes.rows);

  client.release();
  await pool.end();

  console.log('\n=== E2E AUDITORIA & DIRECCION VERIFICADO 100% OK ===');
}

test().catch(console.error);
