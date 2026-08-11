/**
 * Lógica Frontend del Dashboard Interactivo SaaS Facturación SRI + NIIF
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initModuleSwitch();
  initForms();
  loadChartOfAccounts();
});

let lastOperationResult = null;

// Manejo de Pestañas (Tabs)
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
      }
    });
  });
}

// Selector de Módulo (Médico vs Retail POS)
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

// Inicializar Formularios
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
    alert('JSON de AutorizadorEC copiado al portapapeles!');
  });
}

function switchToTab(tabName) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.click();
}

// Emisión Módulo Médico
async function emitMedicalInvoice() {
  const regimen = document.getElementById('tenantRegimen').value;
  const patientName = document.getElementById('medPatientName').value;
  const patientId = document.getElementById('medPatientId').value;
  const specialty = document.getElementById('medSpecialty').value;
  const fee = parseFloat(document.getElementById('medFee').value) || 50;
  const paymentMethod = document.getElementById('medPaymentMethod').value;

  const payload = {
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

// Emisión Módulo Retail POS
async function emitRetailInvoice() {
  const regimen = document.getElementById('tenantRegimen').value;
  const customerName = document.getElementById('retailCustomerName').value;
  const customerId = document.getElementById('retailCustomerId').value;
  const paymentMethod = document.getElementById('retailPaymentMethod').value;

  const payload = {
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

// Envío a Servidor Backend
async function sendInvoiceRequest(url, payload) {
  const statusBadge = document.getElementById('statusBadge');
  statusBadge.className = 'status-pill status-sending';
  statusBadge.innerText = 'Comunicando con AutorizadorEC...';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      lastOperationResult = data.result;
      renderResult(data.result);
    } else {
      alert('Error en la emisión: ' + data.error);
    }
  } catch (err) {
    alert('Error al conectar con el servidor: ' + err.message);
  }
}

// Renderizar Resultado en Pantalla
function renderResult(result) {
  const statusBadge = document.getElementById('statusBadge');
  statusBadge.className = 'status-pill status-success';
  statusBadge.innerText = 'Factura SRI Autorizada';

  document.getElementById('outputContainer').classList.add('hidden');
  document.getElementById('outputResult').classList.remove('hidden');

  document.getElementById('resInvoiceNum').innerText = result.invoiceNumber;
  document.getElementById('resAccessKey').innerText = result.sriResponse.data.claveAcceso;
  document.getElementById('resTotal').innerText = `$${result.totals.importeTotal.toFixed(2)}`;

  // Actualizar Inspector JSON AutorizadorEC
  const jsonInspector = document.getElementById('jsonInspectorCode');
  if (jsonInspector) {
    jsonInspector.innerText = JSON.stringify(result.sriResponse.data.payloadEnviado, null, 2);
  }
}

// Obtener y renderizar el Libro Diario (NIIF)
async function fetchLedger() {
  const container = document.getElementById('ledgerContainer');
  try {
    const res = await fetch('/api/accounting/ledger');
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      container.innerHTML = `<p class="text-muted">No hay asientos contables registrados. Realiza emisiones en el Simulador.</p>`;
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
                <td class="num" style="color: var(--accent-cyan)">$${entry.totalDebit.toFixed(2)}</td>
                <td class="num" style="color: var(--accent-cyan)">$${entry.totalCredit.toFixed(2)}</td>
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

// Cargar Plan de Cuentas NIIF
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
          <td>${acc.isSelectable ? '✅ Imputable' : '📁 Agrupadora'}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Error al cargar plan de cuentas:', err);
  }
}
