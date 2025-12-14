const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function verificarUsuarioAdmin() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    console.log('═'.repeat(80));
    console.log('🔍 VERIFICANDO USUARIO ADMIN');
    console.log('═'.repeat(80));
    console.log();
    
    const user = await client.query(`
      SELECT 
        id,
        email,
        full_name,
        role,
        is_active,
        password_hash,
        created_at
      FROM users
      WHERE email = 'admin@fcg.local'
    `);

    if (user.rows.length === 0) {
      console.log('❌ Usuario no encontrado\n');
    } else {
      const admin = user.rows[0];
      console.log(`Email: ${admin.email}`);
      console.log(`Nombre: ${admin.full_name}`);
      console.log(`Rol: ${admin.role}`);
      console.log(`Activo: ${admin.is_active}`);
      console.log(`ID: ${admin.id}`);
      console.log(`Password hash (primeros 20 chars): ${admin.password_hash?.substring(0, 20)}...`);
      console.log(`Creado: ${admin.created_at}`);
      console.log();
      console.log('═'.repeat(80));
      console.log('📝 NOTA:');
      console.log('═'.repeat(80));
      console.log();
      console.log('El password está hasheado con Argon2.');
      console.log('Si el login falla, puede ser que:');
      console.log('1. La contraseña fue cambiada después de la creación');
      console.log('2. Hay un problema en el endpoint de login');
      console.log('3. Necesitas resetear la contraseña');
      console.log();
    }

    await client.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verificarUsuarioAdmin().catch(console.error);
