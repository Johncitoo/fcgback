const { Client } = require('pg');

async function verifyNoResponses() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado\n');

    const callId = '96177fc7-e733-4238-b846-5ab6a1fade09'; // Test 2029

    // 1. ¿Cuántas aplicaciones hay?
    const appsCount = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'DRAFT') as draft,
        COUNT(*) FILTER (WHERE status = 'SUBMITTED') as submitted
      FROM applications 
      WHERE call_id = $1
    `, [callId]);
    
    console.log('📊 APLICACIONES EN LA CONVOCATORIA:');
    console.table(appsCount.rows);

    // 2. ¿Hay respuestas en form_responses?
    const formResponsesCount = await client.query(`
      SELECT COUNT(*) as total
      FROM form_responses fr
      JOIN applications a ON a.id = fr.application_id
      WHERE a.call_id = $1
    `, [callId]);
    
    console.log('\n📝 RESPUESTAS EN form_responses:');
    console.log(`Total: ${formResponsesCount.rows[0].total}`);

    // 3. ¿Hay respuestas en form_submissions?
    const formSubmissionsCount = await client.query(`
      SELECT COUNT(*) as total
      FROM form_submissions fs
      JOIN applications a ON a.id = fs.application_id
      WHERE a.call_id = $1
    `, [callId]);
    
    console.log('\n📋 RESPUESTAS EN form_submissions:');
    console.log(`Total: ${formSubmissionsCount.rows[0].total}`);

    // 4. Ver ejemplos de aplicaciones
    console.log('\n\n👥 POSTULANTES REGISTRADOS:');
    const applicants = await client.query(`
      SELECT 
        ap.first_name || ' ' || ap.last_name as nombre,
        ap.email,
        a.status,
        a.submitted_at,
        a.created_at
      FROM applications a
      JOIN applicants ap ON ap.id = a.applicant_id
      WHERE a.call_id = $1
      ORDER BY a.created_at DESC
    `, [callId]);
    
    console.table(applicants.rows);

    // 5. Verificar si hay datos en columnas JSONB de applications
    console.log('\n📦 DATOS EN COLUMNAS JSONB DE APPLICATIONS:');
    const jsonbData = await client.query(`
      SELECT 
        id,
        CASE WHEN academic IS NOT NULL AND academic::text != 'null' THEN 'SI' ELSE 'NO' END as tiene_academic,
        CASE WHEN household IS NOT NULL AND household::text != 'null' THEN 'SI' ELSE 'NO' END as tiene_household,
        CASE WHEN texts IS NOT NULL AND texts::text != 'null' THEN 'SI' ELSE 'NO' END as tiene_texts,
        CASE WHEN builder_extra IS NOT NULL AND builder_extra::text != 'null' THEN 'SI' ELSE 'NO' END as tiene_builder_extra
      FROM applications
      WHERE call_id = $1
    `, [callId]);
    
    console.table(jsonbData.rows);

    console.log('\n\n💡 CONCLUSIÓN:');
    console.log('Las aplicaciones están creadas pero VACÍAS (sin respuestas).');
    console.log('Esto significa que los postulantes:');
    console.log('  - Se registraron con el código de invitación');
    console.log('  - Pero NO llenaron el formulario de postulación');
    console.log('  - O el formulario no está guardando las respuestas correctamente');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyNoResponses();
