const { Client } = require('pg');

async function checkArturoInviteAndApp() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('🔍 VERIFICANDO ARTURO\n');
  
  // 1. Usuario
  const user = await client.query(`
    SELECT id, email, full_name, role
    FROM users
    WHERE email = 'arturo321rodriguez@gmail.com'
  `);
  
  if (user.rows.length === 0) {
    console.log('❌ Usuario no existe');
    await client.end();
    return;
  }
  
  console.log('👤 USUARIO:');
  console.log(`   ID: ${user.rows[0].id}`);
  console.log(`   Email: ${user.rows[0].email}`);
  console.log(`   Nombre: ${user.rows[0].full_name}`);
  console.log(`   Role: ${user.rows[0].role}`);
  
  const userId = user.rows[0].id;
  
  // 2. Invitación
  console.log('\n📨 INVITACIÓN:');
  const invite = await client.query(`
    SELECT id, code_hash, call_id, used_at, expires_at, meta
    FROM invites
    WHERE (meta->>'email')::text = 'arturo321rodriguez@gmail.com'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  
  if (invite.rows.length > 0) {
    const inv = invite.rows[0];
    console.log(`   ID: ${inv.id}`);
    console.log(`   Call ID: ${inv.call_id}`);
    console.log(`   Used At: ${inv.used_at || 'No usado'}`);
    console.log(`   Expires At: ${inv.expires_at}`);
    console.log(`   Meta: ${JSON.stringify(inv.meta, null, 2)}`);
  } else {
    console.log('   ❌ No tiene invitación');
  }
  
  // 3. Aplicación
  console.log('\n📋 APLICACIÓN:');
  const app = await client.query(`
    SELECT id, call_id, status, created_at
    FROM applications
    WHERE applicant_id = $1
  `, [userId]);
  
  if (app.rows.length > 0) {
    app.rows.forEach(a => {
      console.log(`   ID: ${a.id}`);
      console.log(`   Call ID: ${a.call_id}`);
      console.log(`   Status: ${a.status}`);
      console.log(`   Created: ${a.created_at}`);
    });
  } else {
    console.log('   ❌ NO TIENE APLICACIÓN');
    console.log('\n💡 SOLUCIÓN:');
    console.log('   Arturo necesita usar el código de invitación para crear su aplicación.');
    console.log('   Debe ir a la página de onboarding y usar el código TEST123');
  }
  
  await client.end();
}

checkArturoInviteAndApp().catch(console.error);
