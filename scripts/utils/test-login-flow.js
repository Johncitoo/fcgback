// Script para simular el login y obtener el token del nuevo usuario
const { Client } = require('pg');
const argon2 = require('argon2');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function testLogin() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const email = 'postulante1764159518305@test.cl';
    
    // Verificar si el usuario existe
    const userResult = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.role,
        u.applicant_id,
        u.password_hash
      FROM users u
      WHERE u.email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      console.log(`❌ Usuario no encontrado con email: ${email}`);
      console.log(`\n⚠️  El usuario se crea cuando VALIDAS el código, no al generarlo.`);
      console.log(`\n📝 Pasos para crear el usuario:`);
      console.log(`   1. Ve a https://fcgfront.vercel.app/#/login`);
      console.log(`   2. Ingresa email: ${email}`);
      console.log(`   3. Ingresa código: TEST-E02KEPCP`);
      console.log(`   4. Click en "Validar código"`);
      console.log(`   5. Establece una contraseña`);
      console.log(`   6. Inicia sesión con email y contraseña\n`);
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Usuario encontrado:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Applicant ID: ${user.applicant_id || '❌ NULL'}\n`);

    if (!user.applicant_id) {
      console.log(`⚠️  PROBLEMA: Usuario sin applicant_id vinculado\n`);
      return;
    }

    // Verificar si tiene application
    const appResult = await client.query(`
      SELECT 
        a.id,
        a.status,
        c.name as call_name,
        c.year as call_year,
        c.status as call_status
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      WHERE a.applicant_id = $1
      ORDER BY a.created_at DESC
      LIMIT 1
    `, [user.applicant_id]);

    if (appResult.rows.length === 0) {
      console.log(`⚠️  No hay applications para este usuario`);
      console.log(`   Esto es normal si recién validaste el código.`);
      console.log(`   La application se crea en validateInviteCode.\n`);
      return;
    }

    const app = appResult.rows[0];
    console.log(`✅ Application encontrada:`);
    console.log(`   ID: ${app.id}`);
    console.log(`   Status: ${app.status}`);
    console.log(`   Convocatoria: ${app.call_name} ${app.call_year}`);
    console.log(`   Status convocatoria: ${app.call_status}\n`);

    console.log(`\n🎉 TODO OK - El usuario está correctamente configurado`);
    console.log(`\n📋 Flujo esperado después del login:`);
    console.log(`   1. Login → obtiene token JWT`);
    console.log(`   2. Redirige a /applicant (ApplicantHome)`);
    console.log(`   3. ApplicantHome llama GET /applicants/me`);
    console.log(`   4. ApplicantHome llama GET /applications/my-active`);
    console.log(`   5. Muestra botón "Completar formulario"`);
    console.log(`   6. Click → va a /applicant/form/${app.id}`);
    console.log(`   7. FormPage carga el formulario y respuestas\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testLogin();
