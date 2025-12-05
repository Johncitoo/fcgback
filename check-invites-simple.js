require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkInvitesSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'invites'
      ORDER BY ordinal_position;
    `);

    console.log('Columnas de invites:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    const sample = await pool.query('SELECT * FROM invites LIMIT 1');
    if (sample.rows.length > 0) {
      console.log('\nEjemplo:');
      console.log(JSON.stringify(sample.rows[0], null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkInvitesSchema();
