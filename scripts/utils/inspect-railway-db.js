/**
 * Script para inspeccionar la base de datos de Railway y crear usuario admin
 * Uso: node scripts/utils/inspect-railway-db.js
 */

const { Client } = require('pg');
const argon2 = require('argon2');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    console.log('🔌 Conectando a Railway PostgreSQL...\n');
    await client.connect();
    console.log('✅ Conexión exitosa!\n');

    // 1. Listar todas las tablas
    console.log('📋 TABLAS EN LA BASE DE DATOS:');
    console.log('================================');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    console.log('');

    // 2. Verificar si existe la tabla users
    const usersTableExists = tablesResult.rows.some(r => r.table_name === 'users');
    
    if (!usersTableExists) {
      console.log('❌ La tabla "users" NO EXISTE. Necesitas ejecutar las migraciones primero.\n');
      return;
    }

    // 3. Ver estructura de la tabla users
    console.log('📊 ESTRUCTURA DE LA TABLA "users":');
    console.log('===================================');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    console.log('');

    // 4. Contar usuarios existentes
    const countResult = await client.query('SELECT COUNT(*) as total FROM users;');
    const totalUsers = parseInt(countResult.rows[0].total);
    console.log(`👥 USUARIOS EXISTENTES: ${totalUsers}`);
    console.log('========================\n');

    if (totalUsers > 0) {
      const usersResult = await client.query('SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at;');
      usersResult.rows.forEach((user, idx) => {
        console.log(`  ${idx + 1}. ${user.email}`);
        console.log(`     Nombre: ${user.full_name}`);
        console.log(`     Role: ${user.role}`);
        console.log(`     Activo: ${user.is_active}`);
        console.log(`     Creado: ${user.created_at}`);
        console.log('');
      });
    }

    // 5. Verificar si existe admin@fcg.local
    const adminResult = await client.query(`SELECT * FROM users WHERE email = 'admin@fcg.local';`);
    
    if (adminResult.rows.length > 0) {
      console.log('✅ El usuario admin@fcg.local YA EXISTE');
      console.log('   Si no puedes hacer login, actualizaré la contraseña...\n');
      
      const newHash = await argon2.hash('admin123', { type: argon2.argon2id });
      await client.query(`
        UPDATE users 
        SET password_hash = $1, updated_at = NOW()
        WHERE email = 'admin@fcg.local';
      `, [newHash]);
      
      console.log('✅ Contraseña actualizada exitosamente!');
    } else {
      console.log('⚠️  El usuario admin@fcg.local NO EXISTE');
      console.log('   Creando usuario admin...\n');
      
      const hash = await argon2.hash('admin123', { type: argon2.argon2id });
      await client.query(`
        INSERT INTO users (email, password_hash, full_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5);
      `, ['admin@fcg.local', hash, 'Administrador FCG', 'ADMIN', true]);
      
      console.log('✅ Usuario admin creado exitosamente!');
    }

    console.log('\n🎉 LISTO! Ahora puedes hacer login con:');
    console.log('   Email: admin@fcg.local');
    console.log('   Password: admin123');
    console.log('   URL: https://fcgfront.vercel.app\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('\n⚠️  No se pudo conectar al servidor. Verifica la URL de conexión.');
    } else if (error.code === '42P01') {
      console.error('\n⚠️  La tabla no existe. Ejecuta las migraciones primero.');
    }
  } finally {
    await client.end();
    console.log('🔌 Desconectado de Railway PostgreSQL');
  }
}

main().catch(console.error);
