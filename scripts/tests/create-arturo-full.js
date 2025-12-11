const { Client } = require('pg');

async function createArturoApplicantAndApp() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('🚀 CREANDO POSTULANTE Y APLICACIÓN PARA ARTURO\n');
  
  const userId = '3fb3f91d-b475-4eac-b847-4af8b825fcff';
  const callId = '96177fc7-e733-4238-b846-5ab6a1fade09'; // Test 2029
  
  try {
    // 1. Verificar si ya existe en applicants
    const existingApplicant = await client.query('SELECT id FROM applicants WHERE id = $1', [userId]);
    
    if (existingApplicant.rows.length === 0) {
      console.log('📝 Creando registro en applicants...');
      await client.query(`
        INSERT INTO applicants (
          id, first_name, last_name, email, 
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW())
      `, [
        userId, 
        'arturo', 
        'alessandri palma', 
        'arturo321rodriguez@gmail.com'
      ]);
      console.log('✅ Registro en applicants creado\n');
    } else {
      console.log('✅ Ya existe en applicants\n');
    }
    
    // 2. Crear aplicación
    console.log('📋 Creando aplicación...');
    const appResult = await client.query(`
      INSERT INTO applications (id, applicant_id, call_id, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, 'DRAFT', NOW(), NOW())
      RETURNING id
    `, [userId, callId]);
    
    const applicationId = appResult.rows[0].id;
    console.log(`✅ Aplicación creada: ${applicationId}\n`);
    
    // 3. Obtener hitos
    const milestones = await client.query(`
      SELECT id, name, order_index
      FROM milestones
      WHERE call_id = $1
      ORDER BY order_index
    `, [callId]);
    
    console.log(`📊 Creando progreso para ${milestones.rows.length} hitos:`);
    
    // 4. Crear milestone_progress
    for (let i = 0; i < milestones.rows.length; i++) {
      const milestone = milestones.rows[i];
      const status = i === 0 ? 'IN_PROGRESS' : 'PENDING';
      
      await client.query(`
        INSERT INTO milestone_progress (id, application_id, milestone_id, status, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
      `, [applicationId, milestone.id, status]);
      
      const emoji = status === 'IN_PROGRESS' ? '🔄' : '⏸️';
      console.log(`   ${emoji} ${milestone.order_index}. ${milestone.name} - ${status}`);
    }
    
    console.log('\n✅ ¡COMPLETADO!');
    console.log(`\n📌 Application ID: ${applicationId}`);
    console.log(`📌 Usuario/Applicant ID: ${userId}`);
    console.log(`📌 Convocatoria: Test 2029`);
    console.log(`\n💡 Ahora recarga la página de Arturo. Deberías ver:`);
    console.log(`   - Progreso: 0% completado`);
    console.log(`   - Primer hito "Postulación" en progreso`);
    console.log(`   - Botón "Completar formulario" o "Continuar formulario"`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
  
  await client.end();
}

createArturoApplicantAndApp().catch(console.error);
