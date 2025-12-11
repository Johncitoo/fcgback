// Verificar si el invite tiene email en meta
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function checkInvite() {
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT id, meta, created_at
      FROM invites
      WHERE code_hash = (
        SELECT code_hash FROM invites 
        ORDER BY created_at DESC 
        LIMIT 1
      )
      LIMIT 1
    `);

    console.log('\n📋 Estructura del invite más reciente:\n');
    console.log(JSON.stringify(result.rows[0], null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkInvite();
