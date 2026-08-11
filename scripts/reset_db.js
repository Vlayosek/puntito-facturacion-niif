import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: 'puntitodb'
});

async function resetDatabase() {
  console.log("Limpiando datos transaccionales de PostgreSQL ('puntitodb')...");
  try {
    await client.connect();

    await client.query(`
      TRUNCATE TABLE 
        contabilidad.tbt_asiento_detalle, 
        contabilidad.tbt_asiento, 
        facturacion.tbt_detalle_impuesto,
        facturacion.tbt_documento_detalle, 
        facturacion.tbt_pago,
        facturacion.tbt_documento, 
        facturacion.tbm_secuencial
      RESTART IDENTITY CASCADE;
    `);

    console.log("Base de datos limpiada con éxito. Tablas transaccionales reiniciadas.");
  } catch (error) {
    console.error("Error al limpiar la base de datos:", error.message);
  } finally {
    await client.end();
  }
}

resetDatabase();
