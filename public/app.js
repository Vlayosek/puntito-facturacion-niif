/**
 * Frontend principal del Dashboard Puntito SaaS SRI + NIIF + Auth JWT
 */

// ============================================================================
// AUTH — verificar token al cargar
// ============================================================================
const TOKEN = localStorage.getItem('puntito_token');
const USER  = JSON.parse(localStorage.getItem('puntito_user') || 'null');

if (!TOKEN) {
  window.location.href = '/login.html';
}

/** Helper: fetch autenticado con JWT en todos los requests */
async function authFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const res = await fetch(url, { ...options, headers });

  // Token expirado o invalido -> redirigir al login
  if (res.status === 401) {
    localStorage.removeItem('puntito_token');
    localStorage.removeItem('puntito_user');
    window.location.href = '/login.html';
    return null;
  }
  return res;
}

let lastOperationResult = null;

// ============================================================================
// INICIALIZACION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN) return; // ya redirigido

  renderUserInfo();
  initTabs();
  initModuleSwitch();
  initForms();
  initApiKeyConfig();
  loadConfigStatus();
  loadChartOfAccounts();
  loadCatalogs();
});

function renderUserInfo() {
  if (!USER) return;
  // Mostrar nombre e empresa del usuario autenticado en el header
  const badge = document.getElementById('dbStatusBadge');
  if (badge) {
    badge.innerText = `${USER.empresaNombre || 'Empresa'} (${USER.usuario})`;
    badge.className = 'badge badge-api';
  }

  // Mostrar boton de logout si existe
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('puntito_token');
      localStorage.removeItem('puntito_user');
      window.location.href = '/login.html';
    });
  }
}

// ============================================================================
// CONFIGURACION DE API KEY — ahora guarda en tbc_configuracion por empresa
// ============================================================================
function initApiKeyConfig() {
  const btnSave = document.getElementById('btnSaveApiKey');
  const inputKey = document.getElementById('inputApiKey');
  const selAmbiente = document.getElementById('selectAmbiente');

  // Cargar estado actual de la configuracion
  loadApiKeyStatus();

  btnSave?.addEventListener('click', async () => {
    const apiKey = inputKey?.value.trim();
    if (!apiKey) {
      alert('Por favor ingresa una API Key valida de AutorizadorEC.');
      return;
    }

    const ambiente = selAmbiente?.value || '1';

    try {
      const res = await authFetch('/api/admin/configuracion', {
        method: 'POST',
        body: JSON.stringify({ apiKey, ambiente })
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        alert('API Key guardada en la base de datos para tu empresa.');
        loadApiKeyStatus();
        loadConfigStatus();
      } else {
        alert('Error guardando API Key: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexion: ' + err.message);
    }
  });
}

async function loadApiKeyStatus() {
  try {
    const res = await authFetch('/api/admin/configuracion');
    if (!res) return;
    const data = await res.json();

    const statusEl = document.getElementById('apiKeyStatus');
    if (statusEl) {
      if (data.configured) {
        statusEl.innerHTML = `<span style="color:#22c55e">&#10003; API Key configurada (Ambiente: ${data.env})</span>`;
      } else {
        statusEl.innerHTML = `<span style="color:#f59e0b">&#9888; Sin API Key &mdash; modo simulacion TEST</span>`;
      }
    }
  } catch (err) {
    console.error('Error cargando estado de API Key:', err);
  }
}

async function loadConfigStatus() {
  try {
    const res = await authFetch('/api/config');
    if (!res) return;
    const data = await res.json();
    const dbBadge = document.getElementById('dbStatusBadge');
    if (dbBadge && USER) {
      dbBadge.innerText = `${USER.empresaNombre || 'Empresa'} | ${data.database} (${data.environment})`;
    }
  } catch (err) {
    console.error('Error cargando estado:', err);
  }
}

// ============================================================================
// TABS
// ============================================================================
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

      if (targetTab === 'ledger') fetchLedger();
      else if (targetTab === 'db-invoices') fetchDbInvoices();
      else if (targetTab === 'mi-cuenta') initAccountTab();
    });
  });

  document.getElementById('btnRefreshInvoices')?.addEventListener('click', fetchDbInvoices);
}

