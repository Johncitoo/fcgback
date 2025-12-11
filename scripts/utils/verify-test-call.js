const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function verifyTestCall() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Verificar convocatoria Test 2029
    const call = await client.query(`
      SELECT * FROM calls WHERE year = 2029
    `);

    if (call.rows.length === 0) {
      console.log('❌ No se encontró la convocatoria Test 2029');
      return;
    }

    const testCall = call.rows[0];
    console.log('📋 CONVOCATORIA TEST 2029');
    console.log('═'.repeat(70));
    console.log(`ID: ${testCall.id}`);
    console.log(`Nombre: ${testCall.name}`);
    console.log(`Año: ${testCall.year}`);
    console.log(`Estado: ${testCall.status}`);
    console.log(`Activa: ${testCall.is_active ? '✅ SÍ' : '❌ NO'}`);
    console.log(`Auto-cierre: ${testCall.auto_close ? 'Sí' : 'No'}`);
    console.log(`Fecha inicio: ${testCall.start_date || 'No definida'}`);
    console.log(`Fecha fin: ${testCall.end_date || 'No definida'}`);
    console.log('═'.repeat(70));

    // Verificar milestones asociados
    const milestones = await client.query(`
      SELECT id, name, order_index, status, required, who_can_fill
      FROM milestones 
      WHERE call_id = $1 
      ORDER BY order_index
    `, [testCall.id]);

    console.log(`\n🎯 HITOS CONFIGURADOS (${milestones.rows.length})`);
    console.log('═'.repeat(70));
    if (milestones.rows.length > 0) {
      milestones.rows.forEach((m, idx) => {
        console.log(`${idx + 1}. ${m.name}`);
        console.log(`   - Orden: ${m.order_index}`);
        console.log(`   - Estado: ${m.status}`);
        console.log(`   - Requerido: ${m.required ? 'Sí' : 'No'}`);
        console.log(`   - Puede completar: ${m.who_can_fill}`);
      });
    } else {
      console.log('⚠️  No hay hitos configurados para esta convocatoria');
    }
    console.log('═'.repeat(70));

    // Verificar invitaciones
    const invites = await client.query(`
      SELECT id, expires_at, used_at, meta
      FROM invites 
      WHERE call_id = $1
    `, [testCall.id]);

    console.log(`\n🎫 INVITACIONES (${invites.rows.length})`);
    console.log('═'.repeat(70));
    if (invites.rows.length > 0) {
      invites.rows.forEach((inv, idx) => {
        const status = inv.used_at ? '✅ Usada' : '🟢 Disponible';
        const expireStatus = inv.expires_at && new Date(inv.expires_at) < new Date() 
          ? '⏰ Expirada' 
          : '✅ Vigente';
        console.log(`${idx + 1}. ${status} | ${expireStatus}`);
        if (inv.meta?.email) {
          console.log(`   Email: ${inv.meta.email}`);
        }
      });
    } else {
      console.log('⚠️  No hay invitaciones para esta convocatoria');
    }
    console.log('═'.repeat(70));

    // Verificar applications
    const apps = await client.query(`
      SELECT a.id, a.status, u.email, u.full_name
      FROM applications a
      LEFT JOIN users u ON u.applicant_id = a.applicant_id
      WHERE a.call_id = $1
    `, [testCall.id]);

    console.log(`\n📝 POSTULACIONES (${apps.rows.length})`);
    console.log('═'.repeat(70));
    if (apps.rows.length > 0) {
      apps.rows.forEach((app, idx) => {
        console.log(`${idx + 1}. ${app.full_name || 'Sin nombre'} (${app.email || 'Sin email'})`);
        console.log(`   Estado: ${app.status}`);
      });
    } else {
      console.log('ℹ️  No hay postulaciones aún');
    }
    console.log('═'.repeat(70));

    console.log('\n✅ Verificación completada');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyTestCall();
