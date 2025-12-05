/**
 * Script para limpiar la base de datos - VERSIÓN CORRECTA
 * - Elimina todos los postulantes (applicants)
 * - Elimina todas las convocatorias excepto la más reciente
 * - Limpia datos relacionados
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
        (SELECT COUNT(*) FROM milestones WHERE call_id != $1) as old_milestones_count
    `, [recentCall.id]);

    const counts = countsResult.rows[0];
    console.log('📊 Registros a eliminar:');
    console.log(`   - Postulantes: ${counts.applicants_count}`);
    console.log(`   - Postulaciones: ${counts.applications_count}`);
    console.log(`   - Invitaciones: ${counts.invites_count}`);
    console.log(`   - Convocatorias antiguas: ${counts.old_calls_count}`);
    console.log(`   - Hitos antiguos: ${counts.old_milestones_count}\n`);

    console.log('🗑️  Eliminando datos...\n');

    // 3. Eliminar datos relacionados con postulantes
    console.log('   Eliminando datos de postulantes...');
    
    await client.query('DELETE FROM form_submissions');
    await client.query('DELETE FROM milestone_progress');
    await client.query('DELETE FROM application_notes');
    await client.query('DELETE FROM application_status_history');
    await client.query('DELETE FROM scores');
    await client.query('DELETE FROM review_assignments');
    await client.query('DELETE FROM ranking_results');
    await client.query('DELETE FROM applications');
    await client.query('DELETE FROM password_set_tokens');
    await client.query('DELETE FROM invites');
    
    const applicantsResult = await client.query('DELETE FROM applicants RETURNING id');
    console.log(`   ✓ ${applicantsResult.rowCount} postulantes eliminados`);

    // 4. Eliminar convocatorias antiguas y sus datos relacionados
    console.log('\n   Eliminando convocatorias antiguas...');
    
    // Eliminar hitos de convocatorias antiguas
    const oldMilestonesResult = await client.query(`
      DELETE FROM milestones WHERE call_id != $1
    `, [recentCall.id]);
    console.log(`   ✓ ${oldMilestonesResult.rowCount} hitos eliminados`);

    // Eliminar políticas de instituciones
    await client.query(`
      DELETE FROM call_institution_policies WHERE call_id != $1
    `, [recentCall.id]);

    // Eliminar requisitos de documentos
    await client.query(`
      DELETE FROM call_document_requirements WHERE call_id != $1
    `, [recentCall.id]);

    // Eliminar convocatorias antiguas
    const oldCallsResult = await client.query(`
      DELETE FROM calls WHERE id != $1 RETURNING id
    `, [recentCall.id]);
    console.log(`   ✓ ${oldCallsResult.rowCount} convocatorias eliminadas`);

    await client.query('COMMIT');
    
    console.log('\n✅ Limpieza completada exitosamente!\n');
    console.log('📋 Resumen final:');
    console.log(`   - Convocatoria conservada: ${recentCall.name} ${recentCall.year}`);
    console.log(`   - Postulantes eliminados: ${applicantsResult.rowCount}`);
    console.log(`   - Convocatorias eliminadas: ${oldCallsResult.rowCount}`);
    console.log(`   - Hitos eliminados: ${oldMilestonesResult.rowCount}\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error durante la limpieza:', error.message);
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
console.log('  - TODOS los postulantes y sus postulaciones');
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
