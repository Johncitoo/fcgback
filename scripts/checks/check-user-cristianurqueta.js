const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUser() {
  try {
    const email = 'cristianurqueta@gmail.com';
    
    console.log(`🔍 Buscando usuario: ${email}\n`);
    
    // Buscar en tabla users
    const userResult = await pool.query(`
      SELECT id, email, full_name, role, created_at, updated_at, password_hash
      FROM users
      WHERE email = $1
    `, [email]);
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('✅ Usuario encontrado en tabla users:');
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Nombre: ${user.full_name}`);
      console.log(`   - Rol: ${user.role}`);
      console.log(`   - Tiene contraseña: ${user.password_hash ? 'SÍ' : 'NO'}`);
      console.log(`   - Creado: ${user.created_at}`);
      console.log(`   - Actualizado: ${user.updated_at}\n`);
    } else {
      console.log('❌ Usuario NO encontrado en tabla users\n');
    }
    
    // Buscar en tabla applicants
    const applicantResult = await pool.query(`
      SELECT a.id, a.user_id, a.status, u.email, u.full_name
      FROM applicants a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE u.email = $1
    `, [email]);
    
    if (applicantResult.rows.length > 0) {
      const applicant = applicantResult.rows[0];
      console.log('✅ Encontrado en tabla applicants:');
      console.log(`   - Applicant ID: ${applicant.id}`);
      console.log(`   - User ID: ${applicant.user_id}`);
      console.log(`   - Status: ${applicant.status}\n`);
    } else {
      console.log('❌ NO encontrado en tabla applicants\n');
    }
    
    // Buscar invitaciones pendientes
    const inviteResult = await pool.query(`
      SELECT id, email, role, status, created_at
      FROM invites
      WHERE email = $1
      ORDER BY created_at DESC
      LIMIT 3
    `, [email]);
    
    if (inviteResult.rows.length > 0) {
      console.log('📧 Invitaciones encontradas:');
      inviteResult.rows.forEach(invite => {
        console.log(`   - ${invite.status}: ${invite.role} (${invite.created_at})`);
      });
    } else {
      console.log('📧 No hay invitaciones\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUser();
