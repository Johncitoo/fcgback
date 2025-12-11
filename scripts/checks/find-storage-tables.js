const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: { rejectUnauthorized: false }
});

async function findStorageTables() {
  try {
    console.log('\n=== BUSCANDO TABLAS DE STORAGE ===\n');

    // 1. Listar todas las tablas que contengan 'file' o 'storage'
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%file%' OR table_name LIKE '%storage%' OR table_name LIKE '%upload%')
      ORDER BY table_name;
    `);

    console.log('Tablas relacionadas con archivos/storage:');
    if (tables.rows.length > 0) {
      tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
    } else {
      console.log('  ❌ No se encontraron tablas');
    }

    // 2. Listar TODAS las tablas para ver qué hay
    console.log('\n=== TODAS LAS TABLAS EN LA BASE DE DATOS ===\n');
    const allTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`Total de tablas: ${allTables.rows.length}\n`);
    allTables.rows.forEach(t => console.log(`  - ${t.table_name}`));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

findStorageTables();
