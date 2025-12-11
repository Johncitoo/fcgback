// Script para verificar el estado completo del usuario con el nuevo código
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function checkUserState() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const code = 'TEST-1QRCYBX8';
    const email = 'postulante.prueba@test.cl';

    // 1. Verificar el invite
    console.log('1️⃣ Verificando código de invitación...');
    const inviteResult = await client.query(`
      SELECT 
        id,
        call_id,
        used_at,
        used_by_applicant,
        expires_at
      FROM invites
      WHERE code_hash IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`   Total invites: ${inviteResult.rows.length}`);
    const invite = inviteResult.rows.find(i => i.id === 'b56449ea-ceed-484a-a988-85bd1ce24eb1');
    
    if (invite) {
      console.log(`   ✅ Código encontrado:`);
      console.log(`      ID: ${invite.id}`);
      console.log(`      Call ID: ${invite.call_id}`);
      console.log(`      Usado: ${invite.used_at ? 'Sí (' + invite.used_at + ')' : 'No'}`);
      console.log(`      Usado por: ${invite.used_by_applicant || 'Nadie'}`);
      console.log(`      Expira: ${invite.expires_at}\n`);
    } else {
      console.log(`   ❌ Código no encontrado\n`);
    }

    // 2. Verificar usuario
    console.log('2️⃣ Buscando usuario por email...');
    const userResult = await client.query(`
      SELECT 
        id,
        email,
        role,
        applicant_id,
        is_active,
        created_at
      FROM users
      WHERE email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      console.log(`   ❌ No existe usuario con email ${email}`);
      console.log(`   ℹ️  El usuario se crea cuando VALIDAS el código (paso después de ingresar código)\n`);
      console.log(`   📝 Pasos para crear usuario:`);
      console.log(`      1. Ir a https://fcgfront.vercel.app/#/login`);
      console.log(`      2. Ingresar email: ${email}`);
      console.log(`      3. Ingresar código: ${code}`);
      console.log(`      4. Click en "Validar código"`);
      console.log(`      5. Establecer contraseña\n`);
      return;
    }

    const user = userResult.rows[0];
    console.log(`   ✅ Usuario encontrado:`);
    console.log(`      ID: ${user.id}`);
    console.log(`      Applicant ID: ${user.applicant_id || '❌ NULL'}`);
    console.log(`      Activo: ${user.is_active}`);
    console.log(`      Creado: ${user.created_at}\n`);

    if (!user.applicant_id) {
      console.log(`   ⚠️  PROBLEMA: Usuario sin applicant_id`);
      return;
    }

    // 3. Verificar applicant
    console.log('3️⃣ Verificando applicant...');
    const applicantResult = await client.query(`
      SELECT 
        id,
        rut_number,
        rut_dv,
        first_name,
        last_name,
        email
      FROM applicants
      WHERE id = $1
    `, [user.applicant_id]);

    if (applicantResult.rows.length === 0) {
      console.log(`   ❌ Applicant no encontrado\n`);
      return;
    }

    const applicant = applicantResult.rows[0];
    console.log(`   ✅ Applicant encontrado:`);
    console.log(`      ID: ${applicant.id}`);
    console.log(`      RUT: ${applicant.rut_number}-${applicant.rut_dv}`);
    console.log(`      Nombre: ${applicant.first_name} ${applicant.last_name}\n`);

    // 4. Verificar convocatoria activa
    console.log('4️⃣ Verificando convocatoria activa...');
    const activeCallResult = await client.query(`
      SELECT id, name, year, status
      FROM calls
      WHERE status = 'OPEN'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (activeCallResult.rows.length === 0) {
      console.log(`   ❌ No hay convocatoria con status = 'OPEN'\n`);
      return;
    }

    const call = activeCallResult.rows[0];
    console.log(`   ✅ Convocatoria activa:`);
    console.log(`      ID: ${call.id}`);
    console.log(`      Nombre: ${call.name} ${call.year}\n`);

    // 5. Verificar applications
    console.log('5️⃣ Verificando applications del applicant...');
    const appResult = await client.query(`
      SELECT 
        a.id,
        a.status,
        a.created_at,
        c.name as call_name,
        c.year as call_year,
        c.status as call_status
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      WHERE a.applicant_id = $1
      ORDER BY a.created_at DESC
    `, [applicant.id]);

    console.log(`   Total applications: ${appResult.rows.length}`);
    
    if (appResult.rows.length === 0) {
      console.log(`   ❌ No hay applications para este applicant\n`);
      console.log(`   ⚠️  PROBLEMA: El endpoint /applications/my-active requiere una application`);
      console.log(`   🔧 SOLUCIÓN: La application se crea automáticamente en validateInviteCode`);
      console.log(`              Si no existe, el endpoint debería crearla automáticamente\n`);
    } else {
      appResult.rows.forEach((app, i) => {
        console.log(`\n   ${i + 1}. Application ${app.id}`);
        console.log(`      Convocatoria: ${app.call_name} ${app.call_year}`);
        console.log(`      Status application: ${app.status}`);
        console.log(`      Status convocatoria: ${app.call_status}`);
        console.log(`      Creada: ${app.created_at}`);
      });

      // Ver si hay una para la convocatoria activa
      const activeApp = appResult.rows.find(a => a.call_status === 'OPEN');
      if (activeApp) {
        console.log(`\n   ✅ Hay application para la convocatoria activa`);
      } else {
        console.log(`\n   ⚠️  No hay application para la convocatoria activa`);
        console.log(`      El endpoint /my-active debería crear una nueva`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkUserState();
