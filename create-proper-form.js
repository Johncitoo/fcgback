require('dotenv').config();
const { Client } = require('pg');

async function createProperForm() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    // Crear el formulario correcto para Becas FCG 2026
    const schema = {
      sections: [
        {
          id: 'parte1',
          title: 'PARTE 1',
          description: 'Primera sección del formulario',
          fields: [
            {
              id: 'nombres',
              name: 'nombres',
              label: 'Nombres',
              type: 'text',
              required: true
            },
            {
              id: 'apellidos',
              name: 'apellidos',
              label: 'Apellidos',
              type: 'text',
              required: true
            },
            {
              id: 'rut',
              name: 'rut',
              label: 'RUT',
              type: 'text',
              required: true
            },
            {
              id: 'email',
              name: 'email',
              label: 'Email',
              type: 'email',
              required: true
            }
          ]
        },
        {
          id: 'parte2',
          title: 'PARTE 2',
          description: 'Segunda sección del formulario',
          fields: [
            {
              id: 'institucion',
              name: 'institucion',
              label: 'Institución',
              type: 'text',
              required: true
            },
            {
              id: 'carrera',
              name: 'carrera',
              label: 'Carrera',
              type: 'text',
              required: true
            }
          ]
        }
      ]
    };

    // Insertar el form
    const insertResult = await client.query(`
      INSERT INTO forms (id, name, description, is_template, schema, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, false, $3, NOW(), NOW())
      RETURNING *
    `, [
      'Becas FCG 2026 - Formulario Principal',
      'Formulario de postulación Becas FCG 2026',
      JSON.stringify(schema)
    ]);

    const form = insertResult.rows[0];
    console.log('✅ Formulario creado:');
    console.log('  ID:', form.id);
    console.log('  Nombre:', form.name);
    console.log('  Secciones:', form.schema.sections.length);

    // Actualizar el milestone
    const updateMilestone = await client.query(`
      UPDATE milestones
      SET form_id = $1, updated_at = NOW()
      WHERE id = '0f793c2f-b4b8-4d5f-bdb2-68c2dd6df63c'
      RETURNING *
    `, [form.id]);

    if (updateMilestone.rowCount > 0) {
      console.log('\n✅ Milestone "Postulación" actualizado con el nuevo formulario');
    }

    console.log('\n📋 Ahora cuando el postulante entre con el código, verá estas secciones:');
    schema.sections.forEach((sec, i) => {
      console.log(`  ${i + 1}. ${sec.title} (${sec.fields.length} campos)`);
    });

  } finally {
    await client.end();
  }
}

createProperForm().catch(console.error);
