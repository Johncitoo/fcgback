const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function cleanDatabase() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL');

    // 1. Primero, identificar la convocatoria "test 2029"
    const callResult = await client.query(
      `SELECT id, name, year FROM calls WHERE name ILIKE '%test%' AND year = 2029`
    );

    if (callResult.rows.length === 0) {
      console.log('❌ No se encontró la convocatoria "test 2029"');
      console.log('Buscando todas las convocatorias disponibles...');
      
      const allCalls = await client.query(`SELECT id, name, year FROM calls ORDER BY year DESC`);
      console.log('Convocatorias encontradas:');
      allCalls.rows.forEach(call => {
        console.log(`  - ${call.name} (${call.year}) - ID: ${call.id}`);
      });
      
      return;
    }

    const keepCallId = callResult.rows[0].id;
    console.log(`\n✅ Convocatoria a conservar: "${callResult.rows[0].name}" (${callResult.rows[0].year})`);
    console.log(`   ID: ${keepCallId}\n`);

    // 2. Obtener todas las demás convocatorias
    const otherCalls = await client.query(
      `SELECT id, name, year FROM calls WHERE id != $1`,
      [keepCallId]
    );

    if (otherCalls.rows.length === 0) {
      console.log('✅ No hay otras convocatorias para eliminar');
      
      // Activar la convocatoria test 2029
      await client.query(
        `UPDATE calls SET is_active = true, status = 'OPEN' WHERE id = $1`,
        [keepCallId]
      );
      console.log('✅ Convocatoria "test 2029" activada');
      
      return;
    }

    console.log(`📋 Convocatorias a eliminar (${otherCalls.rows.length}):`);
    otherCalls.rows.forEach(call => {
      console.log(`   - ${call.name} (${call.year}) - ID: ${call.id}`);
    });

    const deleteCallIds = otherCalls.rows.map(c => c.id);

    // 3. Eliminar en orden correcto para respetar foreign keys
    console.log('\n🗑️  Iniciando limpieza...\n');

    // a) Eliminar milestone_progress de applications relacionadas
    const mpResult = await client.query(
      `DELETE FROM milestone_progress 
       WHERE application_id IN (
         SELECT id FROM applications WHERE call_id = ANY($1)
       )`,
      [deleteCallIds]
    );
    console.log(`   ✅ milestone_progress eliminados: ${mpResult.rowCount}`);

    // b) Eliminar form_submissions de applications relacionadas
    const fsResult = await client.query(
      `DELETE FROM form_submissions 
       WHERE application_id IN (
         SELECT id FROM applications WHERE call_id = ANY($1)
       )`,
      [deleteCallIds]
    );
    console.log(`   ✅ form_submissions eliminados: ${fsResult.rowCount}`);

    // c) Eliminar applications
    const appsResult = await client.query(
      `DELETE FROM applications WHERE call_id = ANY($1)`,
      [deleteCallIds]
    );
    console.log(`   ✅ applications eliminadas: ${appsResult.rowCount}`);

    // d) Eliminar invites
    const invitesResult = await client.query(
      `DELETE FROM invites WHERE call_id = ANY($1)`,
      [deleteCallIds]
    );
    console.log(`   ✅ invites eliminadas: ${invitesResult.rowCount}`);

    // e) Eliminar milestones
    const milestonesResult = await client.query(
      `DELETE FROM milestones WHERE call_id = ANY($1)`,
      [deleteCallIds]
    );
    console.log(`   ✅ milestones eliminados: ${milestonesResult.rowCount}`);

    // f) Eliminar form_sections relacionadas
    const sectionsResult = await client.query(
      `DELETE FROM form_sections WHERE call_id = ANY($1)`,
      [deleteCallIds]
    );
    console.log(`   ✅ form_sections eliminadas: ${sectionsResult.rowCount}`);

    // g) Finalmente, eliminar las convocatorias
    const callsResult = await client.query(
      `DELETE FROM calls WHERE id = ANY($1)`,
      [deleteCallIds]
    );
    console.log(`   ✅ calls eliminadas: ${callsResult.rowCount}\n`);

    // 4. Activar la convocatoria "test 2029" y desactivar todas las demás
    await client.query(`UPDATE calls SET is_active = false WHERE id != $1`, [keepCallId]);
    await client.query(
      `UPDATE calls SET is_active = true, status = 'OPEN' WHERE id = $1`,
      [keepCallId]
    );
    console.log('✅ Convocatoria "test 2029" activada (OPEN)');
    console.log('✅ Todas las demás convocatorias desactivadas\n');

    // 5. Verificar estado final
    const finalCalls = await client.query(
      `SELECT id, name, year, status, is_active FROM calls ORDER BY year DESC`
    );
    
    console.log('📊 Estado final de convocatorias:');
    console.log('═'.repeat(70));
    finalCalls.rows.forEach(call => {
      const status = call.is_active ? '🟢 ACTIVA' : '🔴 INACTIVA';
      console.log(`   ${status} | ${call.name} (${call.year}) - ${call.status}`);
    });
    console.log('═'.repeat(70));

    // 6. Contar registros relacionados restantes
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM calls) as total_calls,
        (SELECT COUNT(*) FROM applications) as total_applications,
        (SELECT COUNT(*) FROM milestones) as total_milestones,
        (SELECT COUNT(*) FROM milestone_progress) as total_progress,
        (SELECT COUNT(*) FROM invites) as total_invites,
        (SELECT COUNT(*) FROM form_submissions) as total_submissions
    `);

    console.log('\n📈 Estadísticas finales:');
    console.log(`   Convocatorias: ${stats.rows[0].total_calls}`);
    console.log(`   Applications: ${stats.rows[0].total_applications}`);
    console.log(`   Milestones: ${stats.rows[0].total_milestones}`);
    console.log(`   Milestone Progress: ${stats.rows[0].total_progress}`);
    console.log(`   Invites: ${stats.rows[0].total_invites}`);
    console.log(`   Form Submissions: ${stats.rows[0].total_submissions}`);

    console.log('\n✅ Limpieza completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

cleanDatabase();
