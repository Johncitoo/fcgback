const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function checkArturoStatus() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Buscar usuario de Arturo
    const user = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.applicant_id,
        u.is_active,
        u.created_at
      FROM users u
      WHERE u.email = 'arturo321rodriguez@gmail.com'
    `);

    if (user.rows.length === 0) {
      console.log('ℹ️  Usuario aún no creado');
      console.log('   Usa el código TEST123 para crear el usuario\n');
      return;
    }

    const userData = user.rows[0];

    console.log('👤 USUARIO: ARTURO PALMA');
    console.log('═'.repeat(70));
    console.log(`Email: ${userData.email}`);
    console.log(`Nombre: ${userData.full_name}`);
    console.log(`Rol: ${userData.role}`);
    console.log(`Activo: ${userData.is_active ? '✅ Sí' : '❌ No'}`);
    console.log(`Applicant ID: ${userData.applicant_id || 'No asignado'}`);
    console.log(`Creado: ${new Date(userData.created_at).toLocaleString('es-CL')}`);
    console.log('═'.repeat(70));

    if (!userData.applicant_id) {
      console.log('\n⚠️  No tiene applicant_id asignado');
      return;
    }

    // Buscar aplicaciones
    const applications = await client.query(`
      SELECT 
        a.id,
        a.status,
        a.submitted_at,
        a.created_at,
        c.name as call_name,
        c.year as call_year
      FROM applications a
      LEFT JOIN calls c ON c.id = a.call_id
      WHERE a.applicant_id = $1
      ORDER BY a.created_at DESC
    `, [userData.applicant_id]);

    console.log(`\n📝 APLICACIONES (${applications.rows.length})`);
    console.log('═'.repeat(70));
    
    if (applications.rows.length === 0) {
      console.log('ℹ️  No tiene aplicaciones aún');
    } else {
      applications.rows.forEach((app, idx) => {
        console.log(`${idx + 1}. ${app.call_name} (${app.call_year})`);
        console.log(`   Estado: ${app.status}`);
        console.log(`   Creada: ${new Date(app.created_at).toLocaleString('es-CL')}`);
        if (app.submitted_at) {
          console.log(`   Enviada: ${new Date(app.submitted_at).toLocaleString('es-CL')}`);
        }
        console.log(`   ID: ${app.id}`);

        // Buscar progreso de hitos para esta aplicación
        console.log('\n   📊 Progreso de Hitos:');
      });

      // Detalles del progreso de la primera aplicación
      const firstAppId = applications.rows[0].id;
      
      const progress = await client.query(`
        SELECT 
          mp.id,
          mp.status,
          mp.completed_at,
          m.name as milestone_name,
          m.order_index
        FROM milestone_progress mp
        LEFT JOIN milestones m ON m.id = mp.milestone_id
        WHERE mp.application_id = $1
        ORDER BY m.order_index
      `, [firstAppId]);

      if (progress.rows.length > 0) {
        progress.rows.forEach((p, idx) => {
          const statusIcon = p.status === 'COMPLETED' ? '✅' : p.status === 'IN_PROGRESS' ? '🔄' : '⏸️';
          console.log(`      ${statusIcon} ${p.milestone_name} - ${p.status}`);
        });
      }

      // Form submissions
      const submissions = await client.query(`
        SELECT 
          fs.id,
          fs.submitted_at,
          fs.created_at,
          f.name as form_name,
          m.name as milestone_name
        FROM form_submissions fs
        LEFT JOIN forms f ON f.id = fs.form_id
        LEFT JOIN milestones m ON m.id = fs.milestone_id
        WHERE fs.application_id = $1
        ORDER BY fs.created_at DESC
      `, [firstAppId]);

      console.log(`\n   📋 Formularios Enviados (${submissions.rows.length})`);
      if (submissions.rows.length > 0) {
        submissions.rows.forEach((sub, idx) => {
          console.log(`      ${idx + 1}. ${sub.form_name || sub.milestone_name || 'Sin nombre'}`);
          console.log(`         Enviado: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('es-CL') : 'Borrador'}`);
        });
      }
    }

    console.log('\n═'.repeat(70));
    console.log('\n🎯 PRÓXIMOS PASOS PARA TESTEAR STORAGE:\n');
    console.log('1. Edita el formulario de la convocatoria Test 2029');
    console.log('2. Agrega campos de tipo FILE o IMAGE');
    console.log('3. Ingresa con el usuario de Arturo');
    console.log('4. Completa el formulario subiendo archivos');
    console.log('5. Verifica que los archivos se guarden en el storage\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkArturoStatus();
