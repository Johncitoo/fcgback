require('dotenv').config();
const { Client } = require('pg');

async function verifyEverything() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   🔍 VERIFICACIÓN COMPLETA DEL SISTEMA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 1. Convocatorias OPEN
    const calls = await client.query(`
      SELECT id, name, year, status 
      FROM calls 
      WHERE status = 'OPEN'
      ORDER BY year DESC
    `);
    
    console.log('📋 CONVOCATORIAS OPEN:');
    calls.rows.forEach(call => {
      console.log(`   ${call.name} (${call.year}) - Status: ${call.status}`);
    });
    
    const becasFCG2026 = calls.rows.find(c => c.name === 'Becas FCG 2026');
    if (!becasFCG2026) {
      console.log('   ❌ ERROR: "Becas FCG 2026" no encontrada o no está OPEN');
      return;
    }
    console.log(`   ✅ "Becas FCG 2026" está OPEN\n`);

    // 2. Milestone de Postulación
    const milestone = await client.query(`
      SELECT id, name, form_id, call_id
      FROM milestones
      WHERE call_id = $1 
      ORDER BY order_index
      LIMIT 1
    `, [becasFCG2026.id]);

    if (milestone.rows.length === 0) {
      console.log('   ❌ ERROR: No hay milestone para Becas FCG 2026');
      return;
    }

    const m = milestone.rows[0];
    console.log('🎯 MILESTONE "Postulación":');
    console.log(`   ID: ${m.id}`);
    console.log(`   form_id: ${m.form_id}`);
    
    if (!m.form_id) {
      console.log('   ❌ ERROR: Milestone sin form_id');
      return;
    }
    console.log('   ✅ Milestone tiene form_id\n');

    // 3. Formulario
    const form = await client.query(`
      SELECT id, name, description, schema, created_at, updated_at
      FROM forms
      WHERE id = $1
    `, [m.form_id]);

    if (form.rows.length === 0) {
      console.log('   ❌ ERROR: Form no encontrado');
      return;
    }

    const f = form.rows[0];
    console.log('📝 FORMULARIO:');
    console.log(`   ID: ${f.id}`);
    console.log(`   Nombre: ${f.name}`);
    console.log(`   Descripción: ${f.description}`);
    
    if (!f.schema || !f.schema.sections || f.schema.sections.length === 0) {
      console.log('   ❌ ERROR: Schema vacío o sin secciones');
      console.log('   Schema actual:', JSON.stringify(f.schema, null, 2));
      return;
    }

    console.log(`   ✅ Schema tiene ${f.schema.sections.length} secciones\n`);
    console.log('   📋 SECCIONES:');
    f.schema.sections.forEach((sec, i) => {
      console.log(`      ${i + 1}. ${sec.title} (${sec.fields?.length || 0} campos)`);
    });

    // 4. Código de invitación disponible
    const invite = await client.query(`
      SELECT id, call_id, used_at, expires_at, created_at, meta
      FROM invites
      WHERE call_id = $1 AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `, [becasFCG2026.id]);

    console.log('\n🎫 CÓDIGO DE INVITACIÓN:');
    if (invite.rows.length === 0) {
      console.log('   ⚠️  No hay códigos sin usar para Becas FCG 2026');
      console.log('   💡 Ejecuta: node create-test-invite.js');
    } else {
      const inv = invite.rows[0];
      console.log(`   ✅ Hay código disponible (creado: ${inv.created_at.toISOString().split('T')[0]})`);
      console.log(`   Email sugerido: ${inv.meta?.testEmail || inv.meta?.email || 'N/A'}`);
      console.log(`   Expira: ${inv.expires_at.toISOString().split('T')[0]}`);
    }

    // 5. Resumen final
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ✅ SISTEMA 100% OPERACIONAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📊 RESUMEN:');
    console.log(`   ✅ Convocatoria activa: ${becasFCG2026.name} (${becasFCG2026.year})`);
    console.log(`   ✅ Formulario con ${f.schema.sections.length} secciones`);
    console.log(`   ✅ ${f.schema.sections.reduce((sum, s) => sum + (s.fields?.length || 0), 0)} campos totales`);
    console.log(`   ✅ Milestone configurado correctamente`);
    
    if (invite.rows.length > 0) {
      console.log('   ✅ Código de invitación disponible');
    }

    console.log('\n🚀 PRUEBA EL FLUJO:');
    console.log('   Admin: https://fcgfront.vercel.app/#/admin/form-builder');
    console.log('   Postulante: https://fcgfront.vercel.app/#/login');
    console.log('   (Ver SOLUCION_COMPLETA_SCHEMA_Y_CALLS.md para detalles)\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    await client.end();
  }
}

verifyEverything().catch(console.error);
