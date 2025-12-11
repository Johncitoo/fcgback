/**
 * Script para activar una convocatoria y crear un código de invitación
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function activateCallAndCreateInvite() {
  try {
    console.log('🔍 Buscando convocatorias...\n');

    // Buscar convocatorias
    const callsResult = await pool.query(`
      SELECT id, name, status, start_date, end_date 
      FROM calls 
      ORDER BY created_at DESC
    `);

    if (callsResult.rows.length === 0) {
      console.log('❌ No hay convocatorias en la base de datos');
      return;
    }

    console.log('📋 Convocatorias encontradas:');
    callsResult.rows.forEach((call, idx) => {
      console.log(`${idx + 1}. ${call.name} - Estado: ${call.status}`);
    });

    // Tomar la primera convocatoria
    const call = callsResult.rows[0];
    console.log(`\n✅ Usando: ${call.name}\n`);

    // Activar la convocatoria
    if (call.status !== 'OPEN') {
      console.log('⏳ Activando convocatoria...');
      await pool.query(`
        UPDATE calls 
        SET status = 'OPEN',
            start_date = NOW(),
            end_date = NOW() + INTERVAL '6 months',
            updated_at = NOW()
        WHERE id = $1
      `, [call.id]);
      console.log('✅ Convocatoria activada\n');
    } else {
      console.log('✅ Convocatoria ya está activa\n');
    }

    // Generar código único
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const inviteCode = `TEST-${randomPart}`;

    // Crear invitación
    console.log('⏳ Creando código de invitación...');
    const inviteResult = await pool.query(`
      INSERT INTO invites (
        call_id, 
        invite_code, 
        status, 
        created_at, 
        updated_at
      )
      VALUES ($1, $2, 'PENDING', NOW(), NOW())
      RETURNING invite_code, status, created_at
    `, [call.id, inviteCode]);

    const invite = inviteResult.rows[0];

    console.log('✅ Código de invitación creado exitosamente\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CÓDIGO DE INVITACIÓN PARA POSTULANTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 URL:    https://fcgfront.vercel.app/login');
    console.log('🎫 Código: ' + invite.invite_code);
    console.log('📌 Estado: ' + invite.status);
    console.log('📅 Creado: ' + new Date(invite.created_at).toLocaleString('es-CL'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 INSTRUCCIONES:');
    console.log('1. Ir a https://fcgfront.vercel.app/login');
    console.log('2. En la pestaña "Postular"');
    console.log('3. Ingresar el código: ' + invite.invite_code);
    console.log('4. Click en "Continuar"');
    console.log('5. Completar el registro\n');

    console.log('✅ Todo listo! 🎉\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

activateCallAndCreateInvite()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
