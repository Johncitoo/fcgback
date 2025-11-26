require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await client.connect();
    
    // 1. Ver milestone de Becas FCG 2026
    const milestone = await client.query(`
      SELECT m.*, c.name as call_name
      FROM milestones m
      JOIN calls c ON c.id = m.call_id
      WHERE c.id = '5e33c8ee-52a7-4736-89a4-043845ea7f1a'
      ORDER BY m.order_index
    `);

    console.log('📋 Milestone de Becas FCG 2026:');
    if (milestone.rows.length === 0) {
      console.log('❌ NO HAY MILESTONES para esta convocatoria');
    } else {
      milestone.rows.forEach(m => {
        console.log(`- ${m.name}`);
        console.log(`  form_id: ${m.form_id || 'NULL'}`);
        console.log(`  order_index: ${m.order_index}`);
      });
    }

    // 2. Si hay form_id, ver el form
    const formId = milestone.rows[0]?.form_id;
    if (formId) {
      const form = await client.query(`
        SELECT id, name, description, schema, created_at, updated_at
        FROM forms
        WHERE id = $1
      `, [formId]);

      console.log(`\n📝 Form "${formId}":`);
      if (form.rows.length > 0) {
        const f = form.rows[0];
        console.log(`- Nombre: ${f.name}`);
        console.log(`- Schema: ${f.schema ? JSON.stringify(f.schema, null, 2) : 'NULL'}`);
        console.log(`- Creado: ${f.created_at}`);
        console.log(`- Actualizado: ${f.updated_at}`);
      } else {
        console.log('❌ Form NO EXISTE');
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
