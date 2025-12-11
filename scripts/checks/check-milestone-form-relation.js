const { Client } = require('pg');

async function checkMilestoneFormRelation() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('🔍 VERIFICANDO RELACIÓN HITOS-FORMULARIOS\n');
  
  // 1. Ver estructura de milestones
  console.log('📋 COLUMNAS DE MILESTONES:');
  const milestoneColumns = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'milestones'
    ORDER BY ordinal_position
  `);
  
  milestoneColumns.rows.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });
  
  // 2. Ver los hitos de Test 2029
  console.log('\n\n📋 HITOS DE TEST 2029:');
  const milestones = await client.query(`
    SELECT id, name, order_index, form_id, required
    FROM milestones
    WHERE call_id = '96177fc7-e733-4238-b846-5ab6a1fade09'
    ORDER BY order_index
  `);
  
  milestones.rows.forEach(m => {
    console.log(`\n${m.order_index}. ${m.name}`);
    console.log(`   - ID: ${m.id}`);
    console.log(`   - Required: ${m.required}`);
    console.log(`   - Form ID: ${m.form_id || '❌ NULL'}`);
  });
  
  // 3. Ver si hay formularios con esos IDs
  const formIds = milestones.rows
    .filter(m => m.form_id)
    .map(m => `'${m.form_id}'`)
    .join(',');
    
  if (formIds) {
    console.log('\n\n📝 FORMULARIOS ASOCIADOS:');
    const forms = await client.query(`
      SELECT id, name, schema
      FROM forms
      WHERE id IN (${formIds})
    `);
    
    forms.rows.forEach(f => {
      console.log(`\n  Form ID: ${f.id}`);
      console.log(`  Nombre: ${f.name || 'Sin nombre'}`);
      console.log(`  Schema: ${f.schema ? 'Sí tiene' : '❌ NULL'}`);
      if (f.schema) {
        console.log(`  Campos: ${f.schema.fields?.length || 0}`);
      }
    });
  } else {
    console.log('\n\n❌ NINGÚN HITO TIENE form_id ASIGNADO');
  }
  
  await client.end();
}

checkMilestoneFormRelation().catch(console.error);