// ============================================================================
// MODULOS MEDICO / RETAIL
// ============================================================================
function initModuleSwitch() {
  const btnMedical = document.getElementById('btnModMedical');
  const btnRetail  = document.getElementById('btnModRetail');
  const formMedical = document.getElementById('formMedical');
  const formRetail  = document.getElementById('formRetail');

  btnMedical?.addEventListener('click', () => {
    btnMedical.classList.add('active'); btnRetail.classList.remove('active');
    formMedical.classList.remove('hidden'); formRetail.classList.add('hidden');
  });

  btnRetail?.addEventListener('click', () => {
    btnRetail.classList.add('active'); btnMedical.classList.remove('active');
    formRetail.classList.remove('hidden'); formMedical.classList.add('hidden');
  });
}

function initForms() {
  document.getElementById('formMedical')?.addEventListener('submit', async (e) => {
    e.preventDefault(); await emitMedicalInvoice();
  });
  document.getElementById('formRetail')?.addEventListener('submit', async (e) => {
    e.preventDefault(); await emitRetailInvoice();
  });
  document.getElementById('btnViewSriJson')?.addEventListener('click', () => switchToTab('sri-inspector'));
  document.getElementById('btnViewJournalEntry')?.addEventListener('click', () => switchToTab('ledger'));
  document.getElementById('btnCopyJson')?.addEventListener('click', () => {
    const code = document.getElementById('jsonInspectorCode').innerText;
    navigator.clipboard.writeText(code);
    alert('JSON de AutorizadorEC copiado al portapapeles.');
  });
}

function switchToTab(tabName) {
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.click();
}

// ============================================================================
// EMISION MEDICA
// ============================================================================
async function emitMedicalInvoice() {
  const regimen      = document.getElementById('tenantRegimen').value;
  const patientName  = document.getElementById('medPatientName').value;
  const patientId    = document.getElementById('medPatientId').value;
  const specialty    = document.getElementById('medSpecialty').value;
  const fee          = parseFloat(document.getElementById('medFee').value) || 50;
  const paymentMethod = document.getElementById('medPaymentMethod').value;

  const payload = {
    tenantConfig: {
      ruc: '1792123456001',
      razonSocial: 'CONSULTORIO MEDICO DR. PEREZ C.LTDA.',
      nombreComercial: 'Centro Medico Especializado',
      direccionMatriz: 'Av. Amazonas N24-15 y Colon, Quito',
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
    consultationDetails: { especialidad: specialty, honorario: fee },
    paymentMethod
  };

  await sendInvoiceRequest('/api/modules/medical/emit-invoice', payload);
}

// ============================================================================
// EMISION RETAIL
// ============================================================================
async function emitRetailInvoice() {
  const regimen       = document.getElementById('tenantRegimen').value;
  const customerName  = document.getElementById('retailCustomerName').value;
  const customerId    = document.getElementById('retailCustomerId').value;
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
    customerData: { identificacion: customerId, razonSocial: customerName, email: 'compras@empresa.ec' },
    cartItems: [
      { sku: 'MON-24', nombre: 'Monitor LED 24"', cantidad: 2, precioUnitario: 120.00, aplicaIva15: true },
      { sku: 'CAB-HDMI', nombre: 'Cable HDMI Alta Velocidad', cantidad: 1, precioUnitario: 15.00, aplicaIva15: true }
    ],
    paymentMethod
  };

  await sendInvoiceRequest('/api/modules/retail/emit-invoice', payload);
}

// ============================================================================
// ENVIO DE PETICION DE EMISION (con JWT)
// ============================================================================
async function sendInvoiceRequest(url, payload) {
  const statusBadge = document.getElementById('statusBadge');
  statusBadge.className = 'status-pill status-sending';
  statusBadge.innerText = 'Comunicando con AutorizadorEC & PostgreSQL...';

  try {
    const res = await authFetch(url, { method: 'POST', body: JSON.stringify(payload) });
    if (!res) return;

    const data = await res.json();
    if (data.success) {
      lastOperationResult = data.result;
      renderResult(data.result, data.idDocumento);
    } else {
      // Mostrar error especifico si falta la API Key
      const msg = data.code === 'NO_API_KEY'
        ? 'Sin API Key configurada. Ve a la seccion de Configuracion (icono superior) y agrega tu API Key de AutorizadorEC.'
        : 'Error en la emision: ' + data.error;
      alert(msg);
      statusBadge.className = 'status-pill status-idle';
      statusBadge.innerText = 'Error en emision';
    }
  } catch (err) {
    alert('Error al conectar con el servidor: ' + err.message);
    statusBadge.className = 'status-pill status-idle';
    statusBadge.innerText = 'Error de conexion';
  }
}

