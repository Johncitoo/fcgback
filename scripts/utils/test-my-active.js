// Script para simular la llamada /applications/my-active directamente en la BD
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function testMyActive() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    const userId = '080492b7-56fd-4cdb-a458-3f21ceaed573'; // postulante.prueba@test.cl

    console.log('🔍 Simulando getOrCreateForActiveCall...\n');

    // 1. Buscar convocatoria activa (status = OPEN)
    console.log('1️⃣ Buscando convocatoria activa (status = OPEN)...');
    const activeCall = await client.query(`
      SELECT id, name, year 
      FROM calls 
      WHERE status = 'OPEN' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (activeCall.rows.length === 0) {
      console.log('❌ No hay convocatoria con status = OPEN\n');
      
      // Ver qué convocatorias existen
      const allCalls = await client.query(`
        SELECT id, name, year, status, is_active 
        FROM calls 
        ORDER BY created_at DESC
      `);
      
      console.log('📋 Convocatorias existentes:');
      allCalls.rows.forEach(c => {
        console.log(`   - ${c.name} ${c.year}: status="${c.status}", is_active=${c.is_active}`);
      });
      
      console.log('\n⚠️  PROBLEMA: El endpoint busca status="OPEN" pero las convocatorias usan is_active=true');
      console.log('🔧 SOLUCIÓN: Cambiar la query del backend para buscar is_active=true en lugar de status="OPEN"');
      return;
    }

    const call = activeCall.rows[0];
    console.log(`   ✅ ${call.name} ${call.year} (ID: ${call.id})\n`);

    // 2. Obtener applicant_id del usuario
    console.log('2️⃣ Obteniendo applicant_id del usuario...');
    const userResult = await client.query(`
      SELECT applicant_id 
      FROM users 
      WHERE id = $1 
      LIMIT 1
    `, [userId]);

    if (userResult.rows.length === 0 || !userResult.rows[0].applicant_id) {
      console.log('❌ Usuario no tiene applicant_id vinculado');
      return;
    }

    const applicantId = userResult.rows[0].applicant_id;
    console.log(`   ✅ Applicant ID: ${applicantId}\n`);

    // 3. Buscar application existente
    console.log('3️⃣ Buscando application existente...');
    const existingApp = await client.query(`
      SELECT 
        a.id,
        a.status,
        a.submitted_at,
        c.id as "callId",
        c.name as "callName",
        c.year as "callYear"
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      WHERE a.applicant_id = $1 AND a.call_id = $2 
      LIMIT 1
    `, [applicantId, call.id]);

    if (existingApp.rows.length > 0) {
      const app = existingApp.rows[0];
      console.log(`   ✅ Application encontrada: ${app.id}`);
      console.log(`      Status: ${app.status}`);
      console.log(`      Call: ${app.callName} ${app.callYear}\n`);
      
      console.log('✅ Todo OK - El endpoint debería retornar la application correctamente');
    } else {
      console.log('   ℹ️  No existe application, se creará una nueva\n');
      console.log('✅ Todo OK - Se creará nueva application');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

testMyActive();
