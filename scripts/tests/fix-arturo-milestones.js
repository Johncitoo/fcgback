const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function fixMilestoneProgress() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Buscar aplicación de Arturo
    const app = await client.query(`
      SELECT a.id, a.call_id
      FROM applications a
      LEFT JOIN users u ON u.applicant_id = a.applicant_id
      WHERE u.email = 'arturo321rodriguez@gmail.com'
      ORDER BY a.created_at DESC
      LIMIT 1
    `);

    if (app.rows.length === 0) {
      console.log('❌ No se encontró aplicación de Arturo');
      return;
    }

    const applicationId = app.rows[0].id;
    const callId = app.rows[0].call_id;

    console.log(`📝 Aplicación encontrada: ${applicationId}`);
    console.log(`📋 Convocatoria: ${callId}\n`);

    // Obtener el primer hito (order_index más bajo)
    const firstMilestone = await client.query(`
      SELECT id, name, order_index
      FROM milestones
      WHERE call_id = $1
      ORDER BY order_index ASC
      LIMIT 1
    `, [callId]);

    if (firstMilestone.rows.length === 0) {
      console.log('❌ No se encontraron hitos para esta convocatoria');
      return;
    }

    const firstMilestoneId = firstMilestone.rows[0].id;
    const firstMilestoneName = firstMilestone.rows[0].name;

    console.log(`🎯 Primer hito: ${firstMilestoneName} (order: ${firstMilestone.rows[0].order_index})\n`);

    // Verificar estado actual
    const currentStatus = await client.query(`
      SELECT mp.id, mp.status
      FROM milestone_progress mp
      WHERE mp.application_id = $1
      AND mp.milestone_id = $2
    `, [applicationId, firstMilestoneId]);

    if (currentStatus.rows.length === 0) {
      console.log('⚠️  No existe registro de progreso, creando...');
      
      // Crear el registro
      await client.query(`
        INSERT INTO milestone_progress (application_id, milestone_id, status, created_at, updated_at)
        VALUES ($1, $2, 'IN_PROGRESS', NOW(), NOW())
      `, [applicationId, firstMilestoneId]);
      
      console.log('✅ Progreso creado con estado IN_PROGRESS');
    } else {
      const currentState = currentStatus.rows[0].status;
      console.log(`📊 Estado actual: ${currentState}`);
      
      if (currentState === 'IN_PROGRESS') {
        console.log('✅ Ya está en IN_PROGRESS, no se necesita actualización');
      } else {
        // Actualizar a IN_PROGRESS
        await client.query(`
          UPDATE milestone_progress
          SET status = 'IN_PROGRESS', updated_at = NOW()
          WHERE application_id = $1
          AND milestone_id = $2
        `, [applicationId, firstMilestoneId]);
        
        console.log('✅ Estado actualizado a IN_PROGRESS');
      }
    }

    // Asegurar que todos los demás hitos estén en PENDING
    await client.query(`
      UPDATE milestone_progress mp
      SET status = 'PENDING', updated_at = NOW()
      FROM milestones m1, milestones m2
      WHERE mp.milestone_id = m1.id
      AND m2.id = $1
      AND m1.call_id = m2.call_id
      AND m1.order_index > m2.order_index
      AND mp.application_id = $2
      AND mp.status != 'COMPLETED'
    `, [firstMilestoneId, applicationId]);

    console.log('✅ Todos los demás hitos configurados en PENDING\n');

    // Mostrar estado final
    const finalStatus = await client.query(`
      SELECT 
        m.name,
        m.order_index,
        mp.status,
        mp.completed_at
      FROM milestone_progress mp
      LEFT JOIN milestones m ON m.id = mp.milestone_id
      WHERE mp.application_id = $1
      ORDER BY m.order_index
    `, [applicationId]);

    console.log('📊 ESTADO FINAL DE HITOS:');
    console.log('═'.repeat(70));
    finalStatus.rows.forEach((row, idx) => {
      const statusIcon = row.status === 'COMPLETED' ? '✅' : 
                        row.status === 'IN_PROGRESS' ? '🔄' : 
                        '⏸️';
      console.log(`${statusIcon} ${row.order_index}. ${row.name} - ${row.status}`);
    });
    console.log('═'.repeat(70));

    console.log('\n✅ Corrección completada!');
    console.log('\n💡 Ahora Arturo debería ver el primer hito disponible para completar.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

fixMilestoneProgress();
