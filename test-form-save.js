require('dotenv').config();
const https = require('https');

const { Client } = require('pg');

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    // Crear form directamente en DB con schema
    const testSchema = {
      sections: [
        {
          id: 'sec1',
          title: 'Sección de Prueba',
          description: 'Esta es una sección de prueba',
          fields: [
            {
              id: 'f1',
              name: 'nombre',
              label: 'Nombre',
              type: 'text',
              required: true
            }
          ]
        }
      ]
    };

    const insertResult = await client.query(`
      INSERT INTO forms (id, name, description, is_template, schema, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, false, $3, NOW(), NOW())
      RETURNING *
    `, ['Test Form Direct', 'Testing schema', JSON.stringify(testSchema)]);

    const form = insertResult.rows[0];
    console.log('✅ Form creado directamente en DB');
    console.log('ID:', form.id);
    console.log('Schema guardado:', typeof form.schema === 'string' ? JSON.parse(form.schema) : form.schema);

    // Ahora actualizar el milestone de Becas FCG 2026 con este nuevo form
    const updateMilestone = await client.query(`
      UPDATE milestones
      SET form_id = $1
      WHERE call_id = '5e33c8ee-52a7-4736-89a4-043845ea7f1a'
        AND name = 'Postulación'
      RETURNING *
    `, [form.id]);

    if (updateMilestone.rowCount > 0) {
      console.log('\n✅ Milestone actualizado con nuevo form_id');
    }

  } finally {
    await client.end();
  }
}

test().catch(console.error);
