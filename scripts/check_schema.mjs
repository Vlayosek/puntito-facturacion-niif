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

const client = await pool.connect();

// Check tbc_configuracion structure
const cols = await client.query(
  `SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'facturacion' AND table_name = 'tbc_configuracion'
   ORDER BY ordinal_position`
);
console.log('tbc_configuracion columns:');
console.table(cols.rows);

// Check unique constraints
const constraints = await client.query(
  `SELECT conname, contype, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'facturacion.tbc_configuracion'::regclass`
);
console.log('\nConstraints:');
console.table(constraints.rows);

// Check tbs_usuario structure
const userCols = await client.query(
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema = 'puntito' AND table_name = 'tbs_usuario'
   ORDER BY ordinal_position`
);
console.log('\ntbs_usuario columns:');
console.table(userCols.rows);

// Check unique on tbs_usuario
const userConstraints = await client.query(
  `SELECT conname, contype, pg_get_constraintdef(oid)
   FROM pg_constraint WHERE conrelid = 'puntito.tbs_usuario'::regclass`
);
console.log('\ntbs_usuario constraints:');
console.table(userConstraints.rows);

client.release();
await pool.end();
