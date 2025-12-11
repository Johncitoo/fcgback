const { Client } = require('pg');

require('dotenv').config();
const DATABASE_URL = process.env.DATABASE_URL;

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Estructura de la tabla forms
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'forms' 
      ORDER BY ordinal_position
    `);

    console.log('📋 Estructura de la tabla "forms":');
    console.log(JSON.stringify(columns.rows, null, 2));

    // Ver si hay algún registro
    const count = await client.query(`SELECT COUNT(*) FROM forms`);
    console.log(`\n📊 Registros en forms: ${count.rows[0].count}`);

    if (parseInt(count.rows[0].count) > 0) {
      const sample = await client.query(`SELECT * FROM forms LIMIT 1`);
      console.log('\n📝 Ejemplo de registro:');
      console.log(JSON.stringify(sample.rows[0], null, 2));
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
