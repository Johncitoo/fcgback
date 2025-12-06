const { Client } = require('pg');

async function findAndCreateArturoApp() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('🔍 BUSCANDO USUARIO ARTURO\n');
  
  // Buscar usuario
  const userResult = await client.query(`
    SELECT id, email, full_name FROM users WHERE email = 'arturo321rodriguez@gmail.com'
  `);
  
  if (userResult.rows.length === 0) {
    console.log('❌ Usuario no encontrado. Creando usuario...\n');
    
    // Crear usuario
    const newUser = await client.query(`
      INSERT INTO users (id, email, full_name, role, created_at, updated_at)
      VALUES (gen_random_uuid(), 'arturo321rodriguez@gmail.com', 'arturo alessandri palma', 'APPLICANT', NOW(), NOW())
      RETURNING id
    `);
    
    var userId = newUser.rows[0].id;
    console.log(`✅ Usuario creado: ${userId}\n`);
  } else {
    var userId = userResult.rows[0].id;
    console.log(`✅ Usuario encontrado: ${userId}`);
    console.log(`   Email: ${userResult.rows[0].email}`);
    console.log(`   Nombre: ${userResult.rows[0].full_name}\n`);
  }
  
  const callId = '96177fc7-e733-4238-b846-5ab6a1fade09'; // Test 2029
  
  console.log('🚀 CREANDO APLICACIÓN\n');
  
  try {
    // Crear aplicación
    const appResult = await client.query(`
      INSERT INTO applications (id, applicant_id, call_id, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, 'DRAFT', NOW(), NOW())
      RETURNING id
    `, [userId, callId]);
    
    const applicationId = appResult.rows[0].id;
    console.log(`✅ Aplicación creada: ${applicationId}`);
    
    // Obtener hitos
    const milestones = await client.query(`
      SELECT id, name, order_index
      FROM milestones
      WHERE call_id = $1
      ORDER BY order_index
    `, [callId]);
    
    console.log(`\n📋 Creando progreso para ${milestones.rows.length} hitos:`);
    
    // Crear milestone_progress
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
    console.log(`📌 Usuario: ${userId}`);
    console.log(`\n💡 Ahora recarga la página de Arturo y deberías ver el primer hito con el botón "Completar formulario".`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await client.end();
}

findAndCreateArturoApp().catch(console.error);
