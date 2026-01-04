require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

const pool = new Pool({
  connectionString: DATABASE_URL
});

async function showTablesSummary() {
  try {
    // Obtener lista de tablas
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('='.repeat(80));
    console.log(`RESUMEN DE ${tablesResult.rows.length} TABLAS`);
    console.log('='.repeat(80));
    console.log();

    for (const { table_name } of tablesResult.rows) {
      // Contar registros
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${table_name}"`);
      const count = parseInt(countResult.rows[0].count);

      console.log(`📊 ${table_name.toUpperCase()}`);
      console.log(`   Total registros: ${count}`);

      if (count > 0) {
        // Mostrar primeros 5 registros
        const dataResult = await pool.query(`SELECT * FROM "${table_name}" LIMIT 5`);
        console.log(`   Primeros ${Math.min(count, 5)} registros:`);
        console.log('   ' + JSON.stringify(dataResult.rows, null, 2).replace(/\n/g, '\n   '));
      } else {
        console.log('   (tabla vacía)');
      }
      
      console.log();
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

showTablesSummary();
