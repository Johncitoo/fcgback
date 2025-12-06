const { Client } = require('pg');
const { hash } = require('argon2');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function createSimpleCode() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Obtener ID de la convocatoria Test 2029
    const call = await client.query(`
      SELECT id, name, year FROM calls WHERE year = 2029
    `);

    if (call.rows.length === 0) {
      console.log('❌ No se encontró la convocatoria Test 2029');
      return;
    }

    const callId = call.rows[0].id;
    const code = 'TEST123'; // Código simple para testing
    const codeHash = await hash(code);

    // Verificar si ya existe un código TEST123
    const existing = await client.query(`
      SELECT id FROM invites WHERE call_id = $1 LIMIT 1
    `, [callId]);

    if (existing.rows.length > 0) {
      // Actualizar la invitación existente
      const inviteId = existing.rows[0].id;
      
      await client.query(`
        UPDATE invites 
        SET 
          code_hash = $1,
          expires_at = NOW() + INTERVAL '30 days',
          used_at = NULL,
          used_by_applicant = NULL,
          meta = jsonb_build_object(
            'email', 'arturo321rodriguez@gmail.com',
            'firstName', 'Arturo',
            'lastName', 'Palma',
            'testCode', true
          )
        WHERE id = $2
      `, [codeHash, inviteId]);

      console.log('✅ Código actualizado para Arturo Palma\n');
    } else {
      // Crear nueva invitación
      await client.query(`
        INSERT INTO invites (call_id, code_hash, expires_at, meta, used_at, used_by_applicant)
        VALUES (
          $1,
          $2,
          NOW() + INTERVAL '30 days',
          jsonb_build_object(
            'email', 'arturo321rodriguez@gmail.com',
            'firstName', 'Arturo',
            'lastName', 'Palma',
            'testCode', true
          ),
          NULL,
          NULL
        )
      `, [callId, codeHash]);

      console.log('✅ Código creado para Arturo Palma\n');
    }

    console.log('═'.repeat(70));
    console.log('🎫 CÓDIGO DE INVITACIÓN PARA TESTING');
    console.log('═'.repeat(70));
    console.log(`📋 CÓDIGO: TEST123`);
    console.log(`👤 Para: Arturo Palma`);
    console.log(`📧 Email: arturo321rodriguez@gmail.com`);
    console.log(`📅 Válido hasta: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL')}`);
    console.log('═'.repeat(70));
    console.log('\n🚀 PASOS PARA TESTEAR:\n');
    console.log('1. Ve a: https://fcgfront.vercel.app/auth/enter-invite');
    console.log('   (o en local: http://localhost:5173/auth/enter-invite)');
    console.log('\n2. Ingresa el código: TEST123');
    console.log('   Email: arturo321rodriguez@gmail.com');
    console.log('\n3. Establece una contraseña');
    console.log('\n4. Completa el formulario (ahora puedes agregar campos de archivo)');
    console.log('\n5. Sube archivos en los campos configurados');
    console.log('═'.repeat(70));
    console.log('\n💡 NOTA: Gracias al modo DEV, puedes:');
    console.log('   - Usar TEST123 múltiples veces');
    console.log('   - No preocuparte por códigos quemados');
    console.log('   - Testear el storage sin límites\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

createSimpleCode();
