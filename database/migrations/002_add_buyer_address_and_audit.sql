-- ================================================================================
-- MIGRACION 002 -- Agregar columna direccion a facturacion.tbm_cliente y auditoria
-- ================================================================================

-- 1. Agregar columna direccion a facturacion.tbm_cliente si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'facturacion'
          AND table_name = 'tbm_cliente'
          AND column_name = 'direccion'
    ) THEN
        ALTER TABLE facturacion.tbm_cliente ADD COLUMN direccion VARCHAR(300);
        RAISE NOTICE 'Columna direccion agregada a facturacion.tbm_cliente';
    END IF;
END $$;
