require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Agregar columna schema si no existe
    await client.query(`
      ALTER TABLE forms 
      ADD COLUMN IF NOT EXISTS schema JSONB DEFAULT '{}'::jsonb
    `);

    console.log('✅ Columna "schema" agregada a la tabla forms');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
