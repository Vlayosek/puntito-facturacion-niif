import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'puntitodb'
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Aplicando migración 002 (direccion en facturacion.tbm_cliente)...');
    await client.query(`
      ALTER TABLE facturacion.tbm_cliente ADD COLUMN IF NOT EXISTS direccion VARCHAR(300);
    `);
    console.log('✔ Columna facturacion.tbm_cliente.direccion lista.');
  } catch (err) {
    console.error('Error en migración 002:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
