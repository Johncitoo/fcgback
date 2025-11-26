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

async function testHashVerification() {
  await client.connect();
  
  const code = 'TEST-SCU7LNOB';
  const normalized = code.trim().toUpperCase();
  
  console.log('\n🔍 Probando verificación de hash...\n');
  console.log('Código:', code);
  console.log('Normalizado:', normalized);
  
  // Obtener el invite de la BD
  const result = await client.query(`
    SELECT id, code_hash, meta, expires_at 
    FROM invites 
    WHERE code_hash LIKE '$argon2%' 
    ORDER BY created_at DESC 
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    console.log('❌ No se encontró invite con argon2');
    await client.end();
    return;
  }
  
  const invite = result.rows[0];
  console.log('\n📋 Invite en BD:');
  console.log('ID:', invite.id);
  console.log('Hash:', invite.code_hash.substring(0, 60) + '...');
  console.log('Meta:', invite.meta);
  
  // Intentar verificar
  console.log('\n🔐 Verificando hash...');
  try {
    const isValid = await argon2.verify(invite.code_hash, normalized);
    console.log('✅ Resultado:', isValid ? 'VÁLIDO' : 'INVÁLIDO');
    
    if (!isValid) {
      console.log('\n⚠️ El hash NO coincide. Posibles causas:');
      console.log('1. El código TEST-SCU7LNOB fue hasheado con otro valor');
      console.log('2. El código en BD es diferente');
      console.log('\n💡 Solución: Crear nuevo invite con create-test-invite.js');
    } else {
      console.log('\n✅ El hash SÍ coincide. El problema está en otro lado.');
    }
  } catch (error) {
    console.log('❌ Error al verificar:', error.message);
  }
  
  await client.end();
}

testHashVerification().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
