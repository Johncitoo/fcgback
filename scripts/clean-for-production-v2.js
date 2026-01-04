const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

/**
 * Script para limpiar la base de datos y dejarla lista para producción
 * Versión 2: Maneja correctamente las restricciones de foreign keys y audit_logs
 */

async function cleanForProduction() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║        LIMPIEZA DE BASE DE DATOS PARA PRODUCCIÓN V2         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log('⚠️  IMPORTANTE: Este script eliminará datos de prueba.');
    console.log('⚠️  Backup ya creado: backup-railway-2026-01-04T05-23-00.sql\n');

    // PASO 1: Obtener IDs de usuarios de prueba
    console.log('1️⃣  Identificando usuarios de prueba...');
    const testUsersResult = await client.query(`
      SELECT id, email, role 
      FROM users 
      WHERE role = 'APPLICANT' 
      AND (
        email LIKE '%test%' OR 
        email LIKE '%prueba%' OR 
        email LIKE '%@asfasf%' OR
        email LIKE '%djdjd%' OR
        email LIKE '%kdid%' OR
        email NOT LIKE '%@%.%'
      )
    `);
    
    const testUserIds = testUsersResult.rows.map(r => r.id);
    console.log(`   📊 Encontrados ${testUserIds.length} usuarios de prueba:`);
    testUsersResult.rows.forEach(u => console.log(`      • ${u.email} (${u.role})`));
    console.log();

    if (testUserIds.length > 0) {
      // PASO 2: Eliminar datos relacionados con usuarios de prueba
      console.log('2️⃣  Eliminando datos relacionados...');
      
      // Nota: audit_logs es append-only, NO lo eliminamos
      console.log('   ⏭️  Saltando audit_logs (append-only)');
      
      // Obtener applicant_ids de estos usuarios
      const applicantIdsResult = await client.query(`
        SELECT applicant_id FROM users WHERE id = ANY($1) AND applicant_id IS NOT NULL
      `, [testUserIds]);
      const testApplicantIds = applicantIdsResult.rows.map(r => r.applicant_id);
      
      // Eliminar aplicaciones de usuarios de prueba
      if (testApplicantIds.length > 0) {
        const deleteApplications = await client.query(`
          DELETE FROM applications WHERE applicant_id = ANY($1)
        `, [testApplicantIds]);
        console.log(`   ✅ ${deleteApplications.rowCount} aplicaciones eliminadas`);
        
        // Eliminar applicants
        const deleteApplicants = await client.query(`
          DELETE FROM applicants WHERE id = ANY($1)
        `, [testApplicantIds]);
        console.log(`   ✅ ${deleteApplicants.rowCount} applicants eliminados`);
      }
      
      // Eliminar form_submissions
      const deleteSubmissions = await client.query(`
        DELETE FROM form_submissions WHERE user_id = ANY($1)
      `, [testUserIds]);
      console.log(`   ✅ ${deleteSubmissions.rowCount} form submissions eliminados`);
      
      // Eliminar sesiones
      const deleteSessions = await client.query(`
        DELETE FROM user_sessions WHERE user_id = ANY($1)
      `, [testUserIds]);
      console.log(`   ✅ ${deleteSessions.rowCount} sesiones eliminadas`);
      
      // Eliminar invites
      const deleteInvites = await client.query(`
        DELETE FROM invites WHERE email IN (SELECT email FROM users WHERE id = ANY($1))
      `, [testUserIds]);
      console.log(`   ✅ ${deleteInvites.rowCount} invitaciones eliminadas`);
      
      // Finalmente eliminar usuarios
      const deleteUsers = await client.query(`
        DELETE FROM users WHERE id = ANY($1)
      `, [testUserIds]);
      console.log(`   ✅ ${deleteUsers.rowCount} usuarios eliminados\n`);
    }

    // PASO 3: Eliminar convocatorias de prueba
    console.log('3️⃣  Eliminando convocatorias de prueba...');
    const testCallsResult = await client.query(`
      SELECT id, name 
      FROM calls 
      WHERE name ILIKE '%test%' 
      OR name ILIKE '%prueba%'
    `);
    
    const testCallIds = testCallsResult.rows.map(r => r.id);
    console.log(`   📊 Encontradas ${testCallIds.length} convocatorias de prueba:`);
    testCallsResult.rows.forEach(c => console.log(`      • ${c.name}`));
    console.log();
    
    if (testCallIds.length > 0) {
      // Eliminar hitos de convocatorias de prueba
      const deleteMilestones = await client.query(`
        DELETE FROM milestones WHERE call_id = ANY($1)
      `, [testCallIds]);
      console.log(`   ✅ ${deleteMilestones.rowCount} hitos eliminados`);
      
      // Eliminar convocatorias
      const deleteCalls = await client.query(`
        DELETE FROM calls WHERE id = ANY($1)
      `, [testCallIds]);
      console.log(`   ✅ ${deleteCalls.rowCount} convocatorias eliminadas\n`);
    }

    // PASO 4: Eliminar formularios huérfanos
    console.log('4️⃣  Eliminando formularios no utilizados...');
    const deleteOrphanForms = await client.query(`
      DELETE FROM forms
      WHERE id NOT IN (
        SELECT DISTINCT form_id 
        FROM milestones 
        WHERE form_id IS NOT NULL
      )
      AND is_template = false
    `);
    console.log(`   ✅ ${deleteOrphanForms.rowCount} formularios huérfanos eliminados\n`);

    // PASO 5: Eliminar instituciones de prueba
    console.log('5️⃣  Eliminando instituciones de prueba...');
    const deleteTestInstitutions = await client.query(`
      DELETE FROM institutions
      WHERE name ILIKE '%demo%'
      OR name ILIKE '%prueba%'
      OR name ILIKE '%test%'
      OR code ILIKE '%dem%'
    `);
    console.log(`   ✅ ${deleteTestInstitutions.rowCount} instituciones de prueba eliminadas\n`);

    // PASO 6: Revocar sesiones activas (mantener estructura)
    console.log('6️⃣  Revocando sesiones activas...');
    const revokeSessions = await client.query(`
      UPDATE user_sessions 
      SET revoked_at = NOW()
      WHERE revoked_at IS NULL
    `);
    console.log(`   ✅ ${revokeSessions.rowCount} sesiones revocadas\n`);

    // PASO 7: Eliminar tokens expirados
    console.log('7️⃣  Eliminando tokens expirados...');
    
    const deleteTokens = [
      { query: 'DELETE FROM password_set_tokens WHERE expires_at < NOW()', name: 'password_set_tokens' },
      { query: 'DELETE FROM password_resets WHERE expires_at < NOW()', name: 'password_resets' },
      { query: 'DELETE FROM password_change_tokens WHERE expires_at < NOW()', name: 'password_change_tokens' }
    ];
    
    let totalTokens = 0;
    for (const token of deleteTokens) {
      const result = await client.query(token.query);
      totalTokens += result.rowCount;
      console.log(`   ✅ ${result.rowCount} ${token.name} eliminados`);
    }
    console.log();

    // PASO 8: Eliminar invitaciones expiradas no usadas
    console.log('8️⃣  Eliminando invitaciones expiradas...');
    const deleteExpiredInvites = await client.query(`
      DELETE FROM invites 
      WHERE used_at IS NULL 
      AND expires_at < NOW()
    `);
    console.log(`   ✅ ${deleteExpiredInvites.rowCount} invitaciones expiradas eliminadas\n`);

    // RESUMEN FINAL
    console.log('═'.repeat(60));
    console.log('📊 ESTADO FINAL DE LA BASE DE DATOS');
    console.log('═'.repeat(60));
    
    const finalStats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'ADMIN') as admins,
        (SELECT COUNT(*) FROM users WHERE role = 'REVIEWER') as reviewers,
        (SELECT COUNT(*) FROM users WHERE role = 'APPLICANT') as applicants,
        (SELECT COUNT(*) FROM applications) as applications,
        (SELECT COUNT(*) FROM calls) as calls,
        (SELECT COUNT(*) FROM forms WHERE is_template = true) as templates,
        (SELECT COUNT(*) FROM forms WHERE is_template = false) as forms,
        (SELECT COUNT(*) FROM milestones) as milestones,
        (SELECT COUNT(*) FROM institutions) as institutions,
        (SELECT COUNT(*) FROM user_sessions WHERE revoked_at IS NULL) as active_sessions,
        (SELECT COUNT(*) FROM audit_logs) as audit_logs
    `);
    
    const s = finalStats.rows[0];
    console.log(`
✅ Base de datos limpia y lista para producción:

USUARIOS:
  • ${s.admins} Administradores
  • ${s.reviewers} Revisores
  • ${s.applicants} Postulantes (reales)

CONVOCATORIAS Y FORMULARIOS:
  • ${s.calls} Convocatorias
  • ${s.milestones} Hitos
  • ${s.templates} Plantillas de formularios
  • ${s.forms} Formularios activos
  • ${s.institutions} Instituciones

APLICACIONES:
  • ${s.applications} Aplicaciones

SISTEMA:
  • ${s.active_sessions} Sesiones activas
  • ${s.audit_logs} Registros de auditoría (conservados)
    `);

    console.log('═'.repeat(60));
    console.log('✅ LIMPIEZA COMPLETADA EXITOSAMENTE');
    console.log('═'.repeat(60));
    console.log('\n💡 Próximo paso: Exportar esta base de datos limpia\n');

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanForProduction();
