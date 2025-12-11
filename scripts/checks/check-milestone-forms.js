require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Ver milestones de la convocatoria activa
    const milestones = await client.query(`
      SELECT 
        m.id,
        m.name,
        m.form_id,
        m.order_index,
        c.name as call_name
      FROM milestones m
      JOIN calls c ON c.id = m.call_id
      WHERE c.id = '5e33c8ee-52a7-4736-89a4-043845ea7f1a'
      ORDER BY m.order_index
    `);

    console.log('📋 Milestones de la convocatoria activa:');
    console.log(JSON.stringify(milestones.rows, null, 2));

    // Ver si hay forms creados
    const forms = await client.query(`
      SELECT id, name, description, created_at
      FROM forms
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n📝 Últimos 5 formularios creados:');
    console.log(JSON.stringify(forms.rows, null, 2));

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
