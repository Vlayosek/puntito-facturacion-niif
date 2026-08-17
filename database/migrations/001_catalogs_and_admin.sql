-- ================================================================================
-- MIGRACION 001 -- Catalogos SRI completos + Usuario Admin inicial
-- Ficha Tecnica Comprobantes Electronicos Esquema Offline v2.34 (SRI Ecuador)
-- ================================================================================

-- Completar tbc_forma_pago con los codigos oficiales SRI
-- Fuente: Tabla 24 - Formas de Pago, Ficha Tecnica v2.34 SRI Ecuador
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

-- Completar tbc_tarifa_iva con todos los codigos SRI vigentes
-- Fuente: Tabla 16 - Codigo de Porcentaje de IVA, Ficha Tecnica v2.34
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

-- Modulos del SaaS
INSERT INTO puntito.tbm_modulo (codigo, descripcion) VALUES
('FE',    'Facturacion Electronica SRI'),
('MED',   'Consultorio Medico / Odontologia'),
('POS',   'Punto de Venta / Tienda'),
('ADMIN', 'Administracion del Sistema')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;
