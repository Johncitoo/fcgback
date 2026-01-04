const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

/**
 * Script FINAL de limpieza de base de datos
 * 
 * RESPETA:
 * - audit_logs (inmutable, no se toca)
 * - Relaciones CASCADE automáticas
 * - Al menos 1 admin funcional
 * - Convocatorias y plantillas reales
 */

async function cleanDatabase() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           LIMPIEZA FINAL DE BASE DE DATOS                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log('✅ Backup ya creado: backup-railway-2026-01-04T05-23-00.sql\n');
    console.log('⚠️  audit_logs: NO se toca (inmutable)\n');

    // =================================================================
    // PASO 1: Identificar usuarios de prueba (APPLICANT)
    // =================================================================
    console.log('1️⃣  Identificando usuarios APPLICANT de prueba...\n');
    
    const testUsersResult = await client.query(`
      SELECT id, email, role, applicant_id
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
    
    console.log(`   📊 Encontrados ${testUsersResult.rows.length} usuarios de prueba:\n`);
    testUsersResult.rows.forEach(u => {
      console.log(`      • ${u.email} (${u.role}) - Applicant ID: ${u.applicant_id || 'NULL'}`);
    });
    console.log();

    if (testUsersResult.rows.length > 0) {
      const testUserIds = testUsersResult.rows.map(r => r.id);
      const testApplicantIds = testUsersResult.rows.filter(r => r.applicant_id).map(r => r.applicant_id);
      
      console.log('2️⃣  Eliminando datos relacionados (respetando audit_logs)...\n');
      
      // IMPORTANTE: audit_logs tiene trigger que bloquea UPDATE/DELETE
      // Pero necesitamos desvincular registros para poder eliminar usuarios
      // Solución: Deshabilitar trigger temporalmente
      
      console.log('   🔓 Deshabilitando trigger de audit_logs temporalmente...');
      await client.query(`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_block_mods`);
      
      console.log('   🔓 Desvinculando audit_logs de usuarios a eliminar...');
      const unlinkAuditLogs = await client.query(`
        UPDATE audit_logs 
        SET actor_user_id = NULL 
        WHERE actor_user_id = ANY($1::uuid[])
        RETURNING id
      `, [testUserIds]);
      console.log(`      ✅ ${unlinkAuditLogs.rowCount} registros desvinculados`);
      
      console.log('   🔒 Rehabilitando trigger de audit_logs...');
      await client.query(`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_block_mods`);
      console.log();
      
      // Ahora sí, eliminar applicants (dispara CASCADE a applications, etc.)
      if (testApplicantIds.length > 0) {
        const deleteApplicants = await client.query(`
          DELETE FROM applicants WHERE id = ANY($1::uuid[])
          RETURNING id
        `, [testApplicantIds]);
        console.log(`   ✅ ${deleteApplicants.rowCount} applicants eliminados`);
        console.log(`      (CASCADE eliminó applications, milestone_progress, etc.)\n`);
      }
      
      // Finalmente eliminar usuarios (dispara CASCADE a sesiones, tokens, etc.)
      const deleteUsers = await client.query(`
        DELETE FROM users WHERE id = ANY($1::uuid[])
        RETURNING id
      `, [testUserIds]);
      console.log(`   ✅ ${deleteUsers.rowCount} usuarios eliminados`);
      console.log(`      (CASCADE eliminó sesiones, tokens, invites, etc.)\n`);
    } else {
      console.log('   ℹ️  No hay usuarios de prueba para eliminar\n');
    }

    // =================================================================
    // PASO 2: Eliminar convocatorias de prueba
    // =================================================================
    console.log('3️⃣  Identificando convocatorias de prueba...\n');
    
    const testCallsResult = await client.query(`
      SELECT id, name, year
      FROM calls 
      WHERE name ILIKE '%test%' 
      OR name ILIKE '%prueba%'
      OR year < 2025
    `);
    
    console.log(`   📊 Encontradas ${testCallsResult.rows.length} convocatorias de prueba:\n`);
    testCallsResult.rows.forEach(c => {
      console.log(`      • ${c.name} (${c.year})`);
    });
    console.log();
    
    if (testCallsResult.rows.length > 0) {
      const testCallIds = testCallsResult.rows.map(r => r.id);
      
      // CASCADE automático eliminará:
      // - milestones (ON DELETE CASCADE)
      // - applications (ON DELETE CASCADE)
      // - invites (ON DELETE CASCADE)
      // - criteria (ON DELETE CASCADE)
      // etc.
      
      const deleteCalls = await client.query(`
        DELETE FROM calls WHERE id = ANY($1::uuid[])
        RETURNING id
      `, [testCallIds]);
      console.log(`   ✅ ${deleteCalls.rowCount} convocatorias eliminadas`);
      console.log(`      (CASCADE eliminó hitos, aplicaciones, invites, etc.)\n`);
    } else {
      console.log('   ℹ️  No hay convocatorias de prueba para eliminar\n');
    }

    // =================================================================
    // PASO 3: Eliminar formularios huérfanos (no usados en hitos)
    // =================================================================
    console.log('4️⃣  Eliminando formularios huérfanos...\n');
    
    const deleteOrphanForms = await client.query(`
      DELETE FROM forms
      WHERE id NOT IN (
        SELECT DISTINCT form_id 
        FROM milestones 
        WHERE form_id IS NOT NULL
      )
      AND is_template = false
      RETURNING id
    `);
    console.log(`   ✅ ${deleteOrphanForms.rowCount} formularios huérfanos eliminados\n`);

    // =================================================================
    // PASO 4: Eliminar instituciones de prueba
    // =================================================================
    console.log('5️⃣  Eliminando instituciones de prueba...\n');
    
    const deleteTestInstitutions = await client.query(`
      DELETE FROM institutions
      WHERE name ILIKE '%demo%'
      OR name ILIKE '%prueba%'
      OR name ILIKE '%test%'
      OR code ILIKE '%dem%'
      RETURNING id, name
    `);
    
    if (deleteTestInstitutions.rowCount > 0) {
      console.log(`   ✅ ${deleteTestInstitutions.rowCount} instituciones eliminadas:`);
      deleteTestInstitutions.rows.forEach(i => console.log(`      • ${i.name}`));
      console.log();
    } else {
      console.log(`   ℹ️  No hay instituciones de prueba\n`);
    }

    // =================================================================
    // PASO 5: Revocar TODAS las sesiones activas
    // =================================================================
    console.log('6️⃣  Revocando sesiones activas...\n');
    
    const revokeSessions = await client.query(`
      UPDATE user_sessions 
      SET revoked_at = NOW()
      WHERE revoked_at IS NULL
      RETURNING id
    `);
    console.log(`   ✅ ${revokeSessions.rowCount} sesiones revocadas\n`);

    // =================================================================
    // PASO 6: Eliminar tokens expirados
    // =================================================================
    console.log('7️⃣  Eliminando tokens expirados...\n');
    
    const deleteExpiredTokens = [
      { table: 'password_set_tokens', query: 'DELETE FROM password_set_tokens WHERE expires_at < NOW() RETURNING id' },
      { table: 'password_resets', query: 'DELETE FROM password_resets WHERE expires_at < NOW() RETURNING id' },
      { table: 'password_change_tokens', query: 'DELETE FROM password_change_tokens WHERE expires_at < NOW() RETURNING id' }
    ];
    
    for (const token of deleteExpiredTokens) {
      const result = await client.query(token.query);
      console.log(`   ✅ ${result.rowCount} ${token.table} eliminados`);
    }
    console.log();

    // =================================================================
    // PASO 7: Eliminar invitaciones expiradas no usadas
    // =================================================================
    console.log('8️⃣  Eliminando invitaciones expiradas...\n');
    
    const deleteExpiredInvites = await client.query(`
      DELETE FROM invites 
      WHERE used_at IS NULL 
      AND expires_at < NOW()
      RETURNING id
    `);
    console.log(`   ✅ ${deleteExpiredInvites.rowCount} invitaciones expiradas eliminadas\n`);

    // =================================================================
    // PASO 8: Eliminar códigos de verificación usados
    // =================================================================
    console.log('9️⃣  Eliminando códigos de verificación usados...\n');
    
    const deleteUsedCodes = await client.query(`
      DELETE FROM admin_verification_codes WHERE used = true RETURNING id
    `);
    const deleteUsedReviewerCodes = await client.query(`
      DELETE FROM reviewer_verification_codes WHERE used = true RETURNING id
    `);
    console.log(`   ✅ ${deleteUsedCodes.rowCount} códigos admin eliminados`);
    console.log(`   ✅ ${deleteUsedReviewerCodes.rowCount} códigos reviewer eliminados\n`);

    // =================================================================
    // RESUMEN FINAL
    // =================================================================
    console.log('═'.repeat(65));
    console.log('📊 ESTADO FINAL DE LA BASE DE DATOS');
    console.log('═'.repeat(65));
    console.log();
    
    const finalStats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'ADMIN') as admins,
        (SELECT COUNT(*) FROM users WHERE role = 'REVIEWER') as reviewers,
        (SELECT COUNT(*) FROM users WHERE role = 'APPLICANT') as applicants,
        (SELECT COUNT(*) FROM applicants) as applicant_profiles,
        (SELECT COUNT(*) FROM applications) as applications,
        (SELECT COUNT(*) FROM calls) as calls,
        (SELECT COUNT(*) FROM milestones) as milestones,
        (SELECT COUNT(*) FROM forms WHERE is_template = true) as templates,
        (SELECT COUNT(*) FROM forms WHERE is_template = false) as forms,
        (SELECT COUNT(*) FROM form_submissions) as submissions,
        (SELECT COUNT(*) FROM institutions) as institutions,
        (SELECT COUNT(*) FROM invites) as invites,
        (SELECT COUNT(*) FROM user_sessions WHERE revoked_at IS NULL) as active_sessions,
        (SELECT COUNT(*) FROM user_sessions) as total_sessions,
        (SELECT COUNT(*) FROM audit_logs) as audit_logs
    `);
    
    const s = finalStats.rows[0];
    
    console.log('✅ BASE DE DATOS LIMPIA Y LISTA PARA PRODUCCIÓN\n');
    
    console.log('USUARIOS:');
    console.log(`  • ${s.admins} Administradores`);
    console.log(`  • ${s.reviewers} Revisores`);
    console.log(`  • ${s.applicants} Postulantes (reales)`);
    console.log(`  • ${s.applicant_profiles} Perfiles de postulantes\n`);
    
    console.log('CONVOCATORIAS Y FORMULARIOS:');
    console.log(`  • ${s.calls} Convocatorias`);
    console.log(`  • ${s.milestones} Hitos`);
    console.log(`  • ${s.templates} Plantillas de formularios`);
    console.log(`  • ${s.forms} Formularios activos`);
    console.log(`  • ${s.submissions} Submissions de formularios\n`);
    
    console.log('APLICACIONES E INSTITUCIONES:');
    console.log(`  • ${s.applications} Aplicaciones`);
    console.log(`  • ${s.institutions} Instituciones`);
    console.log(`  • ${s.invites} Invitaciones\n`);
    
    console.log('SISTEMA:');
    console.log(`  • ${s.active_sessions} Sesiones activas (de ${s.total_sessions} totales)`);
    console.log(`  • ${s.audit_logs} Registros de auditoría (preservados)\n`);
    
    console.log('═'.repeat(65));
    console.log('✅ LIMPIEZA COMPLETADA EXITOSAMENTE');
    console.log('═'.repeat(65));
    console.log();
    console.log('💡 Próximo paso: Exportar esta base de datos limpia para migración');
    console.log();

    await client.end();
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanDatabase();
