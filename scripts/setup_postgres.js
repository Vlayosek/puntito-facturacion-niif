import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: 'postgres'
};

async function setupDatabase() {
  console.log(`Conectando a PostgreSQL en ${dbConfig.host}:${dbConfig.port}...`);
  
  const client = new pg.Client(dbConfig);
  
  try {
    await client.connect();
    console.log('Conexión establecida a PostgreSQL.');

    const resDb = await client.query("SELECT 1 FROM pg_database WHERE datname = 'puntitodb'");
    if (resDb.rowCount === 0) {
      console.log("Creando base de datos 'puntitodb'...");
      await client.query('CREATE DATABASE puntitodb');
      console.log("Base de datos 'puntitodb' creada exitosamente.");
    } else {
      console.log("La base de datos 'puntitodb' ya existe.");
    }
    await client.end();

    const puntitoClient = new pg.Client({ ...dbConfig, database: 'puntitodb' });
    await puntitoClient.connect();

    const sqlPath = path.join(__dirname, '..', 'database', 'init_postgres.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    console.log("Ejecutando script de migración 'database/init_postgres.sql'...");
    await puntitoClient.query(sqlContent);
    console.log("Estructura de Base de Datos PostgreSQL (puntito, facturacion, contabilidad) inicializada con éxito.");

    await puntitoClient.end();
  } catch (error) {
    console.error('Error configurando PostgreSQL:', error.message);
    console.log('\nSugerencia: Si tu usuario o contraseña de PostgreSQL no son "postgres", ejecuta el script pasando las variables de entorno:');
    console.log('   PGUSER=tu_usuario PGPASSWORD=tu_clave node scripts/setup_postgres.js');
  }
}

setupDatabase();
