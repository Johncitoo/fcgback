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

    // ========== PASO 1: EXPLORAR LA BASE DE DATOS ==========
    console.log('📊 PASO 1: EXPLORANDO LA ESTRUCTURA DE LA BASE DE DATOS\n');
    
    // Listar todas las tablas
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas encontradas:');
    tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));

    // ========== PASO 2: BUSCAR EL USUARIO ==========
    console.log('\n\n📌 PASO 2: BUSCANDO USUARIO\n');
    
    const userResult = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log(`⚠️  Usuario ${email} no encontrado en la tabla users`);
      return;
    }

    const user = userResult.rows[0];
    console.log('Usuario encontrado:');
    console.log(JSON.stringify(user, null, 2));

    const userId = user.id;

    // ========== PASO 3: BUSCAR TODAS LAS REFERENCIAS ==========
    console.log('\n\n🔍 PASO 3: BUSCANDO REFERENCIAS DEL USUARIO EN TODAS LAS TABLAS\n');

    // Lista de tablas y columnas que pueden tener referencias al usuario
    const referencesToCheck = [
      { table: 'sessions', column: 'user_id' },
      { table: 'audit_logs', column: 'user_id' },
      { table: 'applications', column: 'user_id' },
      { table: 'form_submissions', column: 'user_id' },
      { table: 'invites', column: 'reviewer_user_id' },
      { table: 'invites', column: 'created_by_user_id' },
      { table: 'admin_verification_codes', column: 'requester_user_id' },
      { table: 'admin_2fa_codes', column: 'admin_id' },
      { table: 'documents', column: 'uploaded_by' },
      { table: 'milestone_progress', column: 'updated_by' },
    ];

    const foundReferences = [];

    for (const ref of referencesToCheck) {
      try {
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM ${ref.table} WHERE ${ref.column} = $1`,
          [userId]
        );
        const count = parseInt(countResult.rows[0].count);
        if (count > 0) {
          foundReferences.push({ ...ref, count });
          console.log(`   ✓ ${ref.table}.${ref.column}: ${count} registros`);
        }
      } catch (e) {
        // Tabla o columna no existe
      }
    }

    if (foundReferences.length === 0) {
      console.log('   ℹ️  No se encontraron referencias a este usuario');
    }

    // ========== PASO 4: ELIMINAR REFERENCIAS ==========
    if (foundReferences.length > 0) {
      console.log('\n\n🗑️  PASO 4: ELIMINANDO REFERENCIAS\n');

      for (const ref of foundReferences) {
        const deleteResult = await client.query(
          `DELETE FROM ${ref.table} WHERE ${ref.column} = $1 RETURNING *`,
          [userId]
        );
        console.log(`   ✓ ${ref.table}.${ref.column}: ${deleteResult.rowCount} eliminados`);
      }
    }

    // ========== PASO 5: ELIMINAR USUARIO ==========
    console.log('\n\n🗑️  PASO 5: ELIMINANDO USUARIO\n');
    
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log(`✅ Usuario ${email} eliminado completamente`);

    // ========== PASO 6: CREAR NUEVO USUARIO ADMIN ==========
    console.log('\n\n🔨 PASO 6: CREANDO NUEVO USUARIO ADMIN\n');
    
    const passwordHash = await argon2.hash('AdminFCG2025!');
    
    const insertResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at, password_updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW())
       RETURNING id, email, role, full_name, created_at`,
      [email, passwordHash, 'Juan Contreras', 'ADMIN']
    );

    console.log('✅ Usuario admin creado:');
    console.log(JSON.stringify(insertResult.rows[0], null, 2));
    
    console.log('\n📧 Credenciales:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: AdminFCG2025!`);
    console.log(`   Role: ADMIN`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado de la BD');
  }
}

main();
