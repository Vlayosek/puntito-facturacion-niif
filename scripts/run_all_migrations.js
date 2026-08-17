import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'puntitodb'
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[OK] Conectado a PostgreSQL\n');

    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Encontradas ${files.length} migraciones:`);
    files.forEach(f => console.log(`   - ${f}`));
    console.log();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      try {
        await client.query(sql);
        console.log(`  [OK] ${file} ejecutado correctamente`);
      } catch (err) {
        console.error(`  [ERROR] Error en ${file}:`, err.message);
      }
    }

    console.log('\n[OK] Todas las migraciones completadas.');
    
  } catch (err) {
    console.error('[ERROR] Error fatal:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
