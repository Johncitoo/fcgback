const { Client } = require('pg');

async function checkFormDetails() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado\n');

    // 1. Ver convocatoria activa
    const activeCall = await client.query(`
      SELECT id, name, year, status, is_active 
      FROM calls 
      WHERE is_active = true 
      LIMIT 1
    `);
    
    if (activeCall.rows.length === 0) {
      console.log('⚠️ No hay convocatoria activa');
      await client.end();
      return;
    }

    const callId = activeCall.rows[0].id;
    console.log('📋 CONVOCATORIA ACTIVA:');
    console.table(activeCall.rows);

    // 2. Ver secciones de esta convocatoria
    console.log('\n📑 SECCIONES:');
    const sections = await client.query(`
      SELECT id, title, "order", visible 
      FROM form_sections 
      WHERE call_id = $1 
      ORDER BY "order"
    `, [callId]);
    console.table(sections.rows);

    // 3. Ver campos de cada sección
    if (sections.rows.length > 0) {
      for (const section of sections.rows) {
        console.log(`\n📝 CAMPOS DE LA SECCIÓN "${section.title}":`);
        const fields = await client.query(`
          SELECT 
            id, 
            name, 
            label, 
            type, 
            required, 
            "order",
            active,
            visibility
          FROM form_fields 
          WHERE call_id = $1 AND section_id = $2 
          ORDER BY "order"
        `, [callId, section.id]);
        console.table(fields.rows);
      }
    }

    // 4. Ver si hay aplicaciones con respuestas
    console.log('\n📊 APLICACIONES DE ESTA CONVOCATORIA:');
    const apps = await client.query(`
      SELECT 
        a.id,
        ap.first_name || ' ' || ap.last_name as postulante,
        a.status,
        a.submitted_at,
        (SELECT COUNT(*) FROM form_responses fr WHERE fr.application_id = a.id) as respuestas_count
      FROM applications a
      JOIN applicants ap ON ap.id = a.applicant_id
      WHERE a.call_id = $1
      ORDER BY a.created_at DESC
    `, [callId]);
    console.table(apps.rows);

    // 5. Si hay aplicaciones, ver ejemplo de respuestas
    if (apps.rows.length > 0 && apps.rows[0].respuestas_count > 0) {
      const appId = apps.rows[0].id;
      console.log(`\n🔍 RESPUESTAS DE LA PRIMERA APLICACIÓN (${apps.rows[0].postulante}):`);
      const responses = await client.query(`
        SELECT 
          ff.name as campo_name,
          ff.label as pregunta,
          ff.type as tipo,
          fr.value as respuesta
        FROM form_responses fr
        JOIN form_fields ff ON ff.id = fr.field_id
        WHERE fr.application_id = $1
        ORDER BY ff."order"
      `, [appId]);
      console.table(responses.rows);
    }

    // 6. Verificar el endpoint que usaría el CSV
    console.log('\n🔧 SIMULANDO ENDPOINT /calls/:id/form:');
    
    // Verificar si hay milestone con form_id
    const milestone = await client.query(`
      SELECT id, name, form_id 
      FROM milestones 
      WHERE call_id = $1 AND form_id IS NOT NULL 
      ORDER BY order_index 
      LIMIT 1
    `, [callId]);
    
    if (milestone.rows.length > 0) {
      console.log('✅ Milestone con form_id encontrado:', milestone.rows[0]);
      
      const form = await client.query(`
        SELECT id, name, schema 
        FROM forms 
        WHERE id = $1
      `, [milestone.rows[0].form_id]);
      
      if (form.rows.length > 0) {
        console.log('\n📋 SCHEMA DEL FORMULARIO:');
        const schema = form.rows[0].schema;
        if (schema && schema.sections) {
          console.log('✅ Schema tiene sections:', schema.sections.length);
          console.log('Primera sección:', JSON.stringify(schema.sections[0], null, 2));
        } else {
          console.log('⚠️ Schema vacío o sin sections:', JSON.stringify(schema, null, 2));
        }
      }
    } else {
      console.log('⚠️ No hay milestone con form_id, usando fallback (form_sections + form_fields)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkFormDetails();
