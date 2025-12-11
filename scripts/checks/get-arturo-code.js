const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function getArturoInviteCode() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Buscar invitación de Arturo Palma
    const invite = await client.query(`
      SELECT 
        i.id,
        i.call_id,
        i.code_hash,
        i.expires_at,
        i.used_at,
        i.meta,
        c.name as call_name,
        c.year as call_year
      FROM invites i
      LEFT JOIN calls c ON c.id = i.call_id
      WHERE i.meta->>'email' = 'arturo321rodriguez@gmail.com'
      ORDER BY i.created_at DESC
      LIMIT 1
    `);

    if (invite.rows.length === 0) {
      console.log('❌ No se encontró invitación para arturo321rodriguez@gmail.com');
      console.log('\n📋 Buscando todas las invitaciones disponibles...\n');
      
      const allInvites = await client.query(`
        SELECT 
          i.id,
          i.meta->>'email' as email,
          i.meta->>'firstName' as first_name,
          i.meta->>'lastName' as last_name,
          i.used_at,
          c.name as call_name
        FROM invites i
        LEFT JOIN calls c ON c.id = i.call_id
        WHERE c.year = 2029
        ORDER BY i.created_at DESC
      `);

      console.log('Invitaciones encontradas para Test 2029:');
      allInvites.rows.forEach((inv, idx) => {
        const status = inv.used_at ? '✅ Usada' : '🟢 Disponible';
        console.log(`${idx + 1}. ${status} - ${inv.first_name || ''} ${inv.last_name || ''} (${inv.email || 'Sin email'})`);
      });
      
      return;
    }

    const inviteData = invite.rows[0];

    console.log('🎫 INVITACIÓN DE ARTURO PALMA');
    console.log('═'.repeat(70));
    console.log(`Email: ${inviteData.meta?.email || 'No definido'}`);
    console.log(`Nombre: ${inviteData.meta?.firstName || ''} ${inviteData.meta?.lastName || ''}`);
    console.log(`Convocatoria: ${inviteData.call_name} (${inviteData.call_year})`);
    console.log(`Estado: ${inviteData.used_at ? '✅ Usada' : '🟢 Disponible'}`);
    console.log(`Expira: ${inviteData.expires_at ? new Date(inviteData.expires_at).toLocaleString('es-CL') : 'Sin expiración'}`);
    console.log('═'.repeat(70));

    // Ahora necesitamos obtener el código original
    // Como está hasheado, vamos a buscar en las invitaciones recientes
    console.log('\n⚠️  El código está hasheado en la BD.');
    console.log('Buscando códigos de invitación conocidos...\n');

    // Lista de códigos comunes que podrían haberse usado
    const commonCodes = [
      'TEST123',
      'ARTURO123',
      'ARTURO',
      'PALMA123',
      'TEST2029',
      'PRUEBA123',
      'DEMO123'
    ];

    const { verify } = require('argon2');
    
    console.log('🔍 Probando códigos comunes...\n');
    
    for (const code of commonCodes) {
      try {
        const matches = await verify(inviteData.code_hash, code.toUpperCase());
        if (matches) {
          console.log('✅ ¡CÓDIGO ENCONTRADO!\n');
          console.log('═'.repeat(70));
          console.log(`📋 CÓDIGO DE INVITACIÓN: ${code.toUpperCase()}`);
          console.log('═'.repeat(70));
          console.log('\n🚀 Para testear el formulario:\n');
          console.log('1. Ve a: https://fcgfront.vercel.app/auth/enter-invite');
          console.log(`2. Ingresa el código: ${code.toUpperCase()}`);
          console.log(`3. Ingresa el email: arturo321rodriguez@gmail.com`);
          console.log('4. Completa el formulario\n');
          console.log('═'.repeat(70));
          return;
        }
      } catch (err) {
        // Continuar con el siguiente código
      }
    }

    console.log('❌ No se pudo encontrar el código entre los comunes.\n');
    console.log('💡 Opciones:\n');
    console.log('1. Crear un nuevo código de invitación');
    console.log('2. Usar otro código existente');
    console.log('3. Ver todas las invitaciones disponibles\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

getArturoInviteCode();
