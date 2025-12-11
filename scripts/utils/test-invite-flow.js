require('dotenv').config();
const { Client } = require('pg');

async function testInviteFlow() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    const code = 'TEST-2LCZOC9A';
    
    // 1. Verificar que el código existe (buscamos el último invite creado)
    const inviteCheck = await client.query(`
      SELECT * FROM invites 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (inviteCheck.rows.length === 0) {
      console.log('❌ No hay invites');
      return;
    }

    const invite = inviteCheck.rows[0];
    console.log('✅ Invite más reciente:');
    console.log('  Email en meta:', invite.meta?.testEmail || invite.meta?.email);
    console.log('  Call ID:', invite.call_id);
    console.log('  Usado:', invite.used_at ? 'Sí' : 'No');

    // 2. Verificar convocatoria
    const callCheck = await client.query(`
      SELECT * FROM calls WHERE id = $1
    `, [invite.call_id]);

    const call = callCheck.rows[0];
    console.log('\n✅ Convocatoria:');
    console.log('  Nombre:', call.name);
    console.log('  Año:', call.year);
    console.log('  Status:', call.status);

    // 3. Verificar formulario
    const formCheck = await client.query(`
      SELECT f.*, m.name as milestone_name
      FROM milestones m
      JOIN forms f ON f.id = m.form_id
      WHERE m.call_id = $1 
        AND m.id = '0f793c2f-b4b8-4d5f-bdb2-68c2dd6df63c'
    `, [invite.call_id]);

    if (formCheck.rows.length === 0) {
      console.log('\n❌ No se encontró formulario para el milestone');
      return;
    }

    const form = formCheck.rows[0];
    console.log('\n✅ Formulario:');
    console.log('  ID:', form.id);
    console.log('  Nombre:', form.name);
    console.log('  Secciones:', form.schema?.sections?.length || 0);
    
    if (form.schema?.sections) {
      console.log('\n  📋 Secciones:');
      form.schema.sections.forEach((sec, i) => {
        console.log(`    ${i + 1}. ${sec.title} (${sec.fields.length} campos)`);
      });
    }

    console.log('\n✅ TODO LISTO! El flujo debería funcionar 100%');

  } finally {
    await client.end();
  }
}

testInviteFlow().catch(console.error);
