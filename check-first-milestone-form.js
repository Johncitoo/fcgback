const { Client } = require('pg');

async function checkMilestoneForm() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('🔍 VERIFICANDO FORMULARIO DEL PRIMER HITO\n');
  
  // 1. Ver hitos de Test 2029
  const milestones = await client.query(`
    SELECT m.id, m.name, m.order_index, m.milestone_type, m.has_form,
           f.id as form_id, f.form_schema
    FROM milestones m
    LEFT JOIN forms f ON f.milestone_id = m.id
    WHERE m.call_id = '96177fc7-e733-4238-b846-5ab6a1fade09'
    ORDER BY m.order_index
  `);
  
  console.log('📋 HITOS DE TEST 2029:');
  milestones.rows.forEach(m => {
    console.log(`\n${m.order_index}. ${m.name}`);
    console.log(`   - ID: ${m.id}`);
    console.log(`   - Tipo: ${m.milestone_type}`);
    console.log(`   - Tiene formulario: ${m.has_form}`);
    console.log(`   - Form ID: ${m.form_id || '❌ NO HAY FORM'}`);
    if (m.form_schema) {
      const schema = JSON.parse(m.form_schema);
      console.log(`   - Campos en schema: ${schema.fields?.length || 0}`);
    }
  });
  
  // 2. Ver el progreso de Arturo
  console.log('\n\n👤 PROGRESO DE ARTURO:');
  const progress = await client.query(`
    SELECT mp.id, mp.status, mp.milestone_id,
           m.name, m.order_index, m.has_form
    FROM milestone_progress mp
    JOIN milestones m ON m.id = mp.milestone_id
    WHERE mp.application_id = '04954eed-5b40-4a89-ab40-6f513fffd78e'
    ORDER BY m.order_index
  `);
  
  progress.rows.forEach(p => {
    console.log(`\n${p.order_index}. ${p.name} - ${p.status}`);
    console.log(`   - Progress ID: ${p.id}`);
    console.log(`   - Milestone ID: ${p.milestone_id}`);
    console.log(`   - Has form: ${p.has_form}`);
  });
  
  await client.end();
}

checkMilestoneForm().catch(console.error);
