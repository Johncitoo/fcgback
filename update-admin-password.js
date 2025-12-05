/**
 * Script para actualizar la contraseña del administrador
 * Usa argon2 que es la misma librería que usa el backend
 */

require('dotenv').config();
const { Pool } = require('pg');
const argon2 = require('argon2');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateAdminPassword() {
  try {
    console.log('🔐 Actualizando contraseña del administrador...\n');

    // Configuración de las credenciales
    const email = 'admin@fcg.local';
    const newPassword = 'admin123';

    // Hashear la contraseña con argon2
    console.log('⏳ Hasheando contraseña...');
    const hashedPassword = await argon2.hash(newPassword);
    console.log('✅ Contraseña hasheada correctamente\n');

    // Actualizar en la base de datos
    console.log('⏳ Actualizando en base de datos...');
    const updateResult = await pool.query(
      `UPDATE users 
       SET password_hash = $1, 
           password_updated_at = NOW(),
           updated_at = NOW()
       WHERE email = $2 
       RETURNING id, email, role, full_name, created_at`,
      [hashedPassword, email]
    );

    if (updateResult.rows.length === 0) {
      console.log('❌ No se encontró el usuario con email:', email);
      console.log('\n💡 Creando nuevo usuario administrador...');
      
      // Crear nuevo usuario si no existe
      const insertResult = await pool.query(
        `INSERT INTO users (email, password_hash, password_updated_at, full_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, NOW(), 'Admin FCG', 'ADMIN', true, NOW(), NOW())
         RETURNING id, email, role, full_name, created_at`,
        [email, hashedPassword]
      );
      
      const user = insertResult.rows[0];
      console.log('✅ Usuario administrador creado exitosamente\n');
      console.log('📋 Información del usuario:');
      console.log('   └─ ID:', user.id);
      console.log('   └─ Email:', user.email);
      console.log('   └─ Nombre:', user.full_name);
      console.log('   └─ Role:', user.role);
      console.log('   └─ Creado:', new Date(user.created_at).toLocaleString('es-CL'));
    } else {
      const user = updateResult.rows[0];
      console.log('✅ Contraseña actualizada exitosamente\n');
      console.log('📋 Información del usuario:');
      console.log('   └─ ID:', user.id);
      console.log('   └─ Email:', user.email);
      console.log('   └─ Nombre:', user.full_name);
      console.log('   └─ Role:', user.role);
      console.log('   └─ Creado:', new Date(user.created_at).toLocaleString('es-CL'));
    }

    console.log('\n🔐 CREDENCIALES ACTUALIZADAS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 URL:        https://fcgfront.vercel.app/login');
    console.log('👤 Email:      ' + email);
    console.log('🔑 Contraseña: ' + newPassword);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 INSTRUCCIONES PARA EL CLIENTE:');
    console.log('1. Abrir https://fcgfront.vercel.app/login');
    console.log('2. Ir a la pestaña "Acceso" (NO usar "Postular")');
    console.log('3. Ingresar email y contraseña');
    console.log('4. Click en "Iniciar sesión"');
    console.log('5. Será redirigido al Panel de Administración\n');

    console.log('✅ Todo listo para el demo con el cliente! 🎉\n');

  } catch (error) {
    console.error('❌ Error al actualizar contraseña:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar
updateAdminPassword()
  .then(() => {
    console.log('✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
