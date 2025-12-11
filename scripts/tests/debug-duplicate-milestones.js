const { Client } = require('pg');

async function debugDuplicateMilestones() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  const callId = '96177fc7-e733-4238-b846-5ab6a1fade09';
  const appId = '64a71894-ce93-40b0-8613-70d802484d82';
  
  console.log('🔍 VERIFICANDO HITOS DUPLICADOS\n');
  
  // Ver todos los hitos de Test 2029
  const milestones = await client.query(`
    SELECT id, name, order_index, who_can_fill, status, form_id
    FROM milestones
    WHERE call_id = $1
    ORDER BY order_index
  `, [callId]);
  
  console.log(`📋 HITOS EN TEST 2029 (${milestones.rows.length} total):\n`);
  
  const seenOrders = new Map();
  milestones.rows.forEach(m => {
    console.log(`${m.order_index}. ${m.name}`);
    console.log(`   ID: ${m.id}`);
    console.log(`   Who Can Fill: ${m.who_can_fill}`);
    console.log(`   Status: ${m.status}`);
    console.log(`   Form ID: ${m.form_id || '❌ NULL'}`);
    
    if (seenOrders.has(m.order_index)) {
      console.log(`   ⚠️ DUPLICADO! Ya existe otro hito con order_index ${m.order_index}`);
    }
    seenOrders.set(m.order_index, m.id);
    console.log('');
  });
  
  // Ver el progreso de Arturo
  console.log('\n📊 PROGRESO DE ARTURO:\n');
  
  const progress = await client.query(`
    SELECT mp.id, mp.status, mp.milestone_id,
           m.name, m.order_index, m.who_can_fill, m.status as m_status, m.form_id
    FROM milestone_progress mp
    JOIN milestones m ON m.id = mp.milestone_id
    WHERE mp.application_id = $1
    ORDER BY m.order_index
  `, [appId]);
  
  progress.rows.forEach(p => {
    const shouldShow = 
      p.who_can_fill === 'APPLICANT' && 
      (p.status === 'IN_PROGRESS' || p.status === 'PENDING') &&
      p.m_status === 'ACTIVE' &&
      p.form_id !== null;
    
    console.log(`${p.order_index}. ${p.name}`);
    console.log(`   Progress Status: ${p.status}`);
    console.log(`   Milestone Status: ${p.m_status}`);
    console.log(`   Who Can Fill: ${p.who_can_fill}`);
    console.log(`   Form ID: ${p.form_id || '❌ NULL'}`);
    console.log(`   ${shouldShow ? '✅ DEBE MOSTRAR BOTÓN' : '❌ NO MUESTRA BOTÓN'}`);
    console.log('');
  });
  
  await client.end();
}

debugDuplicateMilestones().catch(console.error);
