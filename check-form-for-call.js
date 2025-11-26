require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await client.connect();
    
    // Buscar el formulario más reciente creado con el Form Builder
    const result = await client.query(`
      SELECT f.*, m.call_id, m.name as milestone_name, m.order_index
      FROM forms f
      LEFT JOIN milestones m ON m.form_id = f.id
      WHERE m.call_id = '5e33c8ee-52a7-4736-89a4-043845ea7f1a'
      ORDER BY f.created_at DESC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      console.log('📝 Formulario encontrado para Becas FCG 2026:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('❌ No se encontró formulario vinculado a la convocatoria');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
