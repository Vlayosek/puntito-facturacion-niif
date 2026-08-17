# Regla Permanente de Desarrollo Full-Stack Puntito SaaS

Aplica para **todos** los requerimientos, correcciones y nuevas funcionalidades de este proyecto:

## 1. Desarrollo Full-Stack Completo (End-to-End)
- Cada nuevo endpoint o modificación en el backend (Node.js / Express / PostgreSQL) debe incluir **su correspondiente interfaz de usuario (UI HTML/CSS/JS)**.
- No dejar endpoints "huérfanos" sin su vista o control visual en el dashboard.

## 2. Cero Datos Hardcodeados / Fijos
- **Prohibido** usar RUCs, razones sociales, nombres de pacientes, precios o claves de prueba hardcodeadas en HTML, JS o backend.
- Todos los datos de emisor, usuario, comprobantes, catálogos e impuestos deben ser **100% dinámicos** y provenir de la base de datos PostgreSQL o de la sesión activa del usuario (JWT).
- Los formularios deben usar atributos `placeholder` neutros (ej. `Ej: 1712345678`), nunca atributos `value` fijos.

## 3. Auditoría de Archivos Afectados
- Antes de dar por terminada una tarea, auditar todos los archivos modificados o relacionados (`server.js`, `DatabaseService.js`, `app.js`, `index.html`, `ride-viewer.html`, etc.) para asegurar que no queden remanentes de datos estáticos antiguos.

## 4. Verificación de Extremo a Extremo (E2E)
- Ejecutar pruebas automáticas o scripts de verificación probando el flujo completo (DB → Backend → API → UI → Visor PDF/RIDE) antes de declarar el requerimiento como completado.
