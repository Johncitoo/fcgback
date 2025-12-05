/**
 * Script para limpiar la base de datos
 * - Elimina todos los postulantes (applicants)
 * - Elimina todas las convocatorias excepto la más reciente
 * - Limpia datos relacionados (applications, invitations, etc.)
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function cleanDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Iniciando limpieza de base de datos...\n');
    
    await client.query('BEGIN');

    // 1. Obtener la convocatoria más reciente
    const recentCallResult = await client.query(`
      SELECT id, name, year, status
      FROM calls
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (recentCallResult.rows.length === 0) {
      console.log('⚠️  No hay convocatorias en la base de datos');
      await client.query('ROLLBACK');
      return;
    }

    const recentCall = recentCallResult.rows[0];
    console.log(`📌 Convocatoria más reciente a conservar:`);
    console.log(`   ID: ${recentCall.id}`);
    console.log(`   Nombre: ${recentCall.name}`);
    console.log(`   Año: ${recentCall.year}`);
    console.log(`   Estado: ${recentCall.status}\n`);

    // 2. Contar registros antes de eliminar
    const countsResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM applicants) as applicants_count,
        (SELECT COUNT(*) FROM applications) as applications_count,
        (SELECT COUNT(*) FROM invites) as invites_count,
        (SELECT COUNT(*) FROM calls WHERE id != $1) as old_calls_count,
        (SELECT COUNT(*) FROM forms WHERE call_id != $1) as old_forms_count,
        (SELECT COUNT(*) FROM milestones WHERE call_id != $1) as old_milestones_count
    `, [recentCall.id]);

    const counts = countsResult.rows[0];
    console.log('📊 Registros a eliminar:');
    console.log(`   - Postulantes: ${counts.applicants_count}`);
    console.log(`   - Postulaciones: ${counts.applications_count}`);
    console.log(`   - Invitaciones: ${counts.invites_count}`);
    console.log(`   - Convocatorias antiguas: ${counts.old_calls_count}`);
    console.log(`   - Formularios antiguos: ${counts.old_forms_count}`);
    console.log(`   - Hitos antiguos: ${counts.old_milestones_count}\n`);

    // 3. Eliminar datos relacionados con postulantes
    console.log('🗑️  Eliminando datos de postulantes...');
    
    // Eliminar form_submissions
    const formSubmissionsResult = await client.query('DELETE FROM form_submissions');
    console.log(`   ✓ Form submissions eliminados: ${formSubmissionsResult.rowCount}`);

    // Eliminar application_milestones
    const appMilestonesResult = await client.query('DELETE FROM application_milestones');
    console.log(`   ✓ Application milestones eliminados: ${appMilestonesResult.rowCount}`);

    // Eliminar application_notes
    const appNotesResult = await client.query('DELETE FROM application_notes');
    console.log(`   ✓ Application notes eliminadas: ${appNotesResult.rowCount}`);

    // Eliminar application_status_history
    const statusHistoryResult = await client.query('DELETE FROM application_status_history');
    console.log(`   ✓ Application status history eliminado: ${statusHistoryResult.rowCount}`);

    // Eliminar applications
    const applicationsResult = await client.query('DELETE FROM applications');
    console.log(`   ✓ Applications eliminadas: ${applicationsResult.rowCount}`);

    // Eliminar invites (no invitations)
    const invitesResult = await client.query('DELETE FROM invites');
    console.log(`   ✓ Invites eliminadas: ${invitesResult.rowCount}`);

    // Eliminar password_set_tokens
    const passwordTokensResult = await client.query('DELETE FROM password_set_tokens');
    console.log(`   ✓ Password tokens eliminados: ${passwordTokensResult.rowCount}`);

    // Eliminar applicants
    const applicantsResult = await client.query('DELETE FROM applicants');
    console.log(`   ✓ Applicants eliminados: ${applicantsResult.rowCount}\n`);

    // 4. Eliminar convocatorias antiguas y sus datos relacionados
    console.log('🗑️  Eliminando convocatorias antiguas...');

    // Eliminar form_fields de formularios antiguos
    const oldFieldsResult = await client.query(`
      DELETE FROM form_fields 
      WHERE section_id IN (
        SELECT id FROM form_sections 
        WHERE form_id IN (
          SELECT id FROM forms WHERE call_id != $1
        )
      )
    `, [recentCall.id]);
    console.log(`   ✓ Form fields eliminados: ${oldFieldsResult.rowCount}`);

    // Eliminar form_sections de formularios antiguos
    const oldSectionsResult = await client.query(`
      DELETE FROM form_sections 
      WHERE form_id IN (
        SELECT id FROM forms WHERE call_id != $1
      )
    `, [recentCall.id]);
    console.log(`   ✓ Form sections eliminadas: ${oldSectionsResult.rowCount}`);

    // Eliminar formularios antiguos
    const oldFormsResult = await client.query(`
      DELETE FROM forms WHERE call_id != $1
    `, [recentCall.id]);
    console.log(`   ✓ Forms eliminados: ${oldFormsResult.rowCount}`);

    // Eliminar hitos antiguos
    const oldMilestonesResult = await client.query(`
      DELETE FROM milestones WHERE call_id != $1
    `, [recentCall.id]);
    console.log(`   ✓ Milestones eliminados: ${oldMilestonesResult.rowCount}`);

    // Eliminar convocatorias antiguas
    const oldCallsResult = await client.query(`
      DELETE FROM calls WHERE id != $1
    `, [recentCall.id]);
    console.log(`   ✓ Calls eliminadas: ${oldCallsResult.rowCount}\n`);

    await client.query('COMMIT');
    
    console.log('✅ Limpieza completada exitosamente!\n');
    console.log('📋 Resumen:');
    console.log(`   - Convocatoria conservada: ${recentCall.name} ${recentCall.year}`);
    console.log(`   - Total de registros eliminados: ${
      parseInt(applicantsResult.rowCount) +
      parseInt(applicationsResult.rowCount) +
      parseInt(invitesResult.rowCount) +
      parseInt(oldCallsResult.rowCount) +
      parseInt(oldFormsResult.rowCount) +
      parseInt(oldMilestonesResult.rowCount) +
      parseInt(formSubmissionsResult.rowCount) +
      parseInt(appMilestonesResult.rowCount) +
      parseInt(oldFieldsResult.rowCount) +
      parseInt(oldSectionsResult.rowCount) +
      parseInt(appNotesResult.rowCount) +
      parseInt(statusHistoryResult.rowCount) +
      parseInt(passwordTokensResult.rowCount)
    }\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la limpieza:', error.message);
    console.error(error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Confirmación de seguridad
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  ADVERTENCIA: Esta operación eliminará datos de forma permanente\n');
console.log('Se eliminarán:');
console.log('  - TODOS los postulantes');
console.log('  - TODAS las postulaciones');
console.log('  - TODAS las invitaciones');
console.log('  - TODAS las convocatorias excepto la más reciente\n');

readline.question('¿Estás seguro de que quieres continuar? (escribe "SI" para confirmar): ', (answer) => {
  if (answer.toUpperCase() === 'SI') {
    cleanDatabase()
      .then(() => {
        console.log('✨ Proceso completado');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Error fatal:', error.message);
        process.exit(1);
      });
  } else {
    console.log('❌ Operación cancelada');
    pool.end();
    process.exit(0);
  }
  readline.close();
});
