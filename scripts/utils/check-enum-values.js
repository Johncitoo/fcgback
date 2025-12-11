const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function checkEnums() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway DB\n');

    // Verificar application_status
    const statusResult = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'application_status') 
      ORDER BY enumsortorder
    `);

    console.log('📊 Valores del enum application_status:');
    statusResult.rows.forEach(r => console.log('  -', r.enumlabel));

    // Verificar user_role
    const roleResult = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role') 
      ORDER BY enumsortorder
    `);

    console.log('\n📊 Valores del enum user_role:');
    roleResult.rows.forEach(r => console.log('  -', r.enumlabel));

    // Verificar call_status
    const callResult = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'call_status') 
      ORDER BY enumsortorder
    `);

    console.log('\n📊 Valores del enum call_status:');
    callResult.rows.forEach(r => console.log('  -', r.enumlabel));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkEnums();
