// Script temporal para verificar convocatoria activa
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
});

async function checkActiveCall() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Verificar convocatoria activa
    const result = await client.query(`
      SELECT id, name, year, status, is_active, start_date, end_date 
      FROM calls 
      WHERE is_active = true AND status = 'OPEN'
      ORDER BY year DESC
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No hay convocatorias activas (is_active=true AND status=OPEN)');
      console.log('\nMostrando todas las convocatorias:\n');
      
      const allCalls = await client.query(`
        SELECT id, name, year, status, is_active 
        FROM calls 
        ORDER BY year DESC
      `);
      
      console.table(allCalls.rows);
    } else {
      console.log('✅ Convocatoria activa encontrada:\n');
      console.table(result.rows);
      console.log('\nID de la convocatoria activa:', result.rows[0].id);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkActiveCall();
