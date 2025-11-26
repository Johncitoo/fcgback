/**
 * Script para probar la creación de invitaciones con el nuevo endpoint
 */

const API_BASE = 'https://fcgback-production.up.railway.app/api';

async function testInviteCreation() {
  console.log('🧪 Probando creación de invitaciones...\n');

  // Login como admin
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'john@example.com',
      password: 'admin123',
    }),
  });

  if (!loginRes.ok) {
    console.error('❌ Error en login');
    return;
  }

  const { access_token } = await loginRes.json();
  console.log('✅ Login exitoso\n');

  const headers = {
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
  };

  // Buscar convocatoria activa
  const callsRes = await fetch(`${API_BASE}/calls?status=OPEN`, { headers });
  const calls = await callsRes.json();
  const activeCall = calls[0];

  if (!activeCall) {
    console.error('❌ No hay convocatorias activas');
    return;
  }

  console.log(`📋 Usando convocatoria: ${activeCall.name}\n`);

  // TEST 1: Invitación con envío automático
  console.log('🧪 TEST 1: Invitación con envío automático (email)');
  const autoInvite = await fetch(`${API_BASE}/invites`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      callId: activeCall.id,
      firstName: 'María',
      lastName: 'González',
      email: 'maria.test@example.com',
      sendEmail: true,
    }),
  });

  if (autoInvite.ok) {
    const result = await autoInvite.json();
    console.log('✅ Invitación creada (automática)');
    console.log(`   ID: ${result.id}`);
    console.log(`   Código: ${result.code || result.invitationCode || 'hidden'}`);
    console.log(`   Meta:`, result.meta);
    console.log('   📧 Email enviado automáticamente\n');
  } else {
    console.error('❌ Error:', await autoInvite.text());
  }

  // TEST 2: Invitación con copia manual
  console.log('🧪 TEST 2: Invitación con copia manual');
  const manualInvite = await fetch(`${API_BASE}/invites`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      callId: activeCall.id,
      firstName: 'Pedro',
      lastName: 'Ramírez',
      email: 'pedro.test@example.com',
      sendEmail: false,
    }),
  });

  if (manualInvite.ok) {
    const result = await manualInvite.json();
    console.log('✅ Invitación creada (manual)');
    console.log(`   ID: ${result.id}`);
    console.log(`   Código: ${result.code || result.invitationCode}`);
    console.log(`   Meta:`, result.meta);
    console.log('   📋 Código listo para copiar\n');
  } else {
    console.error('❌ Error:', await manualInvite.text());
  }

  // TEST 3: Invitación sin nombres (compatibilidad)
  console.log('🧪 TEST 3: Invitación sin nombres (compatibilidad)');
  const simpleInvite = await fetch(`${API_BASE}/invites`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      callId: activeCall.id,
      email: 'simple.test@example.com',
      sendEmail: false,
    }),
  });

  if (simpleInvite.ok) {
    const result = await simpleInvite.json();
    console.log('✅ Invitación creada (sin nombres)');
    console.log(`   ID: ${result.id}`);
    console.log(`   Código: ${result.code || result.invitationCode}`);
    console.log(`   Meta:`, result.meta);
    console.log('   ✅ Compatibilidad mantenida\n');
  } else {
    console.error('❌ Error:', await simpleInvite.text());
  }

  console.log('\n🎉 Pruebas completadas');
}

testInviteCreation().catch(console.error);
