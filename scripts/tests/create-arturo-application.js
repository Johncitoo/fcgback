const { Client } = require('pg');

async function createArturoApplication() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('🚀 CREANDO APLICACIÓN PARA ARTURO\n');
  
  const userId = '3fb3f91d-b475-4eac-b847-4af8b825fcff';
  const callId = '96177fc7-e733-4238-b846-5ab6a1fade09'; // Test 2029
  
  try {
    // 1. Crear aplicación
    const appResult = await client.query(`
      INSERT INTO applications (id, applicant_id, call_id, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, 'DRAFT', NOW(), NOW())
      RETURNING id
    `, [userId, callId]);
    
    const applicationId = appResult.rows[0].id;
    console.log(`✅ Aplicación creada: ${applicationId}`);
    
    // 2. Obtener hitos de la convocatoria
    const milestones = await client.query(`
      SELECT id, name, order_index
      FROM milestones
      WHERE call_id = $1
      ORDER BY order_index
    `, [callId]);
    
    console.log(`\n📋 Creando progreso para ${milestones.rows.length} hitos:`);
    
    // 3. Crear milestone_progress
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
    
    console.log('\n✅ COMPLETADO!');
    console.log(`\n📌 Application ID: ${applicationId}`);
    console.log(`📌 Usuario: Arturo Palma (${userId})`);
    console.log(`📌 Convocatoria: Test 2029 (${callId})`);
    console.log(`\n💡 Ahora Arturo puede ver el formulario del primer hito en su dashboard.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await client.end();
}

createArturoApplication().catch(console.error);
