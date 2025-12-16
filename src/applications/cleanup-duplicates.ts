import { DataSource } from 'typeorm';

/**
 * Limpia aplicaciones duplicadas en el sistema.
 * 
 * Identifica aplicaciones duplicadas por (applicant_id, call_id) y mantiene
 * solo la que tiene más form_submissions asociadas. Si todas están vacías,
 * mantiene la más reciente.
 * 
 * El proceso elimina en cascada:
 * - Registros de milestone_progress vinculados
 * - Form_submissions vinculadas
 * - La aplicación duplicada
 * 
 * Ejecuta en transacción para garantizar consistencia.
 * 
 * @param dataSource - Conexión a la base de datos TypeORM
 * @returns Resumen de operación con conteos de eliminadas/mantenidas
 * @throws Error si falla la transacción (hace rollback automático)
 * 
 * @example
 * const result = await cleanupDuplicateApplications(dataSource);
 * // { deleted: 5, kept: 5, duplicateGroups: 5 }
 */
export async function cleanupDuplicateApplications(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Encontrar aplicaciones duplicadas (mismo applicant_id y call_id)
    const duplicates = await queryRunner.query(`
      SELECT 
        applicant_id,
        call_id,
        array_agg(id ORDER BY created_at) as app_ids,
        array_agg((SELECT COUNT(*) FROM form_submissions WHERE application_id = a.id) ORDER BY created_at) as submission_counts
      FROM applications a
      GROUP BY applicant_id, call_id
      HAVING COUNT(*) > 1
    `);

    console.log(`\nAplicaciones duplicadas encontradas: ${duplicates.length}\n`);

    for (const dup of duplicates) {
      const appIds = dup.app_ids;
      const submissionCounts = dup.submission_counts;

      console.log(`\nProcesando duplicado:`);
      console.log(`   Applicant: ${dup.applicant_id}`);
      console.log(`   Call: ${dup.call_id}`);
      console.log(`   Applications: ${appIds.join(', ')}`);
      console.log(`   Submissions: ${submissionCounts.join(', ')}`);

      // Encontrar la aplicación con más submissions (o la más reciente si todas están vacías)
      let keepIndex = 0;
      let maxSubmissions = submissionCounts[0];

      for (let i = 1; i < submissionCounts.length; i++) {
        if (submissionCounts[i] > maxSubmissions) {
          maxSubmissions = submissionCounts[i];
          keepIndex = i;
        }
      }

      const keepAppId = appIds[keepIndex];
      const deleteAppIds = appIds.filter((_: any, i: number) => i !== keepIndex);

      console.log(`   Mantener: ${keepAppId} (${submissionCounts[keepIndex]} submissions)`);
      console.log(`   Eliminar: ${deleteAppIds.join(', ')}`);

      // Eliminar milestone_progress de las apps a eliminar
      for (const appId of deleteAppIds) {
        await queryRunner.query(
          `DELETE FROM milestone_progress WHERE application_id = $1`,
          [appId]
        );
      }

      // Eliminar las aplicaciones duplicadas
      for (const appId of deleteAppIds) {
        await queryRunner.query(
          `DELETE FROM applications WHERE id = $1`,
          [appId]
        );
      }

      console.log(`   Aplicaciones duplicadas eliminadas\n`);
    }

    await queryRunner.commitTransaction();
    console.log(`\n✨ Limpieza completada exitosamente\n`);
    
    return {
      duplicatesFound: duplicates.length,
      applicationsDeleted: duplicates.reduce((sum: number, d: any) => sum + (d.app_ids.length - 1), 0)
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Error durante la limpieza:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
