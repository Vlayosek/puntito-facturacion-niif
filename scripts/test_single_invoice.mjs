const BASE = 'http://localhost:3000';

async function test() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'admin', password: 'Admin2026!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const invRes = await fetch(`${BASE}/api/invoices/7180620201099287654300110010010000000021234567817`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await invRes.json();
  console.log('Factura por clave:', {
    secuencial: data.invoice?.secuencial,
    emisor: data.invoice?.emisor_razon,
    ruc: data.invoice?.emisor_ruc,
    comprador: data.invoice?.comprador_nombre,
    total: data.invoice?.importe_total
  });
}

test().catch(console.error);
