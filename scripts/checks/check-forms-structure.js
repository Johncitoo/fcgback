const { Client } = require('pg');

async function checkFormsStructure() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('📋 ESTRUCTURA DE LA TABLA FORMS:\n');
  
  const columns = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'forms'
    ORDER BY ordinal_position
  `);
  
  columns.rows.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });
  
  console.log('\n\n🔍 FORMULARIOS EXISTENTES:\n');
  
  const forms = await client.query(`
    SELECT * FROM forms LIMIT 5
  `);
  
  console.log(`Total de formularios: ${forms.rowCount}`);
  forms.rows.forEach(f => {
    console.log(`\n  ID: ${f.id}`);
    console.log(`  Call ID: ${f.call_id}`);
    console.log(`  Schema: ${f.form_schema ? 'Sí tiene' : 'No tiene'}`);
  });
  
  await client.end();
}

checkFormsStructure().catch(console.error);
