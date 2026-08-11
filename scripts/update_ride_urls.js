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

async function run() {
  await client.connect();
  const res = await client.query("UPDATE facturacion.tbt_documento SET url_ride_pdf = '/ride-viewer.html?clave=' || clave_acceso");
  console.log(`✅ Base de datos actualizada: ${res.rowCount} facturas ahora apuntan al visor RIDE PDF nativo.`);
  await client.end();
}

run();
