// Test: login + guardar API Key + emitir factura
const BASE = 'http://localhost:3000';

async function test() {
  console.log('=== TEST AUTH JWT + MULTI-TENANT ===\n');

  // 1. Login
  console.log('1. Probando login...');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'admin', password: 'Admin2026!' })
  });
  const loginData = await loginRes.json();
  console.log('   Status:', loginRes.status);
  console.log('   Success:', loginData.success);
  if (!loginData.success) {
    console.error('   Error:', loginData.error);
    return;
  }
  const token = loginData.token;
  console.log('   Token JWT generado:', token.substring(0, 30) + '...');
  console.log('   Usuario:', loginData.user.usuario);
  console.log('   Empresa:', loginData.user.empresaNombre);

  // 2. /api/auth/me
  console.log('\n2. Probando /api/auth/me...');
  const meRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meData = await meRes.json();
  console.log('   Success:', meData.success);
  console.log('   idCliente:', meData.user?.idCliente);

  // 3. Catalogos SRI
  console.log('\n3. Probando /api/catalogs (publico)...');
  const catRes = await fetch(`${BASE}/api/catalogs`);
  const catData = await catRes.json();
  console.log('   Tarifas IVA:', catData.data?.tarifasIva?.length);
  console.log('   Formas de pago:', catData.data?.formasPago?.length);
  console.log('   Tipos identificacion:', catData.data?.tiposIdentificacion?.length);

  // 4. Guardar API Key en tbc_configuracion
  console.log('\n4. Guardando API Key en tbc_configuracion...');
  const apiKeyToSave = process.env.AUTORIZADOR_EC_API_KEY || 'DEMO_KEY_TEST';
  const configRes = await fetch(`${BASE}/api/admin/configuracion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ apiKey: apiKeyToSave, ambiente: '1' })
  });
  const configData = await configRes.json();
  console.log('   Success:', configData.success);
  console.log('   Mensaje:', configData.message || configData.error);

  // 5. Verificar configuracion guardada
  console.log('\n5. Verificando configuracion guardada...');
  const getConfigRes = await fetch(`${BASE}/api/admin/configuracion`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const getConfigData = await getConfigRes.json();
  console.log('   Configurada:', getConfigData.configured);
  console.log('   Ambiente:', getConfigData.env);

  // 6. Emitir factura medica (con JWT)
  console.log('\n6. Probando emision de factura medica...');
  const emitRes = await fetch(`${BASE}/api/modules/medical/emit-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tenantConfig: { ruc: '1792123456001', razonSocial: 'CONSULTORIO TEST', nombreComercial: 'Test', direccionMatriz: 'Quito', regimenSRI: 'REGIMEN_GENERAL', obligadoContabilidad: true, establecimiento: '001', puntoEmision: '002' },
      patient: { identificacion: '1712345678', nombreCompleto: 'Paciente Test', email: 'test@test.ec' },
      consultationDetails: { especialidad: 'Pediatria', honorario: 50 },
      paymentMethod: 'EFECTIVO'
    })
  });
  const emitData = await emitRes.json();
  console.log('   Status:', emitRes.status);
  console.log('   Success:', emitData.success);
  if (emitData.success) {
    console.log('   Factura No:', emitData.result.invoiceNumber);
    console.log('   Total:', '$' + emitData.result.totals.importeTotal.toFixed(2));
    console.log('   ID Documento:', emitData.idDocumento);
  } else {
    console.log('   Error:', emitData.error);
  }

  // 7. Probar endpoint protegido sin token (debe fallar)
  console.log('\n7. Probando endpoint protegido sin token (debe dar 401)...');
  const noAuthRes = await fetch(`${BASE}/api/invoices`);
  const noAuthData = await noAuthRes.json();
  console.log('   Status:', noAuthRes.status, '(esperado: 401)');
  console.log('   Success:', noAuthData.success, '(esperado: false)');

  console.log('\n=== TESTS COMPLETADOS ===');
}

test().catch(console.error);
