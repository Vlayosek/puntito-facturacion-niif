# Puntito Core SaaS - Facturación SRI & Contabilidad NIIF

Plataforma SaaS Multi-tenant modular diseñada para el mercado ecuatoriano. Combina la gestión operativa del negocio (médicos, dentistas, tiendas POS, servicios profesionales) con la **Facturación Electrónica SRI** (vía middleware **AutorizadorEC**) y un motor automático de **Contabilidad NIIF para PYMES (Partida Doble)**.

---

## Características Principales

* **Arquitectura Desacoplada:** El núcleo tributario y contable se mantiene independiente de los módulos operativos de negocio.
* **Integración API AutorizadorEC:** Firma digital XAdES-BES, generación de XML, envío al SRI y recepción de RIDE (PDF) en tiempo real mediante API REST.
* **Cálculo Tributario SRI Automático:** Soporte para IVA 15% (vigente), IVA 0% (Salud/Educación), y leyendas legales obligatorias SRI (**RIMPE Popular**, **RIMPE Emprendedor**, **Régimen General**).
* **Partida Doble NIIF:** Generación automática de asientos contables (*Debe = Haber*) al autorizar comprobantes.
* **Base de Datos PostgreSQL (v15+):** Esquemas aislados `puntito` (Core SaaS), `facturacion` (Tributación) y `contabilidad` (NIIF), con soporte para campos `JSONB`.

---

## Estructura del Proyecto

```text
├── database/
│   └── init_postgres.sql         # Script SQL oficial para PostgreSQL (puntito, facturacion, contabilidad)
├── scripts/
│   ├── setup_postgres.js         # Script Node.js de instalación y migración de BD
│   ├── reset_db.js               # Script para limpiar datos transaccionales
│   └── update_ride_urls.js       # Script de mantenimiento de URLs RIDE
├── src/
│   ├── core/
│   │   ├── tax/TaxEngine.js               # Motor de cálculo tributario IVA 15%/0% y leyendas RIMPE
│   │   ├── sri/AutorizadorEcProvider.js   # Adaptador de integración API AutorizadorEC
│   │   ├── db/DatabaseService.js          # Servicio de persistencia PostgreSQL
│   │   └── accounting/
│   │       ├── AccountingEngine.js        # Generador de Asientos Contables Partida Doble
│   │       └── defaultChartOfAccounts.js  # Plan de Cuentas NIIF para PYMES Ecuador
│   └── adapters/
│       ├── MedicalClinicAdapter.js        # Adaptador para Consultorios Médicos (IVA 0%)
│       ├── DentistAppointmentAdapter.js  # Adaptador para Odontología y Citas Dentales (IVA 0%)
│       └── RetailStoreAdapter.js          # Adaptador para Tiendas POS (IVA 15%)
├── public/                       # Dashboard Web de Demostración Interactivo (Theme Light)
├── server.js                     # Servidor backend Express API & Endpoint Universal
└── package.json
```

---

## Instalación y Uso Local

