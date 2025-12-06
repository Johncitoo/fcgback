const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: { rejectUnauthorized: false }
});

async function resetArturo() {
  try {
    const arturoAppId = '04954eed-5b40-4a89-ab40-6f513fffd78e';

    console.log('\n=== LIMPIAR POSTULACIÓN DE ARTURO ===\n');

    // 1. Eliminar archivos
    console.log('1. Eliminando archivos...');
    const deleteFiles = await pool.query(`
      DELETE FROM files_metadata
      WHERE "entityType" = 'APPLICATION' AND "entityId" = $1
      RETURNING id, "originalFilename";
    `, [arturoAppId]);
    
    console.log(`✅ ${deleteFiles.rows.length} archivos eliminados:`);
    deleteFiles.rows.forEach(f => console.log(`   - ${f.originalFilename}`));

    // 2. Eliminar form submissions
    console.log('\n2. Eliminando form submissions...');
    const deleteSubmissions = await pool.query(`
      DELETE FROM form_submissions
      WHERE application_id = $1
      RETURNING id;
    `, [arturoAppId]);
    
    console.log(`✅ ${deleteSubmissions.rows.length} submissions eliminados`);

    // 3. Resetear milestone_progress a PENDING
    console.log('\n3. Reseteando milestone_progress...');
    const resetProgress = await pool.query(`
      UPDATE milestone_progress
      SET 
        status = 'PENDING',
        completed_at = NULL,
        started_at = NULL,
        form_submission_id = NULL,
        notes = NULL
      WHERE application_id = $1
      RETURNING id;
    `, [arturoAppId]);
    
    console.log(`✅ ${resetProgress.rows.length} milestone_progress reseteados a PENDING`);

    // 4. Activar el primer milestone para que pueda volver a completar
    console.log('\n4. Activando primer milestone...');
    const firstMilestone = await pool.query(`
      SELECT m.id, m.name
      FROM milestones m
      WHERE m.call_id = (SELECT call_id FROM applications WHERE id = $1)
      AND m.order_index = 1;
    `, [arturoAppId]);

    if (firstMilestone.rows.length > 0) {
      const milestoneId = firstMilestone.rows[0].id;
      
      // Activar el milestone
      await pool.query(`
        UPDATE milestones SET status = 'ACTIVE' WHERE id = $1;
      `, [milestoneId]);

      // Poner el progress en IN_PROGRESS
      await pool.query(`
        UPDATE milestone_progress
        SET status = 'IN_PROGRESS'
        WHERE application_id = $1 AND milestone_id = $2;
      `, [arturoAppId, milestoneId]);

      console.log(`✅ Primer milestone activado: ${firstMilestone.rows[0].name}`);
    }

    // 5. Verificar estado final
    console.log('\n=== ESTADO FINAL ===\n');
    
    const finalState = await pool.query(`
      SELECT 
        m.name,
        m.order_index,
        mp.status
      FROM milestone_progress mp
      JOIN milestones m ON m.id = mp.milestone_id
      WHERE mp.application_id = $1
      ORDER BY m.order_index;
    `, [arturoAppId]);

    console.log('Milestone progress:');
    finalState.rows.forEach(row => {
      const icon = row.status === 'IN_PROGRESS' ? '🟢' : '⚪';
      console.log(`${icon} ${row.order_index}. ${row.name} - ${row.status}`);
    });

    console.log('\n✅ LISTO! Arturo puede volver a completar el formulario desde cero');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

resetArturo();
