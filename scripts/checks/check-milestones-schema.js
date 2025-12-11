require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkMilestonesSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'milestones'
      ORDER BY ordinal_position;
    `);

    console.log('📋 COLUMNAS DE milestones:\n');
    result.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${col.udt_name}`);
    });

    // Ver un ejemplo
    const example = await pool.query('SELECT * FROM milestones LIMIT 1');
    if (example.rows.length > 0) {
      console.log('\n📊 EJEMPLO DE HITO:');
      console.log(JSON.stringify(example.rows[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMilestonesSchema();
