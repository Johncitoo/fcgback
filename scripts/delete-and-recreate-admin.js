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
    console.log('✅ Conectado a Railway PostgreSQL');

    const email = 'juanjacontrerasra@gmail.com';

    // 1. Buscar el usuario
    const userResult = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      console.log(`\n📌 Usuario encontrado:`, userResult.rows[0]);

      // 2. Eliminar registros relacionados (verificar tablas con FK)
      console.log('\n🗑️  Eliminando registros relacionados...');
      
      // Verificar y eliminar de admin_verification_codes
      const verificationResult = await client.query(
        'DELETE FROM admin_verification_codes WHERE requester_user_id = $1 RETURNING id',
        [userId]
      );
      console.log(`   - admin_verification_codes: ${verificationResult.rowCount} eliminados`);

      // Verificar y eliminar de otras tablas si existen
      const tables = [
        'sessions',
        'audit_logs',
        'applications',
        'form_submissions',
        'invites',
      ];

      for (const table of tables) {
        try {
          const result = await client.query(
            `DELETE FROM ${table} WHERE user_id = $1 RETURNING id`,
            [userId]
          );
          console.log(`   - ${table}: ${result.rowCount} eliminados`);
        } catch (e) {
          // Tabla no tiene user_id o no existe
        }
      }

      // 3. Eliminar el usuario
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      console.log(`\n✅ Usuario ${email} eliminado completamente`);
    } else {
      console.log(`\n⚠️  Usuario ${email} no encontrado`);
    }

    // 4. Crear nuevo usuario admin
    console.log('\n🔨 Creando nuevo usuario admin...');
    const passwordHash = await argon2.hash('AdminFCG2025!');
    
    const insertResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at, password_updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW())
       RETURNING id, email, role`,
      [email, passwordHash, 'Juan Contreras', 'ADMIN']
    );

    console.log('✅ Usuario admin creado:', insertResult.rows[0]);
    console.log('\n📧 Email:', email);
    console.log('🔑 Password: AdminFCG2025!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado de la BD');
  }
}

main();
