/**
 * Script para crear/actualizar usuario admin para demo
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function setupAdminUser() {
  const client = await pool.connect();
  
  try {
    const email = 'admin@fcg.org';
    const password = 'Admin123!';
    
    console.log('\n🔧 Configurando usuario administrador para demo...\n');
    
    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Verificar si existe el usuario
    const existingUser = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      // Actualizar contraseña del usuario existente
      await client.query(
        'UPDATE users SET password_hash = $1, role = $2 WHERE email = $3',
        [passwordHash, 'ADMIN', email]
      );
      console.log('✅ Usuario admin actualizado');
    } else {
      // Crear nuevo usuario admin
      await client.query(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES ($1, $2, $3, true)`,
        [email, passwordHash, 'ADMIN']
      );
      console.log('✅ Usuario admin creado');
    }
    
    console.log('\n📋 CREDENCIALES PARA EL CLIENTE:\n');
    console.log('═══════════════════════════════════════');
    console.log('🌐 URL: https://fcgfront.vercel.app/login');
    console.log('');
    console.log('👤 Email:      admin@fcg.org');
    console.log('🔑 Contraseña: Admin123!');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('📝 Instrucciones:');
    console.log('   1. Ir a la pestaña "Acceso" (no "Postular")');
    console.log('   2. Ingresar las credenciales');
    console.log('   3. Click en "Iniciar sesión"');
    console.log('   4. Será redirigido al panel de administración\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

setupAdminUser();
