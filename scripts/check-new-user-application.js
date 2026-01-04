const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function checkNewUserApplication() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Buscar el último usuario creado tipo APPLICANT
    console.log('🔍 Buscando último usuario APPLICANT creado...\n');
    
    const userResult = await client.query(`
      SELECT id, email, "firstName", "lastName", role, "createdAt"
      FROM users
      WHERE role = 'APPLICANT'
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);

    if (userResult.rows.length === 0) {
      console.log('⚠️  No se encontraron usuarios APPLICANT\n');
      return;
    }

    console.log('👥 Últimos 5 usuarios APPLICANT creados:');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    userResult.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Creado: ${user.createdAt}`);
      console.log('');
    });

    const latestUser = userResult.rows[0];
    console.log('\n📊 Verificando aplicación del usuario más reciente...');
    console.log(`Usuario: ${latestUser.firstName} ${latestUser.lastName} (${latestUser.email})`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Buscar aplicaciones de este usuario
    const appResult = await client.query(`
      SELECT 
        a.id,
        a."createdAt",
        a.status,
        c.name as call_name,
        c.id as call_id
      FROM applications a
      JOIN calls c ON c.id = a."callId"
      WHERE a."applicantId" = $1
      ORDER BY a."createdAt" DESC
    `, [latestUser.id]);

    if (appResult.rows.length === 0) {
      console.log('⚠️  Este usuario no tiene aplicaciones todavía\n');
      return;
    }

    console.log(`✅ Encontradas ${appResult.rows.length} aplicación(es):\n`);
    
    for (const app of appResult.rows) {
      console.log(`📋 Aplicación ID: ${app.id}`);
      console.log(`   Convocatoria: ${app.call_name}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Creada: ${app.createdAt}`);
      console.log('');

      // Ver form_submissions de esta aplicación
      const submissionsResult = await client.query(`
        SELECT 
          fs.id,
          fs."submittedAt",
          fs."createdAt",
          fs.answers,
          m.name as milestone_name,
          m.order_index,
          mp.status as milestone_status
        FROM form_submissions fs
        JOIN milestones m ON m.id = fs."milestoneId"
        LEFT JOIN milestone_progress mp ON mp."milestoneId" = m.id AND mp."applicationId" = fs."applicationId"
        WHERE fs."applicationId" = $1
        ORDER BY m.order_index
      `, [app.id]);

      if (submissionsResult.rows.length === 0) {
        console.log('   ⚠️  No hay form_submissions para esta aplicación\n');
        continue;
      }

      console.log('   📝 Form Submissions:');
      submissionsResult.rows.forEach((sub, idx) => {
        const hasAnswers = sub.answers && Object.keys(sub.answers).length > 0;
        const emoji = sub.submittedAt ? '✅' : (hasAnswers ? '💾' : '📄');
        
        console.log(`   ${emoji} ${sub.milestone_name} (Order ${sub.order_index})`);
        console.log(`      Submission ID: ${sub.id}`);
        console.log(`      submittedAt: ${sub.submittedAt || 'null'}`);
        console.log(`      createdAt: ${sub.createdAt}`);
        console.log(`      Milestone Status: ${sub.milestone_status || 'N/A'}`);
        console.log(`      Tiene respuestas: ${hasAnswers ? 'Sí (' + Object.keys(sub.answers).length + ' campos)' : 'No'}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

checkNewUserApplication();
