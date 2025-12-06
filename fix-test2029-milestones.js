const { Client } = require('pg');

async function fixTest2029() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('🔧 ARREGLANDO TEST 2029\n');
  
  const callId = '96177fc7-e733-4238-b846-5ab6a1fade09';
  const badMilestoneId = 'b5eb02ed-566e-4ce5-8741-6b21a812e083'; // PostulaciÃ³n (PENDING)
  const goodMilestoneId = 'a195e5a0-d855-4cef-bafe-dbeef0c6e0d9'; // 📝 Postulación (ACTIVE)
  const appId = '64a71894-ce93-40b0-8613-70d802484d82';
  
  try {
    // 1. Eliminar milestone_progress del hito duplicado malo
    console.log('1️⃣ Eliminando progreso del hito duplicado malo...');
    const deleteProgress = await client.query(`
      DELETE FROM milestone_progress 
      WHERE milestone_id = $1
      RETURNING id
    `, [badMilestoneId]);
    console.log(`   ✅ Eliminados ${deleteProgress.rowCount} registros de progreso\n`);
    
    // 2. Eliminar el hito duplicado malo
    console.log('2️⃣ Eliminando hito duplicado...');
    await client.query(`DELETE FROM milestones WHERE id = $1`, [badMilestoneId]);
    console.log(`   ✅ Hito "PostulaciÃ³n" eliminado\n`);
    
    // 3. Actualizar order_index de todos los hitos para que sean secuenciales
    console.log('3️⃣ Reordenando hitos...');
    const milestones = await client.query(`
      SELECT id, name, order_index 
      FROM milestones 
      WHERE call_id = $1 
      ORDER BY order_index, created_at
    `, [callId]);
    
    for (let i = 0; i < milestones.rows.length; i++) {
      const newOrder = i + 1;
      await client.query(
        `UPDATE milestones SET order_index = $1 WHERE id = $2`,
        [newOrder, milestones.rows[i].id]
      );
      console.log(`   ${newOrder}. ${milestones.rows[i].name}`);
    }
    console.log('');
    
    // 4. Activar el primer hito
    console.log('4️⃣ Activando primer hito...');
    await client.query(`UPDATE milestones SET status = 'ACTIVE' WHERE id = $1`, [goodMilestoneId]);
    console.log(`   ✅ Hito "📝 Postulación" activado\n`);
    
    // 5. Verificar si existe milestone_progress para el hito bueno
    const existingProgress = await client.query(`
      SELECT id FROM milestone_progress 
      WHERE application_id = $1 AND milestone_id = $2
    `, [appId, goodMilestoneId]);
    
    if (existingProgress.rows.length === 0) {
      console.log('5️⃣ Creando milestone_progress para el primer hito...');
      await client.query(`
        INSERT INTO milestone_progress (id, application_id, milestone_id, status, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, 'IN_PROGRESS', NOW(), NOW())
      `, [appId, goodMilestoneId]);
      console.log(`   ✅ Progress creado\n`);
    } else {
      console.log('5️⃣ Actualizando milestone_progress del primer hito...');
      await client.query(`
        UPDATE milestone_progress 
        SET status = 'IN_PROGRESS', updated_at = NOW()
        WHERE application_id = $1 AND milestone_id = $2
      `, [appId, goodMilestoneId]);
      console.log(`   ✅ Progress actualizado a IN_PROGRESS\n`);
    }
    
    // 6. Verificar resultado final
    console.log('📊 VERIFICACIÓN FINAL:\n');
    
    const finalMilestones = await client.query(`
      SELECT m.order_index, m.name, m.status, m.who_can_fill, m.form_id,
             mp.status as progress_status
      FROM milestones m
      LEFT JOIN milestone_progress mp ON mp.milestone_id = m.id AND mp.application_id = $1
      WHERE m.call_id = $2
      ORDER BY m.order_index
    `, [appId, callId]);
    
    finalMilestones.rows.forEach(m => {
      const shouldShow = 
        m.who_can_fill === 'APPLICANT' && 
        (m.progress_status === 'IN_PROGRESS' || m.progress_status === 'PENDING') &&
        m.status === 'ACTIVE' &&
        m.form_id !== null;
      
      const emoji = m.progress_status === 'IN_PROGRESS' ? '🔄' : m.progress_status === 'COMPLETED' ? '✅' : '⏸️';
      console.log(`${emoji} ${m.order_index}. ${m.name}`);
      console.log(`   Milestone Status: ${m.status}`);
      console.log(`   Progress Status: ${m.progress_status || 'No creado'}`);
      console.log(`   Form ID: ${m.form_id || 'NULL'}`);
      console.log(`   ${shouldShow ? '✅ MOSTRARÁ BOTÓN' : '⏹️ No mostrará botón'}`);
      console.log('');
    });
    
    console.log('✅ ¡ARREGLO COMPLETADO!');
    console.log('\n💡 Ahora recarga la página de Arturo (Ctrl+Shift+R)');
    console.log('   Deberías ver el hito "📝 Postulación" con el botón "Continuar formulario"');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
  
  await client.end();
}

fixTest2029().catch(console.error);
