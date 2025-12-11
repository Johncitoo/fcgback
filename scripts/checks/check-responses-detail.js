const { Client } = require('pg');

async function checkResponses() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado\n');

    // 1. Ver estructura de la tabla applications
    console.log('📊 COLUMNAS DE LA TABLA APPLICATIONS:');
    const appCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'applications' 
      ORDER BY ordinal_position
    `);
    console.table(appCols.rows);

    // 2. Ver una aplicación completa
    console.log('\n📋 EJEMPLO DE APLICACIÓN COMPLETA:');
    const app = await client.query(`
      SELECT 
        id,
        status,
        academic,
        household,
        participation,
        texts,
        builder_extra
      FROM applications 
      WHERE call_id = '96177fc7-e733-4238-b846-5ab6a1fade09'
      LIMIT 1
    `);
    
    if (app.rows.length > 0) {
      console.log('ID:', app.rows[0].id);
      console.log('Status:', app.rows[0].status);
      console.log('\nAcademic:', JSON.stringify(app.rows[0].academic, null, 2));
      console.log('\nHousehold:', JSON.stringify(app.rows[0].household, null, 2));
      console.log('\nParticipation:', JSON.stringify(app.rows[0].participation, null, 2));
      console.log('\nTexts:', JSON.stringify(app.rows[0].texts, null, 2));
      console.log('\nBuilder Extra:', JSON.stringify(app.rows[0].builder_extra, null, 2));
    } else {
      console.log('No hay aplicaciones');
    }

    // 3. Verificar endpoint de respuestas
    console.log('\n\n🔍 VERIFICANDO DÓNDE ESTÁN LAS RESPUESTAS:');
    
    // Opción 1: form_responses (nuevo sistema)
    const formResponses = await client.query(`
      SELECT COUNT(*) as count 
      FROM form_responses
    `);
    console.log(`\nform_responses (nuevo): ${formResponses.rows[0].count} registros`);

    // Opción 2: Dentro de applications.builder_extra o applications.texts
    const appsWithData = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE builder_extra IS NOT NULL AND builder_extra::text != '{}') as with_builder_extra,
        COUNT(*) FILTER (WHERE texts IS NOT NULL AND texts::text != '{}') as with_texts,
        COUNT(*) FILTER (WHERE academic IS NOT NULL AND academic::text != '{}') as with_academic
      FROM applications
      WHERE call_id = '96177fc7-e733-4238-b846-5ab6a1fade09'
    `);
    console.log('\nAplicaciones con datos en columnas JSONB:');
    console.table(appsWithData.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkResponses();
