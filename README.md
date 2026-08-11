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
* Node.js (v18+)
* PostgreSQL (v15+) ejecutándose en `localhost:5432`

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Inicializar la Base de Datos PostgreSQL
Ejecuta el asistente automático para crear la base de datos `puntitodb` y poblar los esquemas y catálogos SRI:
```bash
node scripts/setup_postgres.js
```

### 4. Iniciar el Servidor y Dashboard Web
```bash
npm start
```
Abre tu navegador en: **`http://localhost:3000`**

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
