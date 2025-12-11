// Script para verificar el estado del usuario y su vínculo con applicant
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function checkUser() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const email = 'postulante.prueba@test.cl';
    
    // Verificar usuario
    const userResult = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.role,
        u.applicant_id,
        u.is_active,
        u.created_at
      FROM users u
      WHERE u.email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      console.log(`❌ Usuario no encontrado: ${email}`);
      return;
    }

    const user = userResult.rows[0];
    console.log('👤 Usuario encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Applicant ID: ${user.applicant_id || '❌ NULL'}`);
    console.log(`   Activo: ${user.is_active}`);
    console.log(`   Creado: ${user.created_at}\n`);

    if (!user.applicant_id) {
      console.log('⚠️  PROBLEMA: El usuario no tiene applicant_id vinculado\n');
      
      // Buscar applicant por email
      const applicantResult = await client.query(`
        SELECT 
          id,
          rut_number,
          rut_dv,
          first_name,
          last_name,
          email,
          created_at
        FROM applicants
        WHERE email = $1
      `, [email]);

      if (applicantResult.rows.length === 0) {
        console.log('❌ No existe applicant con ese email\n');
        console.log('🔧 SOLUCIÓN: Crear applicant y vincular al usuario');
      } else {
        const applicant = applicantResult.rows[0];
        console.log('✅ Applicant encontrado:');
        console.log(`   ID: ${applicant.id}`);
        console.log(`   RUT: ${applicant.rut_number}-${applicant.rut_dv}`);
        console.log(`   Nombre: ${applicant.first_name} ${applicant.last_name}`);
        console.log(`   Email: ${applicant.email}`);
        console.log(`   Creado: ${applicant.created_at}\n`);
        
        console.log('🔧 SOLUCIÓN: Vincular applicant existente al usuario');
        console.log(`\nEjecutar:`);
        console.log(`UPDATE users SET applicant_id = '${applicant.id}' WHERE id = '${user.id}';`);
      }
    } else {
      // Verificar que el applicant existe
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
        console.log('❌ El applicant_id vinculado no existe en la tabla applicants\n');
      } else {
        const applicant = applicantResult.rows[0];
        console.log('✅ Applicant vinculado correctamente:');
        console.log(`   ID: ${applicant.id}`);
        console.log(`   RUT: ${applicant.rut_number}-${applicant.rut_dv}`);
        console.log(`   Nombre: ${applicant.first_name} ${applicant.last_name}`);
        console.log(`   Email: ${applicant.email}\n`);

        // Verificar applications
        const appsResult = await client.query(`
          SELECT 
            a.id,
            a.status,
            c.name as call_name,
            c.year as call_year,
            a.created_at
          FROM applications a
          JOIN calls c ON c.id = a.call_id
          WHERE a.applicant_id = $1
          ORDER BY a.created_at DESC
        `, [applicant.id]);

        console.log(`📋 Applications: ${appsResult.rows.length}`);
        appsResult.rows.forEach((app, i) => {
          console.log(`   ${i + 1}. ${app.call_name} ${app.call_year} - ${app.status} (${app.created_at})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkUser();
