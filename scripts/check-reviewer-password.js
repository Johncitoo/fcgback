/**
 * Script para verificar credenciales del revisor
 */

const { Client } = require('pg');
const argon2 = require('argon2');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function checkReviewerPassword() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('\n🔌 Conectado a Railway PostgreSQL\n');
    
    // Obtener el hash del revisor
    const result = await client.query(`
      SELECT 
        email, 
        full_name,
        password_hash,
        created_at
      FROM users
      WHERE role = 'REVIEWER'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No hay usuarios REVIEWER en la base de datos\n');
      return;
    }

    const reviewer = result.rows[0];
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('🔍 REVISOR ENCONTRADO\n');
    console.log(`Email: ${reviewer.email}`);
    console.log(`Nombre: ${reviewer.full_name}`);
    console.log(`Creado: ${new Date(reviewer.created_at).toLocaleString('es-CL')}`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    // Contraseñas comunes a probar
    const commonPasswords = [
      'Reviewer123!',
      'reviewer123',
      'Revisor123!',
      'revisor123',
      'Admin123!',
      'password',
      'Password123!',
      '123456',
      'fcg2024',
      'FCG2024!',
    ];

    console.log('🔐 PROBANDO CONTRASEÑAS COMUNES...\n');

    let found = false;
    for (const pwd of commonPasswords) {
      try {
        const isMatch = await argon2.verify(reviewer.password_hash, pwd);
        if (isMatch) {
          console.log('✅ ¡CONTRASEÑA ENCONTRADA!\n');
          console.log('═══════════════════════════════════════════════════════════════════════');
          console.log('📋 CREDENCIALES DEL REVISOR:\n');
          console.log(`   Email:      ${reviewer.email}`);
          console.log(`   Contraseña: ${pwd}`);
          console.log('═══════════════════════════════════════════════════════════════════════\n');
          found = true;
          break;
        }
      } catch (err) {
        // Continuar con la siguiente contraseña
      }
    }

    if (!found) {
      console.log('⚠️  No se encontró la contraseña entre las comunes.\n');
      console.log('💡 OPCIONES:\n');
      console.log('1. Resetear la contraseña desde el panel de admin');
      console.log('2. Crear un nuevo usuario revisor con contraseña conocida\n');
      console.log('═══════════════════════════════════════════════════════════════════════\n');
      
      console.log('🔧 PARA RESETEAR LA CONTRASEÑA:\n');
      console.log('Opción A - Desde panel admin:');
      console.log('  1. Login como admin@fcg.local');
      console.log('  2. Ir a /admin/users');
      console.log('  3. Editar usuario revisor');
      console.log('  4. Cambiar contraseña\n');
      
      console.log('Opción B - Ejecutar script de reset:');
      console.log('  node scripts/reset-reviewer-password.js\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

checkReviewerPassword().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
