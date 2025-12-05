// Script para ver el contenido completo del formulario
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function showFormContent() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const formResult = await client.query(`
      SELECT id, name, schema
      FROM forms
      WHERE id = 'c7033cc7-b81a-497a-8907-ce2d639cd077'
    `);

    if (formResult.rows.length === 0) {
      console.log('❌ Formulario no encontrado');
      return;
    }

    const form = formResult.rows[0];
    console.log(`📝 Formulario: ${form.name}`);
    console.log(`   ID: ${form.id}\n`);

    const schema = form.schema;
    console.log('📊 Schema completo:\n');
    console.log(JSON.stringify(schema, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

showFormContent();
