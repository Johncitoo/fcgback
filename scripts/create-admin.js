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

    const email = 'juanjacontrerasra@gmail.com';

    // Verificar si existe
    console.log('🔍 Verificando si usuario existe...\n');
    const existingUser = await client.query('SELECT id, email, role FROM users WHERE email = $1', [email]);
    
    const passwordHash = await argon2.hash('AdminFCG2025!');
    console.log(`   Hash generado (primeros 50 chars): ${passwordHash.substring(0, 50)}...\n`);
    
    let result;
    
    if (existingUser.rows.length > 0) {
      console.log('🔄 Usuario existe, actualizando password y rol...\n');
      result = await client.query(
        `UPDATE users 
         SET password_hash = $2, 
             role = $3, 
             full_name = $4,
             is_active = true,
             password_updated_at = NOW(),
             updated_at = NOW()
         WHERE email = $1
         RETURNING id, email, role, full_name, created_at`,
        [email, passwordHash, 'ADMIN', 'Juan Contreras']
      );
      console.log('✅ Usuario actualizado exitosamente:');
    } else {
      console.log('🔨 Creando nuevo usuario admin...\n');
      result = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at, password_updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW())
         RETURNING id, email, role, full_name, created_at`,
        [email, passwordHash, 'Juan Contreras', 'ADMIN']
      );
      console.log('✅ Usuario creado exitosamente:');
    }
    
    console.log(JSON.stringify(result.rows[0], null, 2));
    
    console.log('\n📧 Credenciales de acceso:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: AdminFCG2025!`);
    console.log(`   Role: ADMIN`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === '23505') {
      console.error('El usuario ya existe. Eliminalo primero con el otro script.');
    }
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado de la BD');
  }
}

main();
