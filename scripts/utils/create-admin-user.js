/**
 * Script para crear el usuario admin en la base de datos de Railway
 * Uso: node scripts/utils/create-admin-user.js
 */

const argon2 = require('argon2');

async function generateAdminHash() {
  const email = 'admin@fcg.local';
  const password = 'admin123';
  const fullName = 'Administrador FCG';
  
  console.log('🔐 Generando hash para usuario admin...');
  
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  
  console.log('\n✅ Hash generado exitosamente!\n');
  console.log('📋 Ejecuta este SQL en Railway PostgreSQL:\n');
  console.log('-- Crear usuario admin');
  console.log(`INSERT INTO public.users (email, password_hash, full_name, role, is_active)`);
  console.log(`VALUES ('${email}', '${hash}', '${fullName}', 'ADMIN', true)`);
  console.log(`ON CONFLICT (email) DO UPDATE SET`);
  console.log(`  password_hash = EXCLUDED.password_hash,`);
  console.log(`  full_name = EXCLUDED.full_name,`);
  console.log(`  role = EXCLUDED.role,`);
  console.log(`  is_active = EXCLUDED.is_active;`);
  console.log('\n✅ Después de ejecutar el SQL, podrás hacer login con:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
}

generateAdminHash().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
