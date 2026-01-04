const { Client } = require('pg');
const argon2 = require('argon2');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function createAdminUser() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const email = 'weycarlitos193@gmail.com';
    const password = 'admin123';
    const fullName = 'Admin Carlos';
    const role = 'ADMIN';

    // Verificar si ya existe
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      console.log('⚠️ Usuario ya existe. Actualizando contraseña...');
      
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      
      await client.query(`
        UPDATE users 
        SET password_hash = $1, 
            password_updated_at = NOW(),
            is_active = true
        WHERE email = $2
      `, [hash, email]);
      
      console.log(`✅ Contraseña actualizada para ${email}`);
      
    } else {
      console.log('➕ Creando nuevo usuario...');
      
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      
      const result = await client.query(`
        INSERT INTO users (email, password_hash, full_name, role, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, email, full_name, role
      `, [email, hash, fullName, role]);
      
      console.log('✅ Usuario creado:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    }
    
    console.log(`\n🔑 Credenciales:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Rol: ${role}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createAdminUser();
