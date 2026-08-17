import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: 'puntitodb'
};

async function verifyDatabase() {
  const client = new pg.Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ Conectado a puntitodb\n');

    // Verificar clientes
    const clientesRes = await client.query('SELECT COUNT(*) as total FROM puntito.tbm_cliente');
    console.log(`📊 Clientes: ${clientesRes.rows[0].total}`);
    const clientDetails = await client.query('SELECT id_cliente, codigo_cliente, razon_social FROM puntito.tbm_cliente');
    clientDetails.rows.forEach(row => {
      console.log(`   - ${row.codigo_cliente}: ${row.razon_social}`);
    });

    // Verificar usuarios
    const usuariosRes = await client.query('SELECT COUNT(*) as total FROM puntito.tbs_usuario');
    console.log(`\n👤 Usuarios: ${usuariosRes.rows[0].total}`);
    const userDetails = await client.query('SELECT usuario, nombre, email FROM puntito.tbs_usuario');
    userDetails.rows.forEach(row => {
      console.log(`   - ${row.usuario}: ${row.nombre} (${row.email})`);
    });

    // Verificar módulos
    const modulosRes = await client.query('SELECT COUNT(*) as total FROM puntito.tbm_modulo');
    console.log(`\n📦 Módulos: ${modulosRes.rows[0].total}`);
    const moduloDetails = await client.query('SELECT codigo, descripcion FROM puntito.tbm_modulo ORDER BY id_modulo');
    moduloDetails.rows.forEach(row => {
      console.log(`   - [${row.codigo}] ${row.descripcion}`);
    });

    // Verificar emisores
    const emisoresRes = await client.query('SELECT COUNT(*) as total FROM facturacion.tbm_emisor');
    console.log(`\n📄 Emisores de Facturación: ${emisoresRes.rows[0].total}`);
    const emisorDetails = await client.query('SELECT id_emisor, razon_social, ruc FROM facturacion.tbm_emisor');
    emisorDetails.rows.forEach(row => {
      console.log(`   - ${row.ruc}: ${row.razon_social}`);
    });

    // Verificar establecimientos
    const estabRes = await client.query('SELECT COUNT(*) as total FROM facturacion.tbm_establecimiento');
    console.log(`\n🏢 Establecimientos: ${estabRes.rows[0].total}`);

    // Verificar plan de cuentas
    const cuentasRes = await client.query('SELECT COUNT(*) as total FROM contabilidad.tbm_plan_cuentas');
    console.log(`\n💰 Plan de Cuentas: ${cuentasRes.rows[0].total}`);

    // Verificar catálogos SRI
    const ambienteRes = await client.query('SELECT COUNT(*) as total FROM facturacion.tbc_ambiente');
    const tipoDocRes = await client.query('SELECT COUNT(*) as total FROM facturacion.tbc_tipo_documento');
    const ivaRes = await client.query('SELECT COUNT(*) as total FROM facturacion.tbc_tarifa_iva');
    console.log(`\n📋 Catálogos SRI:`);
    console.log(`   - Ambientes: ${ambienteRes.rows[0].total}`);
    console.log(`   - Tipos de Documento: ${tipoDocRes.rows[0].total}`);
    console.log(`   - Tarifas IVA: ${ivaRes.rows[0].total}`);

    console.log('\n✅ Base de datos poblada correctamente!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyDatabase();
