/**
 * Script para diagnosticar el problema de hitos
 */

const { Client } = require('pg');

const connectionString = 'postgresql://postgres:apocalipto11@db.iuvtgnhfahwolzzercyb.supabase.co:5432/postgres';

async function diagnose() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Supabase\n');

    // 1. Verificar convocatorias
    const calls = await client.query('SELECT * FROM calls LIMIT 5');
    console.log('📢 CONVOCATORIAS:', calls.rows.length);
    if (calls.rows.length > 0) {
      calls.rows.forEach(c => console.log(`   -`, JSON.stringify(c, null, 2).substring(0, 200)));
    } else {
      console.log('   ⚠️ NO HAY CONVOCATORIAS - Este es probablemente el problema');
    }

    // 2. Verificar hitos
    const milestones = await client.query('SELECT * FROM milestones LIMIT 5');
    console.log('\n🎯 HITOS:', milestones.rows.length);
    if (milestones.rows.length > 0) {
      milestones.rows.forEach(m => console.log(`   -`, JSON.stringify(m, null, 2).substring(0, 200)));
    } else {
      console.log('   ⚠️ NO HAY HITOS');
    }

    // 3. Verificar usuario admin
    const admin = await client.query(`SELECT id, email, role, is_active FROM users WHERE email = 'juanjacontrerasra@gmail.com'`);
    console.log('\n👤 ADMIN:');
    if (admin.rows.length > 0) {
      const a = admin.rows[0];
      console.log(`   - ${a.email} (role: ${a.role}, active: ${a.is_active})`);
    }

    // 4. Verificar formularios
    const forms = await client.query('SELECT id, title, call_id FROM forms');
    console.log('\n📝 FORMULARIOS:', forms.rows.length);

    // 5. Verificar si hay datos en otras tablas críticas
    const applicants = await client.query('SELECT COUNT(*) as count FROM applicants');
    const applications = await client.query('SELECT COUNT(*) as count FROM applications');
    
    console.log('\n📊 RESUMEN:');
    console.log(`   - Postulantes: ${applicants.rows[0].count}`);
    console.log(`   - Aplicaciones: ${applications.rows[0].count}`);

    console.log('\n' + '='.repeat(50));
    console.log('DIAGNÓSTICO:');
    if (calls.rows.length === 0) {
      console.log('❌ No hay convocatorias creadas.');
      console.log('   La pantalla de hitos necesita una convocatoria para mostrar los hitos.');
      console.log('   SOLUCIÓN: Crear una convocatoria primero.');
    } else if (milestones.rows.length === 0) {
      console.log('❌ Hay convocatorias pero no hay hitos.');
      console.log('   SOLUCIÓN: Verificar el frontend o crear hitos manualmente.');
    } else {
      console.log('✅ Hay datos, el problema puede ser del frontend.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

diagnose();
