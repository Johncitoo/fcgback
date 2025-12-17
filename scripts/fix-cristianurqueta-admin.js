const { Client } = require('pg');
const argon2 = require('argon2');

async function main() {
  const client = new Client({
    host: 'tramway.proxy.rlwy.net',
    port: 30026,
    user: 'postgres',
    password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
    database: 'railway',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const email = 'cristianurqueta23@gmail.com';
    const password = 'AdminFCG2025!';
    const fullName = 'Cristian Urqueta';

    // Verificar si ya existe
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      console.log('⚠️  Usuario ya existe, actualizando contraseña...\n');
      const passwordHash = await argon2.hash(password);
      await client.query(
        `UPDATE users 
         SET password_hash = $2, 
             role = 'ADMIN',
             full_name = $3,
             is_active = true,
             password_updated_at = NOW(),
             updated_at = NOW()
         WHERE email = $1`,
        [email, passwordHash, fullName]
      );
      console.log('✅ Usuario actualizado');
    } else {
      console.log('🔨 Creando nuevo usuario admin...\n');
      const passwordHash = await argon2.hash(password);
      
      const result = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at, password_updated_at)
         VALUES ($1, $2, $3, 'ADMIN', true, NOW(), NOW(), NOW())
         RETURNING id, email, role, full_name`,
        [email, passwordHash, fullName]
      );
      
      console.log('✅ Usuario creado:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    }

    console.log('\n📧 Credenciales:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ADMIN`);

    // Marcar códigos como usados
    await client.query(
      `UPDATE admin_verification_codes 
       SET used = true 
       WHERE pending_email = $1 AND used = false`,
      [email]
    );
    console.log('\n✅ Códigos de verificación marcados como usados');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado de la BD');
  }
}

main();
