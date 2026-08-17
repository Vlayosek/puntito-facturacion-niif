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

async function clean() {
  const client = await pool.connect();
  console.log('Limpiando usuarios de prueba automatizados (cajero_*)...');
  await client.query("DELETE FROM puntito.tbs_usuario WHERE usuario LIKE 'cajero_%'");

  const res = await client.query('SELECT id_usuario, id_cliente, usuario, nombre, email FROM puntito.tbs_usuario');
  console.log('\nUsuarios vigentes en la base de datos:');
  console.table(res.rows);

  client.release();
  await pool.end();
}

clean().catch(console.error);
