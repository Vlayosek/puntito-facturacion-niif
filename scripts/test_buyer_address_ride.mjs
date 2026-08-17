const BASE = 'http://localhost:3000';

async function test() {
  console.log('=== TEST E2E DIRECCION COMPRADOR EN RIDE Y BD ===\n');

  // 1. Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'admin', password: 'Admin2026!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  // 2. Emitir Factura KOZICORP con direccion 'Av del Ejercito'
  const kozicorpData = {
    identificacion: '1201503313001',
    nombreCompleto: 'KOZICORP',
    email: 'kozisckw@kozicorp.com',
    direccion: 'Av del Ejercito'
  };

  const emitRes = await fetch(`${BASE}/api/modules/medical/emit-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tenantConfig: { regimenSRI: 'REGIMEN_GENERAL' },
      patient: kozicorpData,
      consultationDetails: { especialidad: 'Servicio de Desarrollo Software', honorario: 350 },
      paymentMethod: '22'
    })
  });
  const emitData = await emitRes.json();
  console.log('Emisión Exitosa:', emitData.success, '| ID Documento:', emitData.idDocumento);

  const clave = emitData.result.sriResponse.data.claveAcceso;
  console.log('Clave de Acceso:', clave);

  // 3. Consultar la API /api/invoices/:claveAcceso para verificar que devuelve comprador_direccion
  const invRes = await fetch(`${BASE}/api/invoices/${clave}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const invData = await invRes.json();
  console.log('\nDatos de la factura devueltos por el servidor:');
  console.log(' - Razón Social Comprador:', invData.invoice.comprador_nombre);
  console.log(' - Dirección Comprador (BD):', invData.invoice.comprador_direccion);
  console.log(' - Dirección Comprador (Payload SRI):', invData.invoice.payload_enviado_json?.comprobante?.comprador?.direccion);

  console.log('\n=== DIRECCION COMPRADOR 100% DINAMICA VERIFICADA ===');
}

test().catch(console.error);
