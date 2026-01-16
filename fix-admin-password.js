/**
 * Script para actualizar la password del admin usando Argon2 (compatible con el backend)
 * Uso: node fix-admin-password.js
 */

const { Client } = require('pg');
const argon2 = require('argon2');

const connectionString = 'postgresql://postgres:apocalipto11@db.iuvtgnhfahwolzzercyb.supabase.co:5432/postgres';

async function updateAdminPassword() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Supabase');

    // Hashear la password con Argon2 (igual que el backend)
    const password = 'apocalipto11';
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    
    console.log(`🔑 Hash generado con Argon2: ${hash.substring(0, 50)}...`);

    // Actualizar el admin
    const result = await client.query(
      `UPDATE users 
       SET password_hash = $1, password_updated_at = NOW()
       WHERE email = $2
       RETURNING id, email, role`,
      [hash, 'juanjacontrerasra@gmail.com']
    );

    if (result.rows.length === 0) {
      console.log('❌ No se encontró el usuario admin');
      return;
    }

    console.log('✅ Password actualizada correctamente');
    console.log('Usuario:', result.rows[0]);
    console.log('\n📌 Ahora puedes hacer login con:');
    console.log('   Email: juanjacontrerasra@gmail.com');
    console.log('   Password: apocalipto11');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

updateAdminPassword();
