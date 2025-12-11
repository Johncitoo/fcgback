const argon2 = require('argon2');
const { Client } = require('pg');

const client = new Client({
  host: 'tramway.proxy.rlwy.net',
  port: 30026,
  user: 'postgres',
  password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
  database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function simulateValidateInviteCode() {
  await client.connect();
  
  const code = 'TEST-SCU7LNOB';
  const email = 'temp@placeholder.com'; // Lo que envía el AuthService
  const normalized = code.trim().toUpperCase();
  
  console.log('\n🧪 Simulando validateInviteCode...\n');
  console.log('Input:');
  console.log('  code:', code);
  console.log('  email:', email);
  console.log('  normalized:', normalized);
  
  // PASO 1: Obtener todos los invites
  console.log('\n📋 PASO 1: Obtener invites...');
  const allInvites = await client.query(`
    SELECT id, code_hash, expires_at, meta, used_by_applicant, call_id
    FROM invites 
    WHERE expires_at > NOW() OR expires_at IS NULL
  `);
  
  console.log(`   Total invites: ${allInvites.rows.length}`);
  
  // PASO 2: Buscar el que coincida con el hash
  console.log('\n🔐 PASO 2: Buscar invite con hash coincidente...');
  let matchedInvite = null;
  
  for (const inv of allInvites.rows) {
    try {
      const isValid = await argon2.verify(inv.code_hash, normalized);
      if (isValid) {
        matchedInvite = inv;
        console.log('   ✅ ENCONTRADO!');
        console.log('   ID:', inv.id);
        console.log('   Meta:', inv.meta);
        console.log('   Call ID:', inv.call_id);
        break;
      }
    } catch (e) {
      // Ignorar hashes inválidos
    }
  }
  
  if (!matchedInvite) {
    console.log('   ❌ No se encontró invite con hash coincidente');
    await client.end();
    return;
  }
  
  // PASO 3: Verificar expiración
  console.log('\n⏰ PASO 3: Verificar expiración...');
  if (matchedInvite.expires_at && new Date(matchedInvite.expires_at) < new Date()) {
    console.log('   ❌ El código ha expirado');
    await client.end();
    return;
  }
  console.log('   ✅ No expirado');
  
  // PASO 4: Resolver email
  console.log('\n📧 PASO 4: Resolver email...');
  let finalEmail = email;
  
  if (!email || email === 'temp@placeholder.com' || email.includes('@pending.local')) {
    console.log('   Email temporal detectado:', email);
    const metaEmail = matchedInvite.meta?.testEmail || matchedInvite.meta?.email;
    console.log('   Meta email:', metaEmail);
    
    if (metaEmail) {
      finalEmail = metaEmail;
      console.log('   ✅ Email obtenido del meta:', finalEmail);
    } else if (!email) {
      console.log('   ❌ No hay email en meta y no se proporcionó email');
      await client.end();
      return;
    }
  }
  
  // PASO 5: Verificar si ya tiene applicant
  console.log('\n👤 PASO 5: Verificar applicant existente...');
  if (matchedInvite.used_by_applicant) {
    console.log('   ⚠️ Ya tiene applicant vinculado:', matchedInvite.used_by_applicant);
  } else {
    console.log('   ✅ No tiene applicant (primera vez)');
  }
  
  // PASO 6: Buscar/Crear usuario
  console.log('\n🔍 PASO 6: Buscar usuario por email...');
  const userResult = await client.query(`
    SELECT id, email, full_name, role 
    FROM users 
    WHERE email = $1
  `, [finalEmail]);
  
  if (userResult.rows.length > 0) {
    console.log('   ✅ Usuario ya existe:', userResult.rows[0].email);
  } else {
    console.log('   ℹ️ Usuario no existe, se crearía en transacción');
  }
  
  console.log('\n✅ SIMULACIÓN COMPLETADA - No se detectó ningún error lógico');
  console.log('\n💡 El error 500 probablemente es:');
  console.log('   1. Error de base de datos (constraint, foreign key)');
  console.log('   2. Error en transacción (deadlock, timeout)');
  console.log('   3. Error al enviar email (SMTP)');
  console.log('\n🔧 Sugerencia: Revisa los logs de Railway para ver el stack trace');
  
  await client.end();
}

simulateValidateInviteCode().catch(e => {
  console.error('❌ Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
