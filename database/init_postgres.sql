-- ================================================================================
-- PUNTITO & FACTURACIÓN SRI + CONTABILIDAD NIIF - POSTGRESQL (v15+)
-- ================================================================================
-- Adaptación completa del esquema a PostgreSQL.
-- Incluye:
--  1. Schema 'puntito'    : Core SaaS Multi-tenant (Clientes/Empresas, Módulos, Usuarios)
--  2. Schema 'facturacion': Facturación Electrónica SRI (Emisores, Clientes, Facturas, Impuestos)
--  3. Schema 'contabilidad': Libro Diario NIIF, Partida Doble y Plan de Cuentas PYMES
-- ================================================================================

-- 1. SCHEMAS
CREATE SCHEMA IF NOT EXISTS puntito;
CREATE SCHEMA IF NOT EXISTS facturacion;
CREATE SCHEMA IF NOT EXISTS contabilidad;

-- ================================================================================
-- 2. NÚCLEO PUNTITO (SaaS Multi-tenant)
-- ================================================================================

-- Puntito.TBM_Cliente (Empresas suscritas al SaaS)
CREATE TABLE IF NOT EXISTS puntito.tbm_cliente (
    id_cliente              SERIAL PRIMARY KEY,
    codigo_cliente          VARCHAR(20) UNIQUE NOT NULL,
    ruc                     VARCHAR(13) UNIQUE NOT NULL,
    razon_social            VARCHAR(300) NOT NULL,
    nombre_comercial        VARCHAR(300),
    email                   VARCHAR(200),
    telefono                VARCHAR(50),
    estado                  BOOLEAN NOT NULL DEFAULT TRUE,
    user_create             VARCHAR(50),
    date_create             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_update             VARCHAR(50),
    date_update             TIMESTAMPTZ
);

