const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

/**
 * Script para limpiar la base de datos y dejarla lista para producción
 * 
 * IMPORTANTE: Este script elimina datos de prueba pero mantiene:
 * - Usuarios ADMIN (puedes elegir cuáles mantener)
 * - Usuarios REVIEWER
 * - Estructura de tablas
 */

async function cleanForProduction() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║        LIMPIEZA DE BASE DE DATOS PARA PRODUCCIÓN            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log('⚠️  IMPORTANTE: Este script eliminará datos de prueba.');
    console.log('⚠️  Asegúrate de tener un backup antes de continuar.\n');
    
    // Descomenta la siguiente línea para ejecutar (seguridad)
    const EXECUTE = true; // Cambiar a true para ejecutar
    
    if (!EXECUTE) {
      console.log('🔒 MODO SEGURO: El script está en modo lectura.');
      console.log('   Para ejecutar, cambia EXECUTE = true en el código.\n');
    }

    // 1. ELIMINAR USUARIOS DE PRUEBA
    console.log('1️⃣  Eliminando usuarios APPLICANT de prueba...');
    const deleteTestUsers = `
      DELETE FROM users 
      WHERE role = 'APPLICANT' 
      AND (
        email LIKE '%test%' OR 
        email LIKE '%prueba%' OR 
        email LIKE '%@asfasf%' OR
        email LIKE '%djdjd%' OR
        email LIKE '%kdid%' OR
        email NOT LIKE '%@%.%'
      )
    `;
    
    if (EXECUTE) {
      const result = await client.query(deleteTestUsers);
      console.log(`   ✅ Eliminados ${result.rowCount} usuarios de prueba\n`);
    } else {
      const count = await client.query(deleteTestUsers.replace('DELETE FROM', 'SELECT COUNT(*) FROM'));
      console.log(`   📊 Se eliminarían ${count.rows[0].count} usuarios de prueba\n`);
    }

    // 2. ELIMINAR CONVOCATORIAS DE PRUEBA
    console.log('2️⃣  Eliminando convocatorias de prueba...');
    const deleteTestCalls = `
      DELETE FROM calls 
      WHERE name ILIKE '%test%' 
      OR name ILIKE '%prueba%'
      OR name NOT ILIKE '%fcg%'
      OR name NOT ILIKE '%beca%'
    `;
    
    if (EXECUTE) {
      const result = await client.query(deleteTestCalls);
      console.log(`   ✅ Eliminadas ${result.rowCount} convocatorias de prueba\n`);
    } else {
      const count = await client.query(deleteTestCalls.replace('DELETE FROM', 'SELECT COUNT(*) FROM'));
      console.log(`   📊 Se eliminarían ${count.rows[0].count} convocatorias de prueba\n`);
    }

    // 3. ELIMINAR FORMULARIOS HUÉRFANOS
    console.log('3️⃣  Eliminando formularios no utilizados...');
    const deleteOrphanForms = `
      DELETE FROM forms
      WHERE id NOT IN (
        SELECT DISTINCT form_id 
        FROM milestones 
        WHERE form_id IS NOT NULL
      )
    `;
    
    if (EXECUTE) {
      const result = await client.query(deleteOrphanForms);
      console.log(`   ✅ Eliminados ${result.rowCount} formularios huérfanos\n`);
    } else {
      const count = await client.query(deleteOrphanForms.replace('DELETE FROM', 'SELECT COUNT(*) FROM'));
      console.log(`   📊 Se eliminarían ${count.rows[0].count} formularios huérfanos\n`);
    }

    // 4. ELIMINAR INSTITUCIONES DE PRUEBA
    console.log('4️⃣  Eliminando instituciones de prueba...');
    const deleteTestInstitutions = `
      DELETE FROM institutions
      WHERE name ILIKE '%demo%'
      OR name ILIKE '%prueba%'
      OR name ILIKE '%test%'
      OR code ILIKE '%dem%'
    `;
    
    if (EXECUTE) {
      const result = await client.query(deleteTestInstitutions);
      console.log(`   ✅ Eliminadas ${result.rowCount} instituciones de prueba\n`);
    } else {
      const count = await client.query(deleteTestInstitutions.replace('DELETE FROM', 'SELECT COUNT(*) FROM'));
      console.log(`   📊 Se eliminarían ${count.rows[0].count} instituciones de prueba\n`);
    }

    // 5. REVOCAR SESIONES ANTIGUAS
    console.log('5️⃣  Revocando sesiones...');
    const revokeSessions = `
      UPDATE user_sessions 
      SET revoked_at = NOW()
      WHERE revoked_at IS NULL
    `;
    
    if (EXECUTE) {
      const result = await client.query(revokeSessions);
      console.log(`   ✅ Revocadas ${result.rowCount} sesiones\n`);
    } else {
      const count = await client.query('SELECT COUNT(*) FROM user_sessions WHERE revoked_at IS NULL');
      console.log(`   📊 Se revocarían ${count.rows[0].count} sesiones\n`);
    }

    // 6. ELIMINAR TOKENS EXPIRADOS
    console.log('6️⃣  Eliminando tokens expirados...');
    
    const deleteExpiredTokens = [
      'DELETE FROM password_set_tokens WHERE expires_at < NOW()',
      'DELETE FROM password_resets WHERE expires_at < NOW()',
      'DELETE FROM password_change_tokens WHERE expires_at < NOW()'
    ];
    
    let totalTokens = 0;
    for (const query of deleteExpiredTokens) {
      if (EXECUTE) {
        const result = await client.query(query);
        totalTokens += result.rowCount;
      } else {
        const count = await client.query(query.replace('DELETE FROM', 'SELECT COUNT(*) FROM'));
        totalTokens += parseInt(count.rows[0].count);
      }
    }
    
    console.log(`   ${EXECUTE ? '✅' : '📊'} ${EXECUTE ? 'Eliminados' : 'Se eliminarían'} ${totalTokens} tokens expirados\n`);

    // 7. LIMPIAR INVITACIONES NO USADAS
    console.log('7️⃣  Eliminando invitaciones sin usar...');
    const deleteUnusedInvites = `
      DELETE FROM invites 
      WHERE used_at IS NULL 
      AND expires_at < NOW()
    `;
    
    if (EXECUTE) {
      const result = await client.query(deleteUnusedInvites);
      console.log(`   ✅ Eliminadas ${result.rowCount} invitaciones expiradas\n`);
    } else {
      const count = await client.query(deleteUnusedInvites.replace('DELETE FROM', 'SELECT COUNT(*) FROM'));
      console.log(`   📊 Se eliminarían ${count.rows[0].count} invitaciones expiradas\n`);
    }

    // RESUMEN FINAL
    console.log('═'.repeat(60));
    console.log('📊 ESTADO DESPUÉS DE LA LIMPIEZA');
    console.log('═'.repeat(60));
    
    const finalStats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'ADMIN') as admins,
        (SELECT COUNT(*) FROM users WHERE role = 'REVIEWER') as reviewers,
        (SELECT COUNT(*) FROM users WHERE role = 'APPLICANT') as applicants,
        (SELECT COUNT(*) FROM applications) as applications,
        (SELECT COUNT(*) FROM calls) as calls,
        (SELECT COUNT(*) FROM forms) as forms,
        (SELECT COUNT(*) FROM institutions) as institutions,
        (SELECT COUNT(*) FROM user_sessions WHERE revoked_at IS NULL) as active_sessions
    `);
    
    const s = finalStats.rows[0];
    console.log(`
${EXECUTE ? 'Estado actual:' : 'Estado después de limpieza:'}
  • ${s.admins} Administradores
  • ${s.reviewers} Revisores
  • ${s.applicants} Postulantes ${EXECUTE ? '' : '(después de limpieza)'}
  • ${s.calls} Convocatorias ${EXECUTE ? '' : '(después de limpieza)'}
  • ${s.forms} Formularios ${EXECUTE ? '' : '(después de limpieza)'}
  • ${s.institutions} Instituciones ${EXECUTE ? '' : '(después de limpieza)'}
  • ${s.applications} Aplicaciones
  • ${s.active_sessions} Sesiones activas ${EXECUTE ? '' : '(después de limpieza)'}
    `);

    if (!EXECUTE) {
      console.log('═'.repeat(60));
      console.log('⚠️  PARA EJECUTAR LA LIMPIEZA:');
      console.log('   1. Haz backup de la base de datos');
      console.log('   2. Cambia EXECUTE = true en el script');
      console.log('   3. Vuelve a ejecutar el script');
      console.log('═'.repeat(60));
    } else {
      console.log('═'.repeat(60));
      console.log('✅ LIMPIEZA COMPLETADA');
      console.log('═'.repeat(60));
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanForProduction();