// ============================================================================
// RENDERIZAR RESULTADO
// ============================================================================
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

// ============================================================================
// MI CUENTA — Perfil y Cambio de Contrasena
// ============================================================================
function initAccountTab() {
  // Cargar datos del perfil desde el token en localStorage
  if (USER) {
    document.getElementById('profileUsuario').innerText  = USER.usuario || '-';
    document.getElementById('profileNombre').innerText   = USER.nombre || '-';
    document.getElementById('profileEmail').innerText    = USER.email || '-';
    document.getElementById('profileEmpresa').innerText  = USER.empresaNombre || '-';
    document.getElementById('profileRuc').innerText      = USER.empresaRuc || '-';
  }

  // Boton logout desde la tab Mi Cuenta
  document.getElementById('btnLogoutAccount')?.addEventListener('click', () => {
    if (confirm('Cerrar sesion? Necesitaras ingresar tus credenciales nuevamente.')) {
      localStorage.removeItem('puntito_token');
      localStorage.removeItem('puntito_user');
      window.location.href = '/login.html';
    }
  });

  // Formulario de cambio de contrasena
  const form = document.getElementById('formChangePassword');
  if (form && !form.dataset.initialized) {
    form.dataset.initialized = 'true';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwdActual   = document.getElementById('pwdActual').value;
      const pwdNueva    = document.getElementById('pwdNueva').value;
      const pwdConfirmar = document.getElementById('pwdConfirmar').value;
      const msgEl       = document.getElementById('pwdMsg');
      const btn         = document.getElementById('btnCambiarPwd');

      // Validacion local
      if (pwdNueva !== pwdConfirmar) {
        showPwdMsg('Las contrasenas nuevas no coinciden.', 'error');
        return;
      }
      if (pwdNueva.length < 8) {
        showPwdMsg('La nueva contrasena debe tener al menos 8 caracteres.', 'error');
        return;
      }

      btn.disabled = true;
      btn.innerText = 'Actualizando...';

      try {
        const res = await authFetch('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ passwordActual: pwdActual, passwordNueva: pwdNueva })
        });
        if (!res) return;
        const data = await res.json();

        if (data.success) {
          showPwdMsg('Contrasena actualizada exitosamente. Vuelve a iniciar sesion con la nueva contrasena.', 'success');
          form.reset();
          // Redirigir al login despues de 2.5 segundos (token ya no valido con nueva pwd)
          setTimeout(() => {
            localStorage.removeItem('puntito_token');
            localStorage.removeItem('puntito_user');
            window.location.href = '/login.html';
          }, 2500);
        } else {
          showPwdMsg(data.error || 'Error al actualizar la contrasena.', 'error');
        }
      } catch (err) {
        showPwdMsg('Error de conexion: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'Actualizar Contrasena';
      }
    });
  }

  // Cargar lista de usuarios de la empresa
  fetchCompanyUsers();

  // Boton recargar usuarios
  const btnRefreshUsers = document.getElementById('btnRefreshUsers');
  if (btnRefreshUsers && !btnRefreshUsers.dataset.initialized) {
    btnRefreshUsers.dataset.initialized = 'true';
    btnRefreshUsers.addEventListener('click', fetchCompanyUsers);
  }

  // Formulario de registro de usuario
  const regForm = document.getElementById('formRegisterUser');
  if (regForm && !regForm.dataset.initialized) {
    regForm.dataset.initialized = 'true';
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usuario  = document.getElementById('regUsuario').value.trim();
      const nombre   = document.getElementById('regNombre').value.trim();
      const email    = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const btn      = document.getElementById('btnRegisterUser');

      btn.disabled = true;
      btn.innerText = 'Creando...';

      try {
        const res = await authFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ usuario, nombre, email, password })
        });
        if (!res) return;
        const data = await res.json();

        if (data.success) {
          showRegUserMsg('Usuario "' + usuario + '" creado exitosamente.', 'success');
          regForm.reset();
          fetchCompanyUsers();
        } else {
          showRegUserMsg(data.error || 'Error al registrar usuario.', 'error');
        }
      } catch (err) {
        showRegUserMsg('Error de conexion: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'Crear Usuario';
      }
    });
  }
}