-- Puntito.TBM_Modulo (Catálogo de módulos disponibles)
CREATE TABLE IF NOT EXISTS puntito.tbm_modulo (
    id_modulo               SERIAL PRIMARY KEY,
    codigo                  VARCHAR(30) UNIQUE NOT NULL, -- ej. 'FE', 'MED', 'POS'
    descripcion             VARCHAR(100) NOT NULL,
    estado                  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Puntito.TBT_Cliente_Modulo (Módulos contratados por empresa)
CREATE TABLE IF NOT EXISTS puntito.tbt_cliente_modulo (
    id_cliente_modulo       SERIAL PRIMARY KEY,
    id_cliente              INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    id_modulo               INT NOT NULL REFERENCES puntito.tbm_modulo(id_modulo),
    fecha_inicio            DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin               DATE,
    estado                  BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_cliente_modulo UNIQUE (id_cliente, id_modulo)
);

-- Puntito.TBS_Usuario (Usuarios funcionales del SaaS)
CREATE TABLE IF NOT EXISTS puntito.tbs_usuario (
    id_usuario              SERIAL PRIMARY KEY,
    id_cliente              INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    usuario                 VARCHAR(100) NOT NULL,
    nombre                  VARCHAR(200) NOT NULL,
    email                   VARCHAR(200),
    password_hash           VARCHAR(500),
    estado                  BOOLEAN NOT NULL DEFAULT TRUE,
    user_create             VARCHAR(50),
    date_create             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cliente_usuario UNIQUE (id_cliente, usuario)
);

-- Puntito.TBS_Usuario_Modulo
CREATE TABLE IF NOT EXISTS puntito.tbs_usuario_modulo (
    id_usuario_modulo       SERIAL PRIMARY KEY,
    id_usuario              INT NOT NULL REFERENCES puntito.tbs_usuario(id_usuario) ON DELETE CASCADE,
    id_modulo               INT NOT NULL REFERENCES puntito.tbm_modulo(id_modulo),
    estado                  BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_usuario_modulo UNIQUE (id_usuario, id_modulo)
);

-- ================================================================================
-- 3. CATÁLOGOS FACTURACIÓN SRI
-- ================================================================================

CREATE TABLE IF NOT EXISTS facturacion.tbc_ambiente (
    codigo                  VARCHAR(1) PRIMARY KEY,
    descripcion             VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS facturacion.tbc_tipo_emision (
    codigo                  VARCHAR(1) PRIMARY KEY,
    descripcion             VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS facturacion.tbc_tipo_documento (
    codigo                  VARCHAR(2) PRIMARY KEY,
    descripcion             VARCHAR(150) NOT NULL,
    version_xml             VARCHAR(10),
    estado                  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS facturacion.tbc_tipo_identificacion (
    codigo                  VARCHAR(2) PRIMARY KEY,
    descripcion             VARCHAR(100) NOT NULL,
    estado                  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS facturacion.tbc_impuesto (
    codigo                  VARCHAR(4) PRIMARY KEY,
    descripcion             VARCHAR(100) NOT NULL,
    estado                  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS facturacion.tbc_tarifa_iva (
    codigo_porcentaje       VARCHAR(4) PRIMARY KEY,
    descripcion             VARCHAR(100) NOT NULL,
    porcentaje              NUMERIC(8,4),
    estado                  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS facturacion.tbc_forma_pago (
    codigo                  VARCHAR(2) PRIMARY KEY,
    descripcion             VARCHAR(150) NOT NULL,
    estado                  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Configuración del módulo de Facturación / AutorizadorEC por empresa
CREATE TABLE IF NOT EXISTS facturacion.tbc_configuracion (
    id_configuracion        SERIAL PRIMARY KEY,
    id_cliente_puntito      INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    ambiente                VARCHAR(1) NOT NULL REFERENCES facturacion.tbc_ambiente(codigo),
    tipo_emision            VARCHAR(1) NOT NULL DEFAULT '1' REFERENCES facturacion.tbc_tipo_emision(codigo),
    ruc_proveedor_sistema   VARCHAR(13),
    autorizador_ec_api_key  VARCHAR(200),
    autorizador_ec_env      VARCHAR(10) DEFAULT 'TEST', -- TEST / PROD
    ruta_certificado        VARCHAR(500),
    secret_reference        VARCHAR(500),
    tiempo_consulta_seg     INT NOT NULL DEFAULT 3,
    estado                  BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_configuracion_cliente UNIQUE (id_cliente_puntito, ambiente)
);

-- ================================================================================
-- 4. MAESTROS DE FACTURACIÓN
-- ================================================================================

CREATE TABLE IF NOT EXISTS facturacion.tbm_emisor (
    id_emisor               SERIAL PRIMARY KEY,
    id_cliente_puntito      INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    ruc                     VARCHAR(13) NOT NULL,
    razon_social            VARCHAR(300) NOT NULL,
    nombre_comercial        VARCHAR(300),
    direccion_matriz        VARCHAR(300) NOT NULL,
    regimen_sri             VARCHAR(30) DEFAULT 'REGIMEN_GENERAL', -- RIMPE_POPULAR, RIMPE_EMPRENDEDOR, REGIMEN_GENERAL
    contribuyente_especial  VARCHAR(13),
    obligado_contabilidad   VARCHAR(2) CHECK (obligado_contabilidad IN ('SI', 'NO')),
    estado                  BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_emisor_cliente UNIQUE (id_cliente_puntito, ruc)
);

CREATE TABLE IF NOT EXISTS facturacion.tbm_establecimiento (
    id_establecimiento      SERIAL PRIMARY KEY,
    id_cliente_puntito      INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    id_emisor               INT NOT NULL REFERENCES facturacion.tbm_emisor(id_emisor),
    codigo_establecimiento  VARCHAR(3) NOT NULL,
    punto_emision           VARCHAR(3) NOT NULL,
    nombre                  VARCHAR(150),
    direccion               VARCHAR(300),
    estado                  BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_establecimiento UNIQUE (id_cliente_puntito, codigo_establecimiento, punto_emision)
);

CREATE TABLE IF NOT EXISTS facturacion.tbm_secuencial (
    id_secuencial           SERIAL PRIMARY KEY,
    id_cliente_puntito      INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    id_establecimiento      INT NOT NULL REFERENCES facturacion.tbm_establecimiento(id_establecimiento),
    cod_doc                 VARCHAR(2) NOT NULL REFERENCES facturacion.tbc_tipo_documento(codigo),
    ultimo_secuencial       INT NOT NULL DEFAULT 0,
    estado                  BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_secuencial UNIQUE (id_cliente_puntito, id_establecimiento, cod_doc)
);

-- Clientes / Compradores finales de cada empresa
CREATE TABLE IF NOT EXISTS facturacion.tbm_cliente (
    id_fe_cliente           BIGSERIAL PRIMARY KEY,
    id_cliente_puntito      INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    tipo_identificacion      VARCHAR(2) NOT NULL REFERENCES facturacion.tbc_tipo_identificacion(codigo),
    identificacion           VARCHAR(20) NOT NULL,
    razon_social             VARCHAR(300) NOT NULL,
    nombre_comercial         VARCHAR(300),
    direccion                VARCHAR(300),
    email                    VARCHAR(300),
    telefono                 VARCHAR(50),
    estado                   BOOLEAN NOT NULL DEFAULT TRUE,
    user_create              VARCHAR(50),
    date_create              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_update              VARCHAR(50),
    date_update              TIMESTAMPTZ,
    CONSTRAINT uq_fe_cliente UNIQUE (id_cliente_puntito, tipo_identificacion, identificacion)
);

CREATE TABLE IF NOT EXISTS facturacion.tbm_producto (
    id_producto              BIGSERIAL PRIMARY KEY,
    id_cliente_puntito       INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    codigo_principal         VARCHAR(25) NOT NULL,
    codigo_auxiliar          VARCHAR(25),
    descripcion              VARCHAR(300) NOT NULL,
    precio_unitario          NUMERIC(18,6) NOT NULL DEFAULT 0,
    estado                   BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_producto UNIQUE (id_cliente_puntito, codigo_principal)
);

CREATE TABLE IF NOT EXISTS facturacion.tbm_producto_impuesto (
    id_producto_impuesto     BIGSERIAL PRIMARY KEY,
    id_producto              BIGINT NOT NULL REFERENCES facturacion.tbm_producto(id_producto) ON DELETE CASCADE,
    codigo_impuesto          VARCHAR(4) NOT NULL REFERENCES facturacion.tbc_impuesto(codigo),
    codigo_porcentaje        VARCHAR(4) NOT NULL REFERENCES facturacion.tbc_tarifa_iva(codigo_porcentaje),
    tarifa                   NUMERIC(8,4) NOT NULL,
    estado                   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ================================================================================
-- 5. TRANSACCIONALES DE FACTURACIÓN (Documentos Emitidos y Respuestas SRI)
-- ================================================================================

CREATE TABLE IF NOT EXISTS facturacion.tbt_documento (
    id_documento             BIGSERIAL PRIMARY KEY,
    id_cliente_puntito       INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente),
    id_emisor                INT NOT NULL REFERENCES facturacion.tbm_emisor(id_emisor),
    id_establecimiento       INT NOT NULL REFERENCES facturacion.tbm_establecimiento(id_establecimiento),
    id_fe_cliente            BIGINT REFERENCES facturacion.tbm_cliente(id_fe_cliente),
    cod_doc                  VARCHAR(2) NOT NULL REFERENCES facturacion.tbc_tipo_documento(codigo),
    version_xml              VARCHAR(10) NOT NULL DEFAULT '1.1.0',
    fecha_emision            DATE NOT NULL DEFAULT CURRENT_DATE,
    secuencial               VARCHAR(9) NOT NULL,
    codigo_numerico          VARCHAR(8) NOT NULL,
    clave_acceso             VARCHAR(49) UNIQUE NOT NULL,
    moneda                   VARCHAR(15) NOT NULL DEFAULT 'DOLAR',
    estado                   VARCHAR(15) NOT NULL DEFAULT 'BORRADOR', -- BORRADOR, ENVIADO, AUTORIZADO, RECHAZADO
    total_sin_impuestos      NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_descuento          NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_iva                NUMERIC(18,2) NOT NULL DEFAULT 0,
    importe_total            NUMERIC(18,2) NOT NULL DEFAULT 0,
    payload_enviado_json     JSONB, -- Almacena el JSON enviado a AutorizadorEC
    respuesta_sri_json       JSONB, -- Respuesta completa de AutorizadorEC/SRI
    numero_autorizacion      VARCHAR(49),
    fecha_autorizacion       TIMESTAMPTZ,
    url_ride_pdf             VARCHAR(500),
    url_xml                  VARCHAR(500),
    user_create              VARCHAR(50),
    date_create              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_secuencial_doc UNIQUE (id_cliente_puntito, id_establecimiento, cod_doc, secuencial)
);

CREATE TABLE IF NOT EXISTS facturacion.tbt_documento_detalle (
    id_detalle               BIGSERIAL PRIMARY KEY,
    id_documento             BIGINT NOT NULL REFERENCES facturacion.tbt_documento(id_documento) ON DELETE CASCADE,
    id_producto              BIGINT REFERENCES facturacion.tbm_producto(id_producto),
    codigo_principal         VARCHAR(25) NOT NULL,
    codigo_auxiliar          VARCHAR(25),
    descripcion              VARCHAR(300) NOT NULL,
    cantidad                 NUMERIC(18,6) NOT NULL,
    precio_unitario          NUMERIC(18,6) NOT NULL,
    descuento                NUMERIC(18,2) NOT NULL DEFAULT 0,
    precio_total_sin_imp     NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS facturacion.tbt_detalle_impuesto (
    id_detalle_impuesto      BIGSERIAL PRIMARY KEY,
    id_detalle               BIGINT NOT NULL REFERENCES facturacion.tbt_documento_detalle(id_detalle) ON DELETE CASCADE,
    codigo_impuesto          VARCHAR(4) NOT NULL REFERENCES facturacion.tbc_impuesto(codigo),
    codigo_porcentaje        VARCHAR(4) NOT NULL REFERENCES facturacion.tbc_tarifa_iva(codigo_porcentaje),
    tarifa                   NUMERIC(8,4) NOT NULL,
    base_imponible           NUMERIC(18,2) NOT NULL,
    valor                    NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS facturacion.tbt_pago (
    id_pago                  BIGSERIAL PRIMARY KEY,
    id_documento             BIGINT NOT NULL REFERENCES facturacion.tbt_documento(id_documento) ON DELETE CASCADE,
    forma_pago               VARCHAR(2) NOT NULL REFERENCES facturacion.tbc_forma_pago(codigo),
    total                    NUMERIC(18,2) NOT NULL,
    plazo                    NUMERIC(18,2),
    unidad_tiempo            VARCHAR(10)
);

-- ================================================================================
-- 6. ESQUEMA CONTABILIDAD NIIF (Partida Doble Automática)
-- ================================================================================

CREATE TABLE IF NOT EXISTS contabilidad.tbm_plan_cuentas (
    id_cuenta                SERIAL PRIMARY KEY,
    id_cliente_puntito      INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente) ON DELETE CASCADE,
    codigo_cuenta            VARCHAR(30) NOT NULL, -- ej. '1.1.01.01'
    nombre_cuenta            VARCHAR(200) NOT NULL,
    tipo_cuenta              VARCHAR(20) NOT NULL, -- ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO
    nivel                    INT NOT NULL DEFAULT 1,
    padre_codigo             VARCHAR(30),
    es_imputable             BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_cuenta_cliente UNIQUE (id_cliente_puntito, codigo_cuenta)
);

CREATE TABLE IF NOT EXISTS contabilidad.tbt_asiento (
    id_asiento               BIGSERIAL PRIMARY KEY,
    id_cliente_puntito      INT NOT NULL REFERENCES puntito.tbm_cliente(id_cliente),
    id_documento             BIGINT REFERENCES facturacion.tbt_documento(id_documento) ON DELETE SET NULL,
    numero_asiento           VARCHAR(30) NOT NULL,
    fecha                    DATE NOT NULL DEFAULT CURRENT_DATE,
    concepto                 VARCHAR(500) NOT NULL,
    total_debe               NUMERIC(18,2) NOT NULL,
    total_haber              NUMERIC(18,2) NOT NULL,
    is_balanced              BOOLEAN NOT NULL DEFAULT TRUE,
    date_create              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contabilidad.tbt_asiento_detalle (
    id_asiento_detalle       BIGSERIAL PRIMARY KEY,
    id_asiento               BIGINT NOT NULL REFERENCES contabilidad.tbt_asiento(id_asiento) ON DELETE CASCADE,
    id_cuenta                INT NOT NULL REFERENCES contabilidad.tbm_plan_cuentas(id_cuenta),
    debe                     NUMERIC(18,2) NOT NULL DEFAULT 0,
    haber                    NUMERIC(18,2) NOT NULL DEFAULT 0
);

-- ================================================================================
-- 7. FUNCIÓN POSTGRESQL PARA SECUENCIALES AUTONUMÉRICOS
-- ================================================================================

CREATE OR REPLACE FUNCTION facturacion.get_next_sequential(
    p_id_cliente_puntito INT,
    p_id_establecimiento INT,
    p_cod_doc VARCHAR(2)
)
RETURNS VARCHAR(9) AS $$
DECLARE
    v_next INT;
BEGIN
    INSERT INTO facturacion.tbm_secuencial (id_cliente_puntito, id_establecimiento, cod_doc, ultimo_secuencial)
    VALUES (p_id_cliente_puntito, p_id_establecimiento, p_cod_doc, 0)
    ON CONFLICT (id_cliente_puntito, id_establecimiento, cod_doc) DO NOTHING;

    UPDATE facturacion.tbm_secuencial
    SET ultimo_secuencial = ultimo_secuencial + 1
    WHERE id_cliente_puntito = p_id_cliente_puntito
      AND id_establecimiento = p_id_establecimiento
      AND cod_doc = p_cod_doc
    RETURNING ultimo_secuencial INTO v_next;

    RETURN LPAD(v_next::TEXT, 9, '0');
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- 8. POBLADO DE CATÁLOGOS INICIALES SRI
-- ================================================================================

INSERT INTO facturacion.tbc_ambiente (codigo, descripcion) VALUES
('1', 'PRUEBAS'), ('2', 'PRODUCCIÓN') ON CONFLICT DO NOTHING;

INSERT INTO facturacion.tbc_tipo_emision (codigo, descripcion) VALUES
('1', 'EMISIÓN NORMAL') ON CONFLICT DO NOTHING;

INSERT INTO facturacion.tbc_tipo_documento (codigo, descripcion, version_xml) VALUES
('01', 'FACTURA', '1.1.0'),
('03', 'LIQUIDACIÓN DE COMPRA', '1.1.0'),
('04', 'NOTA DE CRÉDITO', '1.1.0'),
('05', 'NOTA DE DÉBITO', '1.0.0'),
('06', 'GUÍA DE REMISIÓN', '1.1.0'),
('07', 'COMPROBANTE DE RETENCIÓN', '2.0.0')
ON CONFLICT DO NOTHING;

INSERT INTO facturacion.tbc_tipo_identificacion (codigo, descripcion) VALUES
('04', 'RUC'),
('05', 'CÉDULA'),
('06', 'PASAPORTE'),
('07', 'VENTA A CONSUMIDOR FINAL'),
('08', 'IDENTIFICACIÓN DEL EXTERIOR')
ON CONFLICT DO NOTHING;

INSERT INTO facturacion.tbc_impuesto (codigo, descripcion) VALUES
('2', 'IVA'), ('3', 'ICE'), ('5', 'IRBPNR') ON CONFLICT DO NOTHING;

INSERT INTO facturacion.tbc_tarifa_iva (codigo_porcentaje, descripcion, porcentaje) VALUES
('0', 'IVA 0%', 0),
('2', 'IVA 12%', 12),
('3', 'IVA 14%', 14),
('4', 'IVA 15%', 15),
('5', 'IVA 5%', 5),
('6', 'NO OBJETO DE IMPUESTO', NULL),
('7', 'EXENTO DE IVA', NULL),
('8', 'IVA DIFERENCIADO', NULL)
ON CONFLICT (codigo_porcentaje) DO UPDATE SET 
    descripcion = EXCLUDED.descripcion,
    porcentaje = EXCLUDED.porcentaje;

INSERT INTO facturacion.tbc_forma_pago (codigo, descripcion) VALUES
('01', 'SIN UTILIZACION DEL SISTEMA FINANCIERO (EFECTIVO)'),
('15', 'COMPENSACION DE DEUDAS'),
('16', 'TARJETA DE DEBITO'),
('17', 'DINERO ELECTRONICO'),
('18', 'TARJETA PREPAGO'),
('19', 'TARJETA DE CREDITO'),
('20', 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO'),
('21', 'ENDOSO DE TITULOS'),
('22', 'TRANSFERENCIA BANCARIA')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO puntito.tbm_modulo (codigo, descripcion) VALUES
('FE',    'Facturacion Electronica SRI'),
('MED',   'Consultorio Medico / Odontologia'),
('POS',   'Punto de Venta / Tienda'),
('ADMIN', 'Administracion del Sistema')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- ================================================================================
-- 9. DATOS DE PRUEBA - CLIENTE Y USUARIO
-- ================================================================================

-- Cliente de prueba (Empresa SaaS)
INSERT INTO puntito.tbm_cliente (codigo_cliente, ruc, razon_social, nombre_comercial, email, telefono, estado, user_create) VALUES
('CLI-001', '0190123456789', 'TIENDA DEMO S.A.', 'Tienda Demo', 'info@tiendademo.com', '0212345678', true, 'SYSTEM')
ON CONFLICT (ruc) DO NOTHING;

-- Usuario de prueba
INSERT INTO puntito.tbs_usuario (id_cliente, usuario, nombre, email, password_hash, estado, user_create)
SELECT id_cliente, 'admin', 'Administrador', 'admin@tiendademo.com', 
  '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcd', true, 'SYSTEM'
FROM puntito.tbm_cliente WHERE ruc = '0190123456789'
ON CONFLICT (id_cliente, usuario) DO NOTHING;

-- Asignar módulos al cliente
INSERT INTO puntito.tbt_cliente_modulo (id_cliente, id_modulo, fecha_inicio, estado)
SELECT c.id_cliente, m.id_modulo, CURRENT_DATE, true
FROM puntito.tbm_cliente c
CROSS JOIN puntito.tbm_modulo m
WHERE c.ruc = '0190123456789'
ON CONFLICT (id_cliente, id_modulo) DO NOTHING;

-- Asignar módulos al usuario
INSERT INTO puntito.tbs_usuario_modulo (id_usuario, id_modulo, estado)
SELECT u.id_usuario, m.id_modulo, true
FROM puntito.tbs_usuario u
CROSS JOIN puntito.tbm_modulo m
WHERE u.usuario = 'admin' AND u.id_cliente = (SELECT id_cliente FROM puntito.tbm_cliente WHERE ruc = '0190123456789')
ON CONFLICT (id_usuario, id_modulo) DO NOTHING;

-- Configuración de Facturación (Ambiente TEST)
INSERT INTO facturacion.tbc_configuracion (id_cliente_puntito, ambiente, tipo_emision, autorizador_ec_env, estado)
SELECT id_cliente, '1', '1', 'TEST', true
FROM puntito.tbm_cliente WHERE ruc = '0190123456789'
ON CONFLICT (id_cliente_puntito, ambiente) DO NOTHING;

-- Emisor de prueba (Proveedor de Facturación)
INSERT INTO facturacion.tbm_emisor (id_cliente_puntito, ruc, razon_social, nombre_comercial, direccion_matriz, regimen_sri, obligado_contabilidad, estado)
SELECT id_cliente, '0190123456789', 'TIENDA DEMO S.A.', 'Tienda Demo', 'Calle Principal 123, Quito, Pichincha', 'REGIMEN_GENERAL', 'SI', true
FROM puntito.tbm_cliente WHERE ruc = '0190123456789'
ON CONFLICT (id_cliente_puntito, ruc) DO NOTHING;

-- Establecimiento de prueba
INSERT INTO facturacion.tbm_establecimiento (id_cliente_puntito, id_emisor, codigo_establecimiento, punto_emision, nombre, direccion, estado)
SELECT c.id_cliente, e.id_emisor, '001', '001', 'Matriz', 'Calle Principal 123, Quito', true
FROM puntito.tbm_cliente c
JOIN facturacion.tbm_emisor e ON c.id_cliente = e.id_cliente_puntito
WHERE c.ruc = '0190123456789'
ON CONFLICT (id_cliente_puntito, codigo_establecimiento, punto_emision) DO NOTHING;

-- ================================================================================
-- 10. PLAN DE CUENTAS NIIF POR DEFECTO (PYMES)
-- ================================================================================

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '1', 'ACTIVO', 'ACTIVO', 1, NULL, false
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '1.1', 'ACTIVO CORRIENTE', 'ACTIVO', 2, '1', false
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '1.1.01', 'CAJA', 'ACTIVO', 3, '1.1', true
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '1.1.02', 'BANCOS', 'ACTIVO', 3, '1.1', true
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '2', 'PASIVO', 'PASIVO', 1, NULL, false
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '2.1', 'PASIVO CORRIENTE', 'PASIVO', 2, '2', false
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '2.1.01', 'CUENTAS POR PAGAR', 'PASIVO', 3, '2.1', true
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '3', 'PATRIMONIO', 'PATRIMONIO', 1, NULL, false
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '3.1', 'CAPITAL', 'PATRIMONIO', 2, '3', true
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '4', 'INGRESOS', 'INGRESO', 1, NULL, false
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '4.1', 'VENTAS', 'INGRESO', 2, '4', true
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '5', 'GASTOS', 'GASTO', 1, NULL, false
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;

INSERT INTO contabilidad.tbm_plan_cuentas (id_cliente_puntito, codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, padre_codigo, es_imputable)
SELECT c.id_cliente, '5.1', 'COSTO DE VENTAS', 'GASTO', 2, '5', true
FROM puntito.tbm_cliente c WHERE c.ruc = '0190123456789' ON CONFLICT (id_cliente_puntito, codigo_cuenta) DO NOTHING;
