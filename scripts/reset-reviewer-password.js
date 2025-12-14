/**
 * Script para resetear la contraseña del revisor
 */

const { Client } = require('pg');
const argon2 = require('argon2');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function resetReviewerPassword() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('\n🔌 Conectado a Railway PostgreSQL\n');
    
    // Nueva contraseña
    const newPassword = 'Reviewer123!';
    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    
    console.log('🔐 Reseteando contraseña del revisor...\n');
    
    // Actualizar la contraseña
    const result = await client.query(`
      UPDATE users
      SET password_hash = $1,
          password_updated_at = NOW()
      WHERE email = 'reviewer@fcg.local'
      RETURNING email, full_name
    `, [newHash]);

    if (result.rows.length === 0) {
      console.log('⚠️  No se encontró el usuario reviewer@fcg.local\n');
      return;
    }

    const reviewer = result.rows[0];
    
    console.log('✅ ¡CONTRASEÑA ACTUALIZADA EXITOSAMENTE!\n');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('📋 NUEVAS CREDENCIALES DEL REVISOR:\n');
    console.log(`   Nombre:     ${reviewer.full_name}`);
    console.log(`   Email:      ${reviewer.email}`);
    console.log(`   Contraseña: ${newPassword}`);
    console.log('\n═══════════════════════════════════════════════════════════════════════\n');
    console.log('💡 INSTRUCCIONES DE USO:\n');
    console.log('1. Ir a la aplicación: https://fcg-front.vercel.app/login');
    console.log('2. Ingresar las credenciales de arriba');
    console.log('3. Serás redirigido al panel de revisor\n');
    console.log('4. Podrás cambiar tu contraseña desde el perfil\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

resetReviewerPassword().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
