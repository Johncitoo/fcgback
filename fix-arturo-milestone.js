const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  try {
    const arturoAppId = '04954eed-5b40-4a89-ab40-6f513fffd78e';
    const callId = '96177fc7-e733-4238-b846-5ab6a1fade09';

    console.log('\n=== ACTIVAR PRIMER HITO PARA ARTURO ===\n');

    // 1. Obtener el primer hito (order_index = 1)
    const firstMilestone = await pool.query(`
      SELECT id, name, order_index, status
      FROM milestones
      WHERE call_id = $1 AND order_index = 1;
    `, [callId]);

    if (firstMilestone.rows.length === 0) {
      console.log('❌ No se encontró hito con order_index = 1');
      return;
    }

    const milestone = firstMilestone.rows[0];
    console.log('Primer hito:', milestone.name);
    console.log('Milestone ID:', milestone.id);
    console.log('Status actual del hito:', milestone.status);

    // 2. Activar el hito (cambiar status a ACTIVE)
    if (milestone.status !== 'ACTIVE') {
      await pool.query(`
        UPDATE milestones
        SET status = 'ACTIVE'
        WHERE id = $1;
      `, [milestone.id]);
      console.log('✅ Hito actualizado a ACTIVE');
    } else {
      console.log('✅ Hito ya está ACTIVE');
    }

    // 3. Actualizar milestone_progress a IN_PROGRESS
    const updateProgress = await pool.query(`
      UPDATE milestone_progress
      SET status = 'IN_PROGRESS'
      WHERE application_id = $1
      AND milestone_id = $2
      RETURNING *;
    `, [arturoAppId, milestone.id]);

    if (updateProgress.rows.length > 0) {
      console.log('✅ Milestone progress actualizado a IN_PROGRESS');
      console.log('Progress:', updateProgress.rows[0]);
    } else {
      console.log('❌ No se encontró milestone_progress para actualizar');
    }

    // 4. Verificar el estado final
    console.log('\n=== VERIFICACIÓN FINAL ===\n');
    const finalState = await pool.query(`
      SELECT 
        m.name,
        m.order_index,
        m.status as milestone_status,
        m.form_id,
        mp.status as progress_status,
        mp.id as progress_id
      FROM milestone_progress mp
      JOIN milestones m ON m.id = mp.milestone_id
      WHERE mp.application_id = $1
      ORDER BY m.order_index;
    `, [arturoAppId]);

    console.log('Estado de todos los hitos:');
    finalState.rows.forEach(row => {
      const icon = row.progress_status === 'IN_PROGRESS' ? '🟢' : '⚪';
      console.log(`${icon} ${row.order_index}. ${row.name}`);
      console.log(`   Milestone status: ${row.milestone_status}`);
      console.log(`   Progress status: ${row.progress_status}`);
      console.log(`   Form ID: ${row.form_id || 'N/A'}`);
      console.log(`   Progress ID: ${row.progress_id}\n`);
    });

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fix();
