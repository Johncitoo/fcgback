const { Client } = require('pg');

async function checkDatabase() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // 1. Ver estructura de la tabla forms
    console.log('📊 ESTRUCTURA DE LA TABLA FORMS:');
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'forms' 
      ORDER BY ordinal_position
    `);
    console.table(cols.rows);

    // 2. Ver si hay formularios
    console.log('\n📝 FORMULARIOS EXISTENTES:');
    const forms = await client.query(`
      SELECT id, name, description, version, is_template 
      FROM forms 
      LIMIT 5
    `);
    console.table(forms.rows);

    // 3. Ver un ejemplo de schema JSONB
    if (forms.rows.length > 0) {
      console.log('\n🔍 EJEMPLO DE SCHEMA JSONB:');
      const schema = await client.query(`
        SELECT id, name, schema 
        FROM forms 
        WHERE schema IS NOT NULL 
        LIMIT 1
      `);
      if (schema.rows.length > 0) {
        console.log(`\nFormulario: ${schema.rows[0].name}`);
        console.log('Schema:', JSON.stringify(schema.rows[0].schema, null, 2));
      }
    }

    // 4. Ver si existen form_sections y form_fields
    console.log('\n📋 SISTEMA NUEVO (form_sections):');
    const sections = await client.query(`
      SELECT COUNT(*) as count FROM form_sections
    `);
    console.log(`Total secciones: ${sections.rows[0].count}`);

    console.log('\n📋 SISTEMA NUEVO (form_fields):');
    const fields = await client.query(`
      SELECT COUNT(*) as count FROM form_fields
    `);
    console.log(`Total campos: ${fields.rows[0].count}`);

    // 5. Ver aplicaciones con respuestas
    console.log('\n📄 APLICACIONES CON RESPUESTAS:');
    const apps = await client.query(`
      SELECT a.id, a.status, a.submitted_at, 
             ap.first_name, ap.last_name,
             c.name as call_name
      FROM applications a
      JOIN applicants ap ON ap.id = a.applicant_id
      JOIN calls c ON c.id = a.call_id
      WHERE a.status != 'DRAFT'
      ORDER BY a.created_at DESC
      LIMIT 5
    `);
    console.table(apps.rows);

    // 6. Ver estructura de respuestas (form_responses)
    console.log('\n📝 ESTRUCTURA DE RESPUESTAS:');
    const respCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'form_responses' 
      ORDER BY ordinal_position
    `);
    console.table(respCols.rows);

    // 7. Ver ejemplo de respuestas
    if (apps.rows.length > 0) {
      const appId = apps.rows[0].id;
      console.log(`\n🔍 EJEMPLO DE RESPUESTAS (App: ${appId}):`);
      const responses = await client.query(`
        SELECT 
          fr.id,
          ff.label as pregunta,
          ff.type as tipo_campo,
          fr.value as respuesta
        FROM form_responses fr
        JOIN form_fields ff ON ff.id = fr.field_id
        WHERE fr.application_id = $1
        LIMIT 5
      `, [appId]);
      console.table(responses.rows);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase();
