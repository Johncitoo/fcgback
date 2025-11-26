// Script para crear código de invitación de prueba
const { Client } = require('pg');
const { createHmac } = require('crypto');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

// Generar código único
function generateCode() {
  return 'TEST-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Hashear código (mismo método que backend)
function hashInviteCode(rawCode) {
  const INVITE_CODE_PEPPER = 'change-me'; // Default del backend
  const normalized = rawCode.trim().toUpperCase();
  return createHmac('sha256', INVITE_CODE_PEPPER)
    .update(normalized)
    .digest('hex');
}

async function createTestInvite() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // ID de convocatoria activa
    const callId = '5e33c8ee-52a7-4736-89a4-043845ea7f1a';
    const code = generateCode();
    const codeHash = hashInviteCode(code);
    
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
    console.log(`🎯 Convocatoria:   Becas FCG 2026`);
    console.log(`🆔 Invite ID:      ${result.rows[0].id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Usa estos datos para probar el flujo completo:\n');
    console.log('1. Ir a http://localhost:5173/#/enter-invite-code');
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
