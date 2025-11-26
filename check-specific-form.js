require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const formId = '1971673b-44b0-4ce8-a137-f9c4e41de640';

    const form = await client.query(`
      SELECT * FROM forms WHERE id = $1
    `, [formId]);

    if (form.rows.length === 0) {
      console.log(`❌ Form ${formId} NO EXISTE en la tabla forms`);
    } else {
      console.log('📝 Contenido del form:');
      console.log(JSON.stringify(form.rows[0], null, 2));
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
