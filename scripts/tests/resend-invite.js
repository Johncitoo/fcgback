/**
 * Script para reenviar invitación a un email específico
 * INSTRUCCIONES:
 * 1. Abre el navegador en fcgfront.vercel.app y haz login como admin
 * 2. Abre DevTools (F12) → Console
 * 3. Escribe: localStorage.getItem('fcg.access_token')
 * 4. Copia el token (sin las comillas)
 * 5. Pégalo abajo donde dice "TU_TOKEN_AQUI"
 */

const API_BASE = 'https://fcgback-production.up.railway.app/api';
const ACCESS_TOKEN = process.env.ADMIN_TOKEN || 'TU_TOKEN_AQUI';

async function resendInvite() {
  console.log('🔄 Reenviando invitación a amparitomio@gmail.com...\n');

  if (ACCESS_TOKEN === 'TU_TOKEN_AQUI') {
    console.error('❌ ERROR: Necesitas configurar el token de admin');
    console.log('\n📝 Sigue estos pasos:');
    console.log('1. Abre fcgfront.vercel.app y haz login como admin');
    console.log('2. Abre DevTools (F12) → Console');
    console.log('3. Escribe: localStorage.getItem("fcg.access_token")');
    console.log('4. Copia el token (sin las comillas)');
    console.log('5. Ejecuta: $env:ADMIN_TOKEN="tu_token"; node resend-invite.js\n');
    return;
  }

  console.log('✅ Usando token de admin\n');

  const headers = {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
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

  // Buscar el postulante por email
  console.log('🔍 Buscando postulante...');
  const applicantRes = await fetch(
    `${API_BASE}/applicants?q=amparitomio@gmail.com`,
    { headers }
  );
  
  const applicantsData = await applicantRes.json();
  const applicants = Array.isArray(applicantsData) ? applicantsData : applicantsData.data || [];
  
  const applicant = applicants.find(a => a.email === 'amparitomio@gmail.com');

  if (!applicant) {
    console.error('❌ No se encontró el postulante con ese email');
    console.log('Postulantes encontrados:', applicants.map(a => a.email));
    return;
  }

  console.log(`✅ Postulante encontrado: ${applicant.firstName} ${applicant.lastName}\n`);

  // Crear nueva invitación (generará nuevo código)
  console.log('📧 Enviando nueva invitación...');
  const inviteRes = await fetch(`${API_BASE}/invites`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      callId: activeCall.id,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      email: applicant.email,
      sendEmail: true, // Enviar automáticamente
    }),
  });

  if (!inviteRes.ok) {
    const error = await inviteRes.json();
    console.error('❌ Error al enviar invitación:', error.message || error);
    return;
  }

  const result = await inviteRes.json();
  console.log('\n✅ ¡Invitación reenviada exitosamente!\n');
  console.log('📧 Email enviado a:', applicant.email);
  console.log('🔑 Código generado:', result.code || result.invitationCode || '(oculto)');
  console.log('📅 Expira:', new Date(result.expiresAt).toLocaleString('es-CL'));
  console.log('\n🎉 El postulante debería recibir el email en unos segundos.');
}

resendInvite().catch(console.error);