async function fetchCompanyUsers() {
  const tbody = document.getElementById('companyUsersTable');
  if (!tbody) return;

  try {
    const res = await authFetch('/api/auth/users');
    if (!res) return;
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted">No hay otros usuarios registrados en tu empresa.</td></tr>';
      return;
    }

    let html = '';
    data.data.forEach(u => {
      const estadoTag = u.estado
        ? '<span class="tag tag-success">Activo</span>'
        : '<span class="tag" style="background:#6b7280">Inactivo</span>';

      html += `
        <tr>
          <td><code>${u.usuario}</code></td>
          <td><strong>${u.nombre}</strong></td>
          <td><small class="text-muted">${u.email || '-'}</small></td>
          <td>${estadoTag}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:red">Error al cargar usuarios: ${err.message}</td></tr>`;
  }
}

function showRegUserMsg(text, type) {
  const el = document.getElementById('regUserMsg');
  if (!el) return;
  el.style.display = 'block';
  el.innerText = text;
  if (type === 'success') {
    el.style.background = 'rgba(34,197,94,0.12)';
    el.style.border = '1px solid rgba(34,197,94,0.4)';
    el.style.color = '#86efac';
  } else {
    el.style.background = 'rgba(239,68,68,0.12)';
    el.style.border = '1px solid rgba(239,68,68,0.35)';
    el.style.color = '#fca5a5';
  }
}

// ============================================================================
// CARGA DINAMICA DE CATALOGOS SRI DESDE LA BD (/api/catalogs)
// ============================================================================
async function loadCatalogs() {
  try {
    const res = await fetch('/api/catalogs');
    const data = await res.json();
    if (!data.success || !data.data) return;

    const { formasPago } = data.data;

    if (formasPago && formasPago.length > 0) {
      const medSelect = document.getElementById('medPaymentMethod');
      const retSelect = document.getElementById('retailPaymentMethod');

      let optionsHtml = '';
      formasPago.forEach(fp => {
        optionsHtml += `<option value="${fp.codigo}">${fp.codigo} - ${fp.descripcion}</option>`;
      });

      if (medSelect) medSelect.innerHTML = optionsHtml;
      if (retSelect) retSelect.innerHTML = optionsHtml;
    }
  } catch (err) {
    console.warn('No se pudieron cargar catalogos dinamicos, usando defaults HTML:', err);
  }
}

function showPwdMsg(text, type) {
  const el = document.getElementById('pwdMsg');
  if (!el) return;
  el.style.display = 'block';
  el.innerText = text;
  if (type === 'success') {
    el.style.background = 'rgba(34,197,94,0.12)';
    el.style.border = '1px solid rgba(34,197,94,0.4)';
    el.style.color = '#86efac';
  } else {
    el.style.background = 'rgba(239,68,68,0.12)';
    el.style.border = '1px solid rgba(239,68,68,0.35)';
    el.style.color = '#fca5a5';
  }
}

// ============================================================================
// HISTORIAL DE FACTURAS (JWT)
// ============================================================================
async function fetchDbInvoices() {
  const tbody = document.getElementById('dbInvoicesTable');
  if (!tbody) return;
  try {
    const res = await authFetch('/api/invoices');
    if (!res) return;
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-muted">No hay facturas registradas en PostgreSQL. Emite una desde la primera pestana.</td></tr>`;
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

// ============================================================================
// LIBRO DIARIO (JWT)
// ============================================================================
async function fetchLedger() {
  const container = document.getElementById('ledgerContainer');
  try {
    const res = await authFetch('/api/accounting/ledger');
    if (!res) return;
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      container.innerHTML = `<p class="text-muted">No hay asientos contables registrados aun. Realiza emisiones en el Simulador.</p>`;
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
            <thead><tr><th>Codigo Cuenta</th><th>Nombre de Cuenta</th><th style="text-align:right">Debe ($)</th><th style="text-align:right">Haber ($)</th></tr></thead>
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
                <td class="num" style="color:var(--accent-blue)">$${entry.totalDebit.toFixed(2)}</td>
                <td class="num" style="color:var(--accent-blue)">$${entry.totalCredit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p style="color:red">Error al cargar Libro Diario: ${err.message}</p>`;
  }
}

// ============================================================================
// PLAN DE CUENTAS (publico)
// ============================================================================
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
