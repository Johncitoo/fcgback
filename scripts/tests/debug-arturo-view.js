const { Client } = require('pg');

async function debugArturoView() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('🔍 DEBUG: QUÉ VE ARTURO PALMA\n');
  
  // 1. Usuario y aplicación
  const user = await client.query(`
    SELECT u.id, u.email, u.full_name, u.role,
           a.id as app_id, a.call_id, a.status as app_status
    FROM users u
    LEFT JOIN applications a ON a.applicant_id = u.id
    WHERE u.email = 'arturo321rodriguez@gmail.com'
  `);
  
  console.log('👤 USUARIO ARTURO:');
  console.log(`   Email: ${user.rows[0].email}`);
  console.log(`   ID: ${user.rows[0].id}`);
  console.log(`   Role: ${user.rows[0].role}`);
  console.log(`   Application ID: ${user.rows[0].app_id}`);
  console.log(`   Application Status: ${user.rows[0].app_status}`);
  
  const appId = user.rows[0].app_id;
  
  // 2. Progreso de hitos
  console.log('\n📊 PROGRESO DE HITOS:');
  const progress = await client.query(`
    SELECT mp.id as mp_id, mp.status, mp.milestone_id,
           m.name, m.order_index, m.who_can_fill, m.status as milestone_status, m.form_id
    FROM milestone_progress mp
    JOIN milestones m ON m.id = mp.milestone_id
    WHERE mp.application_id = $1
    ORDER BY m.order_index
  `, [appId]);
  
  progress.rows.forEach(p => {
    const emoji = p.status === 'IN_PROGRESS' ? '🔄' : p.status === 'COMPLETED' ? '✅' : '⏸️';
    console.log(`\n${emoji} ${p.order_index}. ${p.name}`);
    console.log(`   Progress Status: ${p.status}`);
    console.log(`   Milestone Status: ${p.milestone_status}`);
    console.log(`   Who Can Fill: ${p.who_can_fill}`);
    console.log(`   Form ID: ${p.form_id || '❌ NULL'}`);
    console.log(`   Progress ID (mp_id): ${p.mp_id}`);
    
    // Verificar si debe mostrar botón
    const shouldShowButton = 
      p.who_can_fill === 'APPLICANT' && 
      (p.status === 'IN_PROGRESS' || p.status === 'PENDING') &&
      p.milestone_status === 'ACTIVE' &&
      p.form_id !== null;
    
    console.log(`   ${shouldShowButton ? '✅ DEBE MOSTRAR BOTÓN' : '❌ NO MUESTRA BOTÓN'}`);
  });
  
  // 3. Verificar si el formulario tiene campos
  const firstMilestone = progress.rows[0];
  if (firstMilestone.form_id) {
    console.log('\n\n📝 CONTENIDO DEL FORMULARIO:');
    
    // Buscar call_id desde el milestone
    const milestone = await client.query(`
      SELECT call_id FROM milestones WHERE id = $1
    `, [firstMilestone.milestone_id]);
    
    const callId = milestone.rows[0].call_id;
    console.log(`   Call ID: ${callId}`);
    
    // Buscar secciones
    const sections = await client.query(`
      SELECT id, title, "order" FROM form_sections 
      WHERE call_id = $1 
      ORDER BY "order"
    `, [callId]);
    
    console.log(`   Secciones: ${sections.rows.length}`);
    
    if (sections.rows.length > 0) {
      for (const section of sections.rows) {
        const fields = await client.query(`
          SELECT id, name, label, type, required 
          FROM form_fields 
          WHERE call_id = $1 AND section_id = $2
          ORDER BY "order"
        `, [callId, section.id]);
        
        console.log(`\n   📁 Sección: "${section.title}"`);
        console.log(`      Campos: ${fields.rows.length}`);
        fields.rows.forEach(f => {
          console.log(`      - ${f.label} (${f.type}) ${f.required ? '⭐' : ''}`);
        });
      }
    } else {
      console.log('   ❌ NO HAY SECCIONES - FORMULARIO VACÍO');
    }
  }
  
  await client.end();
}

debugArturoView().catch(console.error);
