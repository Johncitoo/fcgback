const { Client } = require('pg');
const argon2 = require('argon2');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
});

async function resetAdminPassword() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    const email = 'juanjacontrerasra@gmail.com';
    const newPassword = 'AdminFCG2025!';

    console.log(`🔐 Generando hash para contraseña...`);
    const passwordHash = await argon2.hash(newPassword);
    console.log('Hash generado:', passwordHash.substring(0, 50) + '...\n');

    console.log(`📝 Actualizando contraseña para ${email}...`);
    const result = await client.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, role',
      [passwordHash, email]
    );

    if (result.rows.length > 0) {
      console.log('✅ Contraseña actualizada exitosamente');
      console.log('Usuario:', JSON.stringify(result.rows[0], null, 2));
      console.log('\n🔑 Credenciales:');
      console.log('Email:', email);
      console.log('Contraseña:', newPassword);
    } else {
      console.log('❌ No se encontró el usuario');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

resetAdminPassword();
