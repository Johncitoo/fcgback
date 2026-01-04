const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function checkProductionReadiness() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     ANÁLISIS DE PREPARACIÓN PARA PRODUCCIÓN                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // 1. Verificar usuarios ADMIN
    const admins = await client.query(`
      SELECT id, email, full_name, role, created_at, last_login_at
      FROM users 
      WHERE role = 'ADMIN'
      ORDER BY created_at
    `);
    
    console.log('📊 1. USUARIOS ADMINISTRADORES');
    console.log('─'.repeat(60));
    console.log(`Total ADMINs: ${admins.rows.length}`);
    admins.rows.forEach(admin => {
      console.log(`  ✓ ${admin.email} (${admin.full_name})`);
      console.log(`    - Creado: ${new Date(admin.created_at).toLocaleDateString()}`);
      console.log(`    - Último login: ${admin.last_login_at ? new Date(admin.last_login_at).toLocaleString() : 'Nunca'}`);
    });

    // 2. Verificar usuarios REVIEWER
    const reviewers = await client.query(`
      SELECT id, email, full_name, role, created_at, last_login_at
      FROM users 
      WHERE role = 'REVIEWER'
      ORDER BY created_at
    `);
    
    console.log('\n📊 2. USUARIOS REVISORES');
    console.log('─'.repeat(60));
    console.log(`Total REVIEWERs: ${reviewers.rows.length}`);
    reviewers.rows.forEach(reviewer => {
      console.log(`  ✓ ${reviewer.email} (${reviewer.full_name})`);
      console.log(`    - Último login: ${reviewer.last_login_at ? new Date(reviewer.last_login_at).toLocaleString() : 'Nunca'}`);
    });

    // 3. Datos de prueba (usuarios APPLICANT con emails sospechosos)
    const testApplicants = await client.query(`
      SELECT id, email, full_name, created_at
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
      ORDER BY created_at
    `);
    
    console.log('\n🧪 3. USUARIOS DE PRUEBA DETECTADOS');
    console.log('─'.repeat(60));
    console.log(`Total usuarios sospechosos: ${testApplicants.rows.length}`);
    if (testApplicants.rows.length > 0) {
      testApplicants.rows.forEach(user => {
        console.log(`  ⚠️  ${user.email} - "${user.full_name}"`);
      });
    }

    // 4. Verificar calls activas vs de prueba
    const calls = await client.query(`
      SELECT id, name, status, start_date, end_date, created_at
      FROM calls
      ORDER BY created_at DESC
    `);
    
    console.log('\n📢 4. CONVOCATORIAS');
    console.log('─'.repeat(60));
    calls.rows.forEach(call => {
      const isProd = call.name.toLowerCase().includes('fcg') || call.name.toLowerCase().includes('beca');
      console.log(`  ${isProd ? '✓' : '🧪'} ${call.name}`);
      console.log(`    - Estado: ${call.status}`);
      console.log(`    - Tipo: ${isProd ? 'PRODUCCIÓN' : 'PRUEBA'}`);
    });

    // 5. Forms vinculados a calls
    const formsInUse = await client.query(`
      SELECT DISTINCT f.id, f.name, f.created_at,
        (SELECT COUNT(*) FROM milestones WHERE form_id = f.id) as milestone_count
      FROM forms f
      INNER JOIN milestones m ON m.form_id = f.id
      ORDER BY f.created_at
    `);
    
    console.log('\n📋 5. FORMULARIOS EN USO (vinculados a hitos)');
    console.log('─'.repeat(60));
    console.log(`Total formularios activos: ${formsInUse.rows.length}`);
    formsInUse.rows.forEach(form => {
      console.log(`  ✓ ${form.name}`);
      console.log(`    - Usado en ${form.milestone_count} hito(s)`);
    });

    // 6. Forms huérfanos (sin usar)
    const orphanForms = await client.query(`
      SELECT id, name, created_at
      FROM forms
      WHERE id NOT IN (SELECT DISTINCT form_id FROM milestones WHERE form_id IS NOT NULL)
      ORDER BY created_at
    `);
    
    console.log('\n🗑️  6. FORMULARIOS HUÉRFANOS (no usados)');
    console.log('─'.repeat(60));
    console.log(`Total formularios sin usar: ${orphanForms.rows.length}`);
    if (orphanForms.rows.length > 0) {
      orphanForms.rows.forEach(form => {
        console.log(`  ⚠️  ${form.name} (creado: ${new Date(form.created_at).toLocaleDateString()})`);
      });
    }

    // 7. Instituciones de prueba
    const institutions = await client.query(`
      SELECT id, name, code, active, created_at
      FROM institutions
      ORDER BY created_at
    `);
    
    console.log('\n🏫 7. INSTITUCIONES');
    console.log('─'.repeat(60));
    institutions.rows.forEach(inst => {
      const isTest = inst.name.toLowerCase().includes('demo') || 
                     inst.name.toLowerCase().includes('prueba') ||
                     inst.name.toLowerCase().includes('test') ||
                     inst.code?.toLowerCase().includes('dem');
      console.log(`  ${isTest ? '🧪' : '✓'} ${inst.name} (${inst.code || 'sin código'})`);
      console.log(`    - Estado: ${inst.active ? 'ACTIVA' : 'INACTIVA'}`);
      console.log(`    - Tipo: ${isTest ? 'PRUEBA' : 'PRODUCCIÓN'}`);
    });

    // 8. Invitaciones sin usar
    const unusedInvites = await client.query(`
      SELECT COUNT(*) as total
      FROM invites
      WHERE used_at IS NULL
    `);
    
    console.log('\n📧 8. INVITACIONES');
    console.log('─'.repeat(60));
    console.log(`Invitaciones sin usar: ${unusedInvites.rows[0].total}`);

    // 9. Sesiones activas
    const activeSessions = await client.query(`
      SELECT COUNT(*) as total,
        COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as valid,
        COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired
      FROM user_sessions
      WHERE revoked_at IS NULL
    `);
    
    console.log('\n🔐 9. SESIONES');
    console.log('─'.repeat(60));
    console.log(`Total sesiones: ${activeSessions.rows[0].total}`);
    console.log(`  - Válidas: ${activeSessions.rows[0].valid}`);
    console.log(`  - Expiradas: ${activeSessions.rows[0].expired}`);

    // 10. Tokens pendientes
    const pendingTokens = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM password_set_tokens WHERE used_at IS NULL AND expires_at > NOW()) as password_set,
        (SELECT COUNT(*) FROM password_resets WHERE used_at IS NULL AND expires_at > NOW()) as password_reset,
        (SELECT COUNT(*) FROM password_change_tokens WHERE used = false AND expires_at > NOW()) as password_change
    `);
    
    console.log('\n🔑 10. TOKENS PENDIENTES');
    console.log('─'.repeat(60));
    console.log(`Password Set: ${pendingTokens.rows[0].password_set}`);
    console.log(`Password Reset: ${pendingTokens.rows[0].password_reset}`);
    console.log(`Password Change: ${pendingTokens.rows[0].password_change}`);

    // 11. Resumen de datos
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESUMEN EJECUTIVO');
    console.log('═'.repeat(60));
    
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'ADMIN') as admins,
        (SELECT COUNT(*) FROM users WHERE role = 'REVIEWER') as reviewers,
        (SELECT COUNT(*) FROM users WHERE role = 'APPLICANT') as applicants,
        (SELECT COUNT(*) FROM applications) as applications,
        (SELECT COUNT(*) FROM form_submissions) as submissions,
        (SELECT COUNT(*) FROM calls) as calls,
        (SELECT COUNT(*) FROM forms) as forms,
        (SELECT COUNT(*) FROM milestones) as milestones,
        (SELECT COUNT(*) FROM institutions) as institutions
    `);
    
    const s = summary.rows[0];
    console.log(`
Usuarios:
  • ${s.admins} Administradores
  • ${s.reviewers} Revisores  
  • ${s.applicants} Postulantes

Convocatorias y Formularios:
  • ${s.calls} Convocatorias
  • ${s.forms} Formularios
  • ${s.milestones} Hitos

Postulaciones:
  • ${s.applications} Aplicaciones
  • ${s.submissions} Envíos de formularios

Instituciones:
  • ${s.institutions} Instituciones registradas
    `);

    console.log('═'.repeat(60));
    console.log('\n✅ RECOMENDACIONES PARA PRODUCCIÓN:\n');
    console.log('1. ✓ Mantener solo 2-3 usuarios ADMIN con emails corporativos');
    console.log('2. ⚠️  Eliminar todos los usuarios APPLICANT de prueba');
    console.log('3. ⚠️  Eliminar convocatorias de prueba (mantener solo plantillas)');
    console.log('4. ⚠️  Limpiar formularios huérfanos');
    console.log('5. ⚠️  Eliminar instituciones de prueba/demo');
    console.log('6. ⚠️  Revocar todas las sesiones existentes');
    console.log('7. ⚠️  Limpiar tokens expirados');
    console.log('8. ⚠️  Eliminar invitaciones de prueba');
    console.log('9. ✓ Verificar variables de entorno (URLs, emails, API keys)');
    console.log('10. ✓ Configurar emails de producción (SendGrid/Resend)');
    console.log('11. ✓ Activar logging y monitoreo');
    console.log('12. ✓ Backup de BD antes de lanzar\n');

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProductionReadiness();
