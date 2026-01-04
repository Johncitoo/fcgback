const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function checkMilestoneStatus() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    const applicationId = '8bcd05ea-e742-40f8-8012-f020c551bc33';
    
    console.log('📊 Estado de Milestones para Application:', applicationId);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Ver estado de todos los milestones
    const result = await client.query(`
      SELECT 
        m.name,
        m.order_index,
        mp.status,
        mp.completed_at,
        mp.created_at,
        mp.updated_at,
        fs.submitted_at as form_submitted_at,
        fs.id as submission_id
      FROM milestone_progress mp
      JOIN milestones m ON m.id = mp.milestone_id
      LEFT JOIN form_submissions fs ON fs.milestone_id = m.id AND fs.application_id = mp.application_id
      WHERE mp.application_id = $1
      ORDER BY m.order_index
    `, [applicationId]);

    if (result.rows.length === 0) {
      console.log('⚠️  No se encontraron milestones para esta aplicación\n');
      return;
    }

    console.log(`Total de milestones: ${result.rows.length}\n`);

    result.rows.forEach((row, idx) => {
      const emoji = 
        row.status === 'COMPLETED' ? '✅' :
        row.status === 'IN_PROGRESS' ? '🔄' :
        '⏸️';
      
      console.log(`${emoji} ${idx + 1}. ${row.name}`);
      console.log(`   Order: ${row.order_index}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Completed At: ${row.completed_at || 'N/A'}`);
      console.log(`   Form Submitted At: ${row.form_submitted_at || 'N/A'}`);
      console.log(`   Submission ID: ${row.submission_id || 'N/A'}`);
      console.log('');
    });

    // Resumen
    const completed = result.rows.filter(r => r.status === 'COMPLETED').length;
    const inProgress = result.rows.filter(r => r.status === 'IN_PROGRESS').length;
    const pending = result.rows.filter(r => r.status === 'PENDING').length;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📈 RESUMEN:');
    console.log(`   ✅ Completados: ${completed}`);
    console.log(`   🔄 En Progreso: ${inProgress}`);
    console.log(`   ⏸️  Pendientes: ${pending}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verificar si el flujo está correcto
    if (inProgress > 1) {
      console.log('⚠️  ATENCIÓN: Hay más de un milestone en IN_PROGRESS');
    }
    
    if (inProgress === 0 && pending > 0) {
      console.log('⚠️  ATENCIÓN: No hay ningún milestone en IN_PROGRESS pero hay pendientes');
    }

    // Mostrar el siguiente milestone esperado
    const nextMilestone = result.rows.find(r => r.status === 'IN_PROGRESS' || r.status === 'PENDING');
    if (nextMilestone) {
      console.log(`\n🎯 Siguiente milestone a completar: "${nextMilestone.name}"`);
      console.log(`   Status actual: ${nextMilestone.status}`);
    } else {
      console.log('\n🎉 ¡Todos los milestones están completados!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

checkMilestoneStatus();
