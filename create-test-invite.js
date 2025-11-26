// Script para crear código de invitación de prueba
const { Client } = require('pg');
const argon2 = require('argon2');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

// Generar código único
function generateCode() {
  return 'TEST-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Hashear código usando argon2 (mismo método que backend)
async function hashInviteCode(rawCode) {
  const normalized = rawCode.trim().toUpperCase();
  return await argon2.hash(normalized);
}

async function createTestInvite() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Obtener la convocatoria activa
    const activeCallResult = await client.query(`
      SELECT id, name, year
      FROM calls 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (activeCallResult.rows.length === 0) {
      console.log('❌ No hay convocatorias activas');
      return;
    }

    const activeCall = activeCallResult.rows[0];
    console.log(`📋 Convocatoria activa encontrada: ${activeCall.name} (${activeCall.year})\n`);

    const callId = activeCall.id;
    const code = generateCode();
    const codeHash = await hashInviteCode(code);
    
    // Fecha de expiración: 30 días desde ahora
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Insertar invitación con code_hash
    const result = await client.query(`
      INSERT INTO invites (call_id, code_hash, expires_at, created_at, meta)
      VALUES ($1, $2, $3, NOW(), $4)
      RETURNING id
    `, [callId, codeHash, expiresAt, JSON.stringify({ testEmail: 'postulante.prueba@test.cl' })]);

    console.log('✅ Código de invitación creado:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email sugerido: postulante.prueba@test.cl`);
    console.log(`🎫 Código:         ${code}`);
    console.log(`📅 Expira:         ${expiresAt.toLocaleDateString()}`);
    console.log(`🎯 Convocatoria:   ${activeCall.name} (${activeCall.year})`);
    console.log(`🆔 Call ID:        ${activeCall.id}`);
    console.log(`🆔 Invite ID:      ${result.rows[0].id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Usa estos datos para probar el flujo completo:\n');
    console.log('1. Ir a https://fcgfront.vercel.app/#/login');
    console.log(`2. Ingresar email: postulante.prueba@test.cl`);
    console.log(`3. Ingresar código: ${code}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

createTestInvite();
