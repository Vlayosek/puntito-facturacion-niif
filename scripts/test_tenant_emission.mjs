const BASE = 'http://localhost:3000';

async function test() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'admin', password: 'Admin2026!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const medRes = await fetch(`${BASE}/api/modules/medical/emit-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tenantConfig: { regimenSRI: 'REGIMEN_GENERAL' },
      patient: { identificacion: '1712345678', nombreCompleto: 'Dra. María Elena Torres' },
      consultationDetails: { especialidad: 'Pediatría', honorario: 50 },
      paymentMethod: '01'
    })
  });
  const medData = await medRes.json();
  console.log('Factura ID en DB:', medData.idDocumento);
  
  // Consultar la factura guardada en DB por clave o id
  const invRes = await fetch(`${BASE}/api/invoices`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const invList = await invRes.json();
  console.log('Ultima factura en DB:', invList.data[0]);
}

test().catch(console.error);
