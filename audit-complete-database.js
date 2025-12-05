require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function auditCompleteDatabase() {
  try {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║     AUDITORÍA COMPLETA - BASE DE DATOS FCG           ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    // 1. TABLAS PRINCIPALES
    console.log('📊 1. TABLAS PRINCIPALES DEL SISTEMA\n');
    
    const tables = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    const expectedTables = [
      'users', 'applicants', 'applications', 'calls', 'milestones',
      'milestone_progress', 'forms', 'form_submissions', 'invites',
      'institutions', 'files'
    ];

    console.log('Tablas esperadas:');
    expectedTables.forEach(table => {
      const exists = tables.rows.some(t => t.tablename === table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    });

    console.log(`\nTotal de tablas: ${tables.rows.length}\n`);

    // 2. USUARIOS Y ROLES
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 2. USUARIOS Y ROLES\n');

    const users = await pool.query(`
      SELECT role, COUNT(*) as count, is_active
      FROM users
      GROUP BY role, is_active
      ORDER BY role
    `);

    console.log('Usuarios por rol:');
    users.rows.forEach(row => {
      const active = row.is_active ? '🟢 Activo' : '🔴 Inactivo';
      console.log(`  ${row.role.padEnd(15)} | ${row.count} usuarios | ${active}`);
    });

    const adminUser = await pool.query(`
      SELECT email, full_name, is_active, created_at
      FROM users 
      WHERE role = 'ADMIN'
      LIMIT 1
    `);

    if (adminUser.rows.length > 0) {
      console.log('\n✅ Usuario Admin encontrado:');
      console.log(`   Email: ${adminUser.rows[0].email}`);
      console.log(`   Nombre: ${adminUser.rows[0].full_name}`);
      console.log(`   Estado: ${adminUser.rows[0].is_active ? 'Activo' : 'Inactivo'}\n`);
    } else {
      console.log('\n⚠️  No hay usuarios ADMIN\n');
    }

    // 3. CONVOCATORIAS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📢 3. CONVOCATORIAS\n');

    const calls = await pool.query(`
      SELECT 
        id, 
        name, 
        year, 
        status, 
        is_active,
        (SELECT COUNT(*) FROM milestones WHERE call_id = calls.id) as hitos_count,
        (SELECT COUNT(*) FROM applications WHERE call_id = calls.id) as postulaciones_count
      FROM calls
      ORDER BY year DESC, name
    `);

    if (calls.rows.length === 0) {
      console.log('⚠️  No hay convocatorias\n');
    } else {
      calls.rows.forEach(call => {
        const statusIcon = call.status === 'OPEN' ? '🟢' : call.status === 'DRAFT' ? '🟡' : '🔴';
        const activeIcon = call.is_active ? '✅' : '⚪';
        console.log(`${statusIcon} ${call.name} (${call.year})`);
        console.log(`   ${activeIcon} Status: ${call.status} | Active: ${call.is_active}`);
        console.log(`   📋 ${call.hitos_count} hitos | 👥 ${call.postulaciones_count} postulaciones`);
        console.log(`   ID: ${call.id}\n`);
      });
    }

    // 4. HITOS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 4. HITOS POR CONVOCATORIA\n');

    const milestones = await pool.query(`
      SELECT 
        m.name,
        m.order_index,
        m.status,
        m.required,
        m.who_can_fill,
        m.form_id,
        c.name as call_name,
        c.year as call_year
      FROM milestones m
      JOIN calls c ON c.id = m.call_id
      ORDER BY c.year DESC, c.name, m.order_index
    `);

    if (milestones.rows.length === 0) {
      console.log('⚠️  No hay hitos configurados\n');
    } else {
      let currentCall = '';
      milestones.rows.forEach(m => {
        const callName = `${m.call_name} (${m.call_year})`;
        if (currentCall !== callName) {
          console.log(`\n📢 ${callName}:`);
          currentCall = callName;
        }
        const statusIcon = m.status === 'ACTIVE' ? '🟢' : '🟡';
        const hasForm = m.form_id ? '📝' : '❌';
        console.log(`   ${statusIcon} ${m.order_index}. ${m.name}`);
        console.log(`      └─ ${m.required ? 'Obligatorio' : 'Opcional'} | ${m.who_can_fill.join(', ')} | Form: ${hasForm}`);
      });
      console.log('');
    }

    // 5. POSTULANTES
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👨‍🎓 5. POSTULANTES\n');

    const applicants = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as con_institucion
      FROM applicants
    `);

    console.log(`Total de postulantes: ${applicants.rows[0].total}`);
    console.log(`  └─ Con institución: ${applicants.rows[0].con_institucion}\n`);

    // 6. POSTULACIONES Y PROGRESO
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 6. POSTULACIONES Y PROGRESO\n');

    const applications = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM applications
      GROUP BY status
      ORDER BY count DESC
    `);

    if (applications.rows.length === 0) {
      console.log('⚠️  No hay postulaciones\n');
    } else {
      console.log('Postulaciones por estado:');
      applications.rows.forEach(app => {
        console.log(`  ${app.status.padEnd(20)} | ${app.count} postulaciones`);
      });
      console.log('');
    }

    const progress = await pool.query(`
      SELECT 
        status,
        review_status,
        COUNT(*) as count
      FROM milestone_progress
      GROUP BY status, review_status
      ORDER BY status, review_status
    `);

    if (progress.rows.length > 0) {
      console.log('Progreso de hitos:');
      progress.rows.forEach(p => {
        const review = p.review_status ? ` | Revisión: ${p.review_status}` : '';
        console.log(`  ${p.status.padEnd(20)}${review} | ${p.count} registros`);
      });
      console.log('');
    }

    // 7. INVITACIONES
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 7. INVITACIONES\n');

    const invites = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN used_by_applicant IS NOT NULL THEN 1 END) as usadas,
        COUNT(CASE WHEN expires_at < NOW() AND used_by_applicant IS NULL THEN 1 END) as expiradas
      FROM invites
    `);

    console.log(`Total de invitaciones: ${invites.rows[0].total}`);
    console.log(`  └─ Usadas: ${invites.rows[0].usadas}`);
    console.log(`  └─ Expiradas sin usar: ${invites.rows[0].expiradas}`);
    console.log(`  └─ Disponibles: ${invites.rows[0].total - invites.rows[0].usadas - invites.rows[0].expiradas}\n`);

    // 8. FORMULARIOS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 8. FORMULARIOS\n');

    const forms = await pool.query(`
      SELECT 
        id,
        title,
        description,
        (SELECT COUNT(*) FROM form_submissions WHERE form_id = forms.id) as submissions_count
      FROM forms
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (forms.rows.length === 0) {
      console.log('⚠️  No hay formularios\n');
    } else {
      console.log(`Total de formularios: ${forms.rows.length}`);
      forms.rows.forEach(form => {
        console.log(`\n  📝 ${form.title}`);
        if (form.description) {
          console.log(`     ${form.description}`);
        }
        console.log(`     └─ ${form.submissions_count} respuestas | ID: ${form.id.substring(0, 8)}...`);
      });
      console.log('');
    }

    // 9. INSTITUCIONES
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏫 9. INSTITUCIONES\n');

    const institutions = await pool.query(`
      SELECT 
        name,
        type,
        (SELECT COUNT(*) FROM applicants WHERE institution_id = institutions.id) as postulantes_count
      FROM institutions
      ORDER BY postulantes_count DESC
      LIMIT 5
    `);

    if (institutions.rows.length === 0) {
      console.log('⚠️  No hay instituciones\n');
    } else {
      console.log('Top instituciones:');
      institutions.rows.forEach(inst => {
        console.log(`  🏫 ${inst.name} (${inst.type})`);
        console.log(`     └─ ${inst.postulantes_count} postulantes`);
      });
      console.log('');
    }

    // 10. INTEGRIDAD REFERENCIAL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 10. VERIFICACIÓN DE INTEGRIDAD\n');

    // Verificar aplicaciones sin applicant
    const orphanApps = await pool.query(`
      SELECT COUNT(*) as count
      FROM applications
      WHERE applicant_id NOT IN (SELECT id FROM applicants)
    `);

    // Verificar milestone_progress sin application
    const orphanProgress = await pool.query(`
      SELECT COUNT(*) as count
      FROM milestone_progress
      WHERE application_id NOT IN (SELECT id FROM applications)
    `);

    // Verificar milestones sin call
    const orphanMilestones = await pool.query(`
      SELECT COUNT(*) as count
      FROM milestones
      WHERE call_id NOT IN (SELECT id FROM calls)
    `);

    console.log('Registros huérfanos (sin referencia válida):');
    console.log(`  ${orphanApps.rows[0].count === '0' ? '✅' : '❌'} Applications sin applicant: ${orphanApps.rows[0].count}`);
    console.log(`  ${orphanProgress.rows[0].count === '0' ? '✅' : '❌'} Milestone progress sin application: ${orphanProgress.rows[0].count}`);
    console.log(`  ${orphanMilestones.rows[0].count === '0' ? '✅' : '❌'} Milestones sin call: ${orphanMilestones.rows[0].count}\n`);

    // 11. COLUMNAS CRÍTICAS DEL CHANGELOG
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚙️  11. COLUMNAS CRÍTICAS (CHANGELOG_HITOS)\n');

    const criticalColumns = {
      milestone_progress: ['review_status', 'review_notes', 'reviewed_by', 'reviewed_at'],
      calls: ['is_active', 'start_date', 'end_date', 'auto_close']
    };

    for (const [table, columns] of Object.entries(criticalColumns)) {
      console.log(`Tabla ${table}:`);
      for (const col of columns) {
        const exists = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        `, [table, col]);
        console.log(`  ${exists.rows.length > 0 ? '✅' : '❌'} ${col}`);
      }
      console.log('');
    }

    // 12. TRIGGER DE RUT
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 12. TRIGGERS Y FUNCIONES\n');

    const trigger = await pool.query(`
      SELECT tgname, tgenabled
      FROM pg_trigger
      WHERE tgname = 'trg_applicants_rut_validate'
    `);

    if (trigger.rows.length > 0) {
      const enabled = trigger.rows[0].tgenabled === 'O';
      console.log(`${enabled ? '🟢' : '🔴'} Trigger de validación de RUT: ${enabled ? 'HABILITADO' : 'DESHABILITADO'}`);
      if (!enabled) {
        console.log('   ⚠️  RECORDAR: Habilitar antes de producción\n');
      }
    } else {
      console.log('⚠️  Trigger de validación de RUT no encontrado\n');
    }

    // RESUMEN FINAL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMEN FINAL\n');

    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    const totalApplicants = await pool.query('SELECT COUNT(*) FROM applicants');
    const totalApplications = await pool.query('SELECT COUNT(*) FROM applications');
    const totalMilestones = await pool.query('SELECT COUNT(*) FROM milestones');
    const totalInvites = await pool.query('SELECT COUNT(*) FROM invites');

    console.log(`👥 Usuarios:          ${totalUsers.rows[0].count}`);
    console.log(`👨‍🎓 Postulantes:       ${totalApplicants.rows[0].count}`);
    console.log(`📝 Postulaciones:     ${totalApplications.rows[0].count}`);
    console.log(`📢 Convocatorias:     ${calls.rows.length}`);
    console.log(`🎯 Hitos:             ${totalMilestones.rows[0].count}`);
    console.log(`📧 Invitaciones:      ${totalInvites.rows[0].count}`);
    console.log(`📋 Formularios:       ${forms.rows.length}`);
    console.log(`🏫 Instituciones:     ${institutions.rows.length}\n`);

    // ESTADO GENERAL
    const hasActiveCall = calls.rows.some(c => c.status === 'OPEN' && c.is_active);
    const hasAdmin = adminUser.rows.length > 0;
    const hasIntegrityIssues = 
      orphanApps.rows[0].count !== '0' || 
      orphanProgress.rows[0].count !== '0' || 
      orphanMilestones.rows[0].count !== '0';

    console.log('╔═══════════════════════════════════════════════════════╗');
    if (hasActiveCall && hasAdmin && !hasIntegrityIssues) {
      console.log('║              ✅ BASE DE DATOS EN BUEN ESTADO          ║');
    } else {
      console.log('║            ⚠️  REQUIERE ATENCIÓN                      ║');
    }
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    if (!hasActiveCall) {
      console.log('⚠️  No hay convocatoria activa (OPEN + is_active=true)');
    }
    if (!hasAdmin) {
      console.log('⚠️  No hay usuario administrador');
    }
    if (hasIntegrityIssues) {
      console.log('⚠️  Hay problemas de integridad referencial');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error en auditoría:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

auditCompleteDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
