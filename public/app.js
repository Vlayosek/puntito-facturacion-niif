/**
 * Lógica Frontend del Dashboard Interactivo Puntito SaaS SRI + NIIF + PostgreSQL
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initModuleSwitch();
  initForms();
  initApiKeyConfig();
  loadChartOfAccounts();
  loadConfigStatus();
});

let lastOperationResult = null;

function initApiKeyConfig() {
  const btnSave = document.getElementById('btnSaveApiKey');
  const inputKey = document.getElementById('inputApiKey');

  btnSave?.addEventListener('click', async () => {
    const apiKey = inputKey.value.trim();
    if (!apiKey) {
      alert('Por favor ingresa una API Key válida de AutorizadorEC.');
      return;
    }

    try {
      const res = await fetch('/api/config/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      if (data.success) {
        alert('API Key de AutorizadorEC guardada exitosamente en .env');
        loadConfigStatus();
      } else {
        alert('Error guardando API Key: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión: ' + err.message);
    }
  });
}

async function loadConfigStatus() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    const dbBadge = document.getElementById('dbStatusBadge');
    if (dbBadge) {
      dbBadge.innerText = `PostgreSQL: ${data.database} (${data.apiKeyConfigured ? 'API Key Real' : 'API Key Demo'})`;
      dbBadge.className = data.apiKeyConfigured ? 'badge badge-api' : 'badge badge-sri';
    }
  } catch (err) {
    console.error('Error cargando estado:', err);
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const contentEl = document.getElementById(`tab-${targetTab}`);
      if (contentEl) contentEl.classList.add('active');

      if (targetTab === 'ledger') {
        fetchLedger();
      } else if (targetTab === 'db-invoices') {
        fetchDbInvoices();
      }
    });
  });

  document.getElementById('btnRefreshInvoices')?.addEventListener('click', fetchDbInvoices);
}

function initModuleSwitch() {
  const btnMedical = document.getElementById('btnModMedical');
  const btnRetail = document.getElementById('btnModRetail');
  const formMedical = document.getElementById('formMedical');
  const formRetail = document.getElementById('formRetail');

  btnMedical.addEventListener('click', () => {
    btnMedical.classList.add('active');
    btnRetail.classList.remove('active');
    formMedical.classList.remove('hidden');
    formRetail.classList.add('hidden');
  });

  btnRetail.addEventListener('click', () => {
    btnRetail.classList.add('active');
    btnMedical.classList.remove('active');
    formRetail.classList.remove('hidden');
    formMedical.classList.add('hidden');
  });
}

function initForms() {
  const formMedical = document.getElementById('formMedical');
  const formRetail = document.getElementById('formRetail');

  formMedical.addEventListener('submit', async (e) => {
    e.preventDefault();
    await emitMedicalInvoice();
  });

  formRetail.addEventListener('submit', async (e) => {
    e.preventDefault();
    await emitRetailInvoice();
  });

  document.getElementById('btnViewSriJson')?.addEventListener('click', () => {
    switchToTab('sri-inspector');
  });

  document.getElementById('btnViewJournalEntry')?.addEventListener('click', () => {
    switchToTab('ledger');
  });

  document.getElementById('btnCopyJson')?.addEventListener('click', () => {
    const code = document.getElementById('jsonInspectorCode').innerText;
    navigator.clipboard.writeText(code);
    alert('JSON de AutorizadorEC copiado al portapapeles.');
  });
}

function switchToTab(tabName) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.click();
}

async function emitMedicalInvoice() {
  const regimen = document.getElementById('tenantRegimen').value;
  const patientName = document.getElementById('medPatientName').value;
  const patientId = document.getElementById('medPatientId').value;
  const specialty = document.getElementById('medSpecialty').value;
  const fee = parseFloat(document.getElementById('medFee').value) || 50;
  const paymentMethod = document.getElementById('medPaymentMethod').value;
  const apiKey = document.getElementById('inputApiKey')?.value.trim();

  const payload = {
    apiKey,
    tenantConfig: {
      ruc: '1792123456001',
      razonSocial: 'CONSULTORIO MEDICO DR. PEREZ C.LTDA.',
      nombreComercial: 'Centro Médico Especializado',
      direccionMatriz: 'Av. Amazonas N24-15 y Colón, Quito',
      regimenSRI: regimen,
      obligadoContabilidad: true,
      establecimiento: '001',
      puntoEmision: '002'
    },
    patient: {
      identificacion: patientId,
      nombreCompleto: patientName,
      email: 'paciente@ejemplo.ec'
    },
    consultationDetails: {
      especialidad: specialty,
      honorario: fee
    },
    paymentMethod
  };

  await sendInvoiceRequest('/api/modules/medical/emit-invoice', payload);
}

async function emitRetailInvoice() {
  const regimen = document.getElementById('tenantRegimen').value;
  const customerName = document.getElementById('retailCustomerName').value;
  const customerId = document.getElementById('retailCustomerId').value;
  const paymentMethod = document.getElementById('retailPaymentMethod').value;
  const apiKey = document.getElementById('inputApiKey')?.value.trim();

  const payload = {
    apiKey,
    tenantConfig: {
      ruc: '0992876543001',
      razonSocial: 'COMERCIAL EL SOL S.A.S.',
      nombreComercial: 'Minimarket El Sol',
      direccionMatriz: 'Av. 9 de Octubre 412, Guayaquil',
      regimenSRI: regimen,
      obligadoContabilidad: false,
      establecimiento: '001',
      puntoEmision: '001'
    },
    customerData: {
      identificacion: customerId,
      razonSocial: customerName,
      email: 'compras@empresa.ec'
    },
    cartItems: [
      { sku: 'MON-24', nombre: 'Monitor LED 24"', cantidad: 2, precioUnitario: 120.00, aplicaIva15: true },
      { sku: 'CAB-HDMI', nombre: 'Cable HDMI Alta Velocidad', cantidad: 1, precioUnitario: 15.00, aplicaIva15: true }
    ],
    paymentMethod
  };

  await sendInvoiceRequest('/api/modules/retail/emit-invoice', payload);
}

async function sendInvoiceRequest(url, payload) {
  const statusBadge = document.getElementById('statusBadge');
  statusBadge.className = 'status-pill status-sending';
  statusBadge.innerText = 'Comunicando con AutorizadorEC & PostgreSQL...';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      lastOperationResult = data.result;
      renderResult(data.result, data.idDocumento);
    } else {
      alert('Error en la emisión: ' + data.error);
      statusBadge.className = 'status-pill status-idle';
      statusBadge.innerText = 'Error en emisión';
    }
  } catch (err) {
    alert('Error al conectar con el servidor: ' + err.message);
    statusBadge.className = 'status-pill status-idle';
    statusBadge.innerText = 'Error de conexión';
  }
}

function renderResult(result, idDocumento) {
  const statusBadge = document.getElementById('statusBadge');
  statusBadge.className = 'status-pill status-success';
  statusBadge.innerText = 'Factura SRI Autorizada & Guardada en DB';

  document.getElementById('outputContainer').classList.add('hidden');
  document.getElementById('outputResult').classList.remove('hidden');

  document.getElementById('resInvoiceNum').innerText = result.invoiceNumber;
  document.getElementById('resAccessKey').innerText = result.sriResponse.data?.claveAcceso || 'AUTORIZADO';
  document.getElementById('resTotal').innerText = `$${result.totals.importeTotal.toFixed(2)}`;
  document.getElementById('resDbDocId').innerText = idDocumento ? `ID #${idDocumento}` : 'Guardado en PostgreSQL';

  const jsonInspector = document.getElementById('jsonInspectorCode');
  if (jsonInspector) {
    jsonInspector.innerText = JSON.stringify(result.sriResponse.data?.payloadEnviado || result.sriResponse, null, 2);
  }
}

async function fetchDbInvoices() {
  const tbody = document.getElementById('dbInvoicesTable');
  if (!tbody) return;

  try {
    const res = await fetch('/api/invoices');
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-muted">No hay facturas registradas en PostgreSQL aún. Emite una desde la primera pestaña.</td></tr>`;
      return;
    }

    let html = '';
    data.data.forEach(inv => {
      const fecha = new Date(inv.fecha_emision).toLocaleDateString('es-EC');
      const localRideUrl = `/ride-viewer.html?clave=${inv.clave_acceso}`;

      html += `
        <tr>
          <td><code>${inv.secuencial}</code></td>
          <td><strong>${inv.comprador_nombre || 'CONSUMIDOR FINAL'}</strong><br><small class="text-muted">${inv.comprador_id || ''}</small></td>
          <td>${fecha}</td>
          <td><strong>$${Number(inv.importe_total).toFixed(2)}</strong></td>
          <td><span class="tag tag-success">${inv.estado}</span></td>
          <td><code class="code-sm">${inv.clave_acceso}</code></td>
          <td><a href="${localRideUrl}" target="_blank" class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;">Ver RIDE PDF</a></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: red">Error cargando facturas: ${err.message}</td></tr>`;
  }
}

async function fetchLedger() {
  const container = document.getElementById('ledgerContainer');
  try {
    const res = await fetch('/api/accounting/ledger');
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      container.innerHTML = `<p class="text-muted">No hay asientos contables registrados en PostgreSQL aún. Realiza emisiones en el Simulador.</p>`;
      return;
    }

    let html = '';
    data.data.forEach(entry => {
      html += `
        <div class="journal-card">
          <div class="journal-header">
            <div>
              <strong>Asiento Ref: ${entry.entryId}</strong> (Factura ${entry.invoiceRef})
              <div class="text-muted" style="font-size: 0.8rem">${entry.concept} - Fecha: ${entry.date}</div>
            </div>
            <span class="tag tag-success">Partida Doble Ok (Debe = Haber)</span>
          </div>
          <table class="journal-table">
            <thead>
              <tr>
                <th>Código Cuenta</th>
                <th>Nombre de Cuenta</th>
                <th style="text-align: right">Debe ($)</th>
                <th style="text-align: right">Haber ($)</th>
              </tr>
            </thead>
            <tbody>
              ${entry.lines.map(line => `
                <tr>
                  <td><code>${line.accountCode}</code></td>
                  <td>${line.accountName}</td>
                  <td class="num">${line.debit > 0 ? '$' + line.debit.toFixed(2) : '-'}</td>
                  <td class="num">${line.credit > 0 ? '$' + line.credit.toFixed(2) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="journal-footer">
                <td colspan="2">TOTALES:</td>
                <td class="num" style="color: var(--accent-blue)">$${entry.totalDebit.toFixed(2)}</td>
                <td class="num" style="color: var(--accent-blue)">$${entry.totalCredit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p style="color: red">Error al cargar Libro Diario: ${err.message}</p>`;
  }
}

async function loadChartOfAccounts() {
  const tbody = document.getElementById('chartOfAccountsTable');
  if (!tbody) return;

  try {
    const res = await fetch('/api/accounting/chart-of-accounts');
    const data = await res.json();

    let html = '';
    data.data.forEach(acc => {
      const indent = '&nbsp;&nbsp;'.repeat(acc.level - 1);
      html += `
        <tr>
          <td><code>${acc.code}</code></td>
          <td>${indent}${acc.level === 1 ? '<strong>' + acc.name + '</strong>' : acc.name}</td>
          <td><span class="badge">${acc.type}</span></td>
          <td>Nivel ${acc.level}</td>
          <td>${acc.isSelectable ? 'Imputable' : 'Agrupadora'}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error al cargar plan de cuentas:', err);
  }
}