### 1. Requisitos Previos
* **Node.js** (v18+) - [Descargar](https://nodejs.org)
* **PostgreSQL** (v15+) - [Descargar](https://www.postgresql.org/download/)
  - Debe estar ejecutándose en `localhost:5432`
  - Usuario por defecto: `postgres` / `postgres`

**Verificar instalación:**
```bash
node --version      # Debe ser v18 o superior
npm --version
```

### 2. Clonar/Descargar el Proyecto
```bash
cd tu-carpeta-de-proyectos
# Clona o descomprime el proyecto aquí
cd puntito-facturacion-niif
```

### 3. Instalar Dependencias Node.js
```bash
npm install
```

### 4. Configurar Variables de Entorno
Crea o verifica el archivo `.env` en la raíz del proyecto:

```env
# PostgreSQL
PGUSER=postgres
PGPASSWORD=postgres
PGHOST=localhost
PGPORT=5432
PGDATABASE=puntitodb

# Servidor
PORT=3000
NODE_ENV=development

# AutorizadorEC (SRI Ecuador)
AUTORIZADOR_EC_API_KEY=tu_api_key_aqui
AUTORIZADOR_EC_ENV=TEST

# JWT Secret (para autenticación)
JWT_SECRET=tu_secreto_super_seguro_aqui
```

### 5. Inicializar la Base de Datos PostgreSQL

Puedes inicializar la base de datos completa (creación de base de datos, esquemas, tablas, catálogos SRI completos y usuario administrador) con **un solo comando**:

```bash
npm run db:setup
```
*(O de forma equivalente: `node scripts/setup_postgres.js`)*

**¿Qué hace este comando automáticamente?**
1. Crea la base de datos `puntitodb` y los esquemas (`puntito`, `facturacion`, `contabilidad`).
2. Crea todas las tablas base e inserta el cliente demo (`CLI-001`), usuario admin (`admin`) y el Plan de Cuentas NIIF.
3. Aplica automáticamente todas las migraciones en `database/migrations/` (incluyendo la columna `direccion` y catálogos SRI de la Ficha Técnica v2.34).
4. Ejecuta la verificación final mostrando el resumen de registros en consola.

---

### 6. Verificar Estado de la Base de Datos (Opcional en cualquier momento)
```bash
npm run db:verify
```
Deberías ver:
- ✅ 1 Cliente (`CLI-001`)
- ✅ 1 Usuario (`admin`)
- ✅ 4 Módulos contratados
- ✅ 13 Cuentas Contables NIIF
- ✅ Catálogos SRI completos (Ambientes, Formas de Pago, Tarifas IVA)

### 7. Iniciar el Servidor y Dashboard Web
```bash
npm start
```

**Resultado esperado:**
```
Server running on port 3000
✔ Conectado a la base de datos
```

Abre tu navegador en: **`http://localhost:3000`**

### 8. Credenciales de Acceso
Use estas credenciales en la interfaz de login:

| Campo | Valor |
|-------|-------|
| **Usuario** | `admin` |
| **Contraseña** | `Admin2026!` |
| **Empresa** | TIENDA DEMO S.A. (RUC: 0190123456789) |

---

## Modo Desarrollo (con reinicio automático)
Para desarrollo con recarga automática en cambios:
```bash
npm run dev
```

---

## Solución de Problemas

### ❌ Error: "cannot connect to PostgreSQL"
- Verifica que PostgreSQL esté ejecutándose
- Confirma credenciales en `.env` (usuario/contraseña)
- En Windows: revisa el servicio PostgreSQL en Servicios

### ❌ Error: "base de datos 'puntitodb' no existe"
- Ejecuta: `node scripts/setup_postgres.js`

### ❌ Error: "usuario admin no existe"
- Ejecuta: `node scripts/run_all_migrations.js`

### ❌ Error: "columna 'direccion' no existe"
- Las migraciones no se ejecutaron
- Ejecuta nuevamente: `node scripts/run_all_migrations.js`

### ❌ Login fallido con admin/Admin2026!
1. Verifica que el usuario existe: `node scripts/verify_database.js`
2. Reinicia el servidor: `npm start`
3. Limpia cookies del navegador y reinicia

---

## Endpoint Universal de Integración

Para integrar cualquier sistema externo (Dentistas, Veterinarias, POS, E-commerce):
```http
POST /api/v1/invoices/emit
Content-Type: application/json

{
  "comprador": {
    "identificacion": "1712345678",
    "nombre": "Carlos Mendoza",
    "email": "paciente@ejemplo.ec"
  },
  "items": [
    {
      "codigo": "ODONT-01",
      "descripcion": "Limpieza Dental Ultrasónica",
      "cantidad": 1,
      "precioUnitario": 45.00,
      "aplicaIva15": false
    }
  ],
  "formaPago": "EFECTIVO"
}
```

---

## Licencia
Desarrollado para el mercado tributario y contable de Ecuador.
