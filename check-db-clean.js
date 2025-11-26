const { Client } = require('pg');

const client = new Client({
  host: 'tramway.proxy.rlwy.net',
  port: 30026,
  user: 'postgres',
  password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
  database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function checkDBState() {
  await client.connect();
  
  console.log('\n🔍 Verificando estado de la BD...\n');
  
  // 1. Usuarios con email test
  const users = await client.query(`
    SELECT id, email, role, applicant_id, created_at 
    FROM users 
    WHERE email LIKE '%test.cl%' OR email LIKE '%placeholder%' 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  
  console.log('👤 Usuarios con emails de prueba:');
  if (users.rows.length === 0) {
    console.log('   (ninguno)\n');
  } else {
    users.rows.forEach(u => {
      console.log(`   ${u.email.padEnd(35)} | ${u.role.padEnd(10)} | ${u.created_at.toISOString().substring(0,19)}`);
    });
    console.log('');
  }
  
  // 2. Applicants con email test
  const applicants = await client.query(`
    SELECT id, email, first_name, last_name, created_at 
    FROM applicants 
    WHERE email LIKE '%test.cl%' 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  
  console.log('📋 Applicants con emails de prueba:');
  if (applicants.rows.length === 0) {
    console.log('   (ninguno)\n');
  } else {
    applicants.rows.forEach(a => {
      const name = `${a.first_name} ${a.last_name}`.padEnd(30);
      console.log(`   ${name} | ${a.email.padEnd(35)} | ${a.created_at.toISOString().substring(0,19)}`);
    });
    console.log('');
  }
  
  // 3. Invites usados
  const invites = await client.query(`
    SELECT id, code_hash, used_by_applicant, meta, created_at 
    FROM invites 
    WHERE code_hash LIKE '$argon2%' 
    ORDER BY created_at DESC 
    LIMIT 3
  `);
  
  console.log('🎫 Invites con argon2:');
  invites.rows.forEach((inv, i) => {
    const used = inv.used_by_applicant ? `Usado por: ${inv.used_by_applicant.substring(0,12)}...` : 'NO usado';
    console.log(`   ${i+1}. ${used.padEnd(30)} | Meta: ${JSON.stringify(inv.meta)}`);
  });
  
  console.log('\n✅ Verificación completada\n');
  
  await client.end();
}

checkDBState().catch(e => {
  console.error('❌ Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
