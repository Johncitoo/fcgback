require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkMilestoneProgressSchema() {
  try {
    const result = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'milestone_progress'
      ORDER BY ordinal_position;
    `);

    console.log('📋 COLUMNAS DE milestone_progress:\n');
    result.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${col.udt_name.padEnd(20)} | ${col.is_nullable}`);
    });

    // Ver valores únicos del campo status
    const statusResult = await pool.query(`
      SELECT DISTINCT status 
      FROM milestone_progress 
      WHERE status IS NOT NULL
    `);

    console.log('\n📊 VALORES ACTUALES DE status:');
    statusResult.rows.forEach(row => {
      console.log(`  - ${row.status}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMilestoneProgressSchema();
