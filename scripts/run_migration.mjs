/**
 * Script de migración: aplica catálogos SRI completos + usuario admin inicial
 * Uso: node scripts/run_migration.mjs
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
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

async function run() {
  const client = await pool.connect();
  try {
    console.log('✔ Conectado a PostgreSQL');

    // 1. Leer y ejecutar migración SQL base
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', '001_catalogs_and_admin.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await client.query(sql);
    console.log('✔ Catálogos SRI completos aplicados');

    // 2. Generar hash real de la contraseña admin
    const password = 'Admin2026!';
    const hash = await bcrypt.hash(password, 10);
    console.log('✔ Hash bcrypt generado');

    // 3. Obtener el primer cliente
    let res = await client.query('SELECT id_cliente FROM puntito.tbm_cliente ORDER BY id_cliente LIMIT 1');
    let idCliente;
    if (res.rowCount === 0) {
      const ins = await client.query(
        `INSERT INTO puntito.tbm_cliente (codigo_cliente, ruc, razon_social, nombre_comercial, email, telefono)
         VALUES ('CLI-DEMO', '9999999999999', 'EMPRESA DEMO PUNTITO S.A.', 'Puntito Demo', 'admin@puntito.ec', '0999999999')
         RETURNING id_cliente`
      );
      idCliente = ins.rows[0].id_cliente;
      console.log('✔ Empresa demo creada, id_cliente:', idCliente);
    } else {
      idCliente = res.rows[0].id_cliente;
      console.log('✔ Usando empresa existente, id_cliente:', idCliente);
    }

    // 4. Insertar o actualizar usuario admin con hash real
    await client.query(
      `INSERT INTO puntito.tbs_usuario (id_cliente, usuario, nombre, email, password_hash, estado)
       VALUES ($1, 'admin', 'Administrador del Sistema', 'admin@puntito.ec', $2, TRUE)
       ON CONFLICT (id_cliente, usuario) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [idCliente, hash]
    );
    console.log('✔ Usuario admin creado/actualizado');
    console.log('  → Usuario: admin');
    console.log('  → Contraseña: Admin2026!');
    console.log('  → id_cliente:', idCliente);

    // 5. Verificar tbc_forma_pago
    const fp = await client.query('SELECT COUNT(*) FROM facturacion.tbc_forma_pago');
    console.log(`✔ tbc_forma_pago: ${fp.rows[0].count} formas de pago registradas`);

    // 6. Verificar tbc_tarifa_iva
    const tv = await client.query('SELECT COUNT(*) FROM facturacion.tbc_tarifa_iva');
    console.log(`✔ tbc_tarifa_iva: ${tv.rows[0].count} tarifas registradas`);

    console.log('\n🎉 Migración completada exitosamente.');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
