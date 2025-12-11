require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const calls = await client.query(`
      SELECT id, name, year, status, created_at
      FROM calls
      ORDER BY year DESC, created_at DESC
    `);

    console.log('📋 Convocatorias en la base de datos:');
    calls.rows.forEach((call, i) => {
      console.log(`${i + 1}. ${call.name} (${call.year})`);
      console.log(`   ID: ${call.id}`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Created: ${call.created_at}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
