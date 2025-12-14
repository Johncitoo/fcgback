const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';
const FORM_ID = '900c8052-f0a1-4d86-9f7e-9db0d3e43e2a';

async function testPostgreSQLDirecto() {
  console.log('═'.repeat(80));
  console.log('🔬 PRUEBA DIRECTA A POSTGRESQL (sin backend)');
  console.log('═'.repeat(80));
  console.log();

  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    // Query 1: SELECT básico
    console.log('📋 Query 1: SELECT * FROM forms WHERE id = $1');
    const result1 = await client.query(`SELECT * FROM forms WHERE id = $1`, [FORM_ID]);
    const form1 = result1.rows[0];
    console.log(`Resultado: ${form1.schema.sections.length} secciones`);
    console.log('Secciones:', form1.schema.sections.map(s => s.id));
    console.log();

    // Query 2: SELECT específico del schema
    console.log('📋 Query 2: SELECT schema FROM forms WHERE id = $1');
    const result2 = await client.query(`SELECT schema FROM forms WHERE id = $1`, [FORM_ID]);
    const schema2 = result2.rows[0].schema;
    console.log(`Resultado: ${schema2.sections.length} secciones`);
    console.log('Secciones:', schema2.sections.map(s => s.id));
    console.log();

    // Query 3: Verificar triggers
    console.log('📋 Query 3: Verificar triggers en la tabla forms');
    const triggers = await client.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'forms'
    `);
    if (triggers.rows.length > 0) {
      console.log('⚠️  Se encontraron triggers:');
      triggers.rows.forEach(t => {
        console.log(`  - ${t.trigger_name} (${t.event_manipulation}): ${t.action_statement}`);
      });
    } else {
      console.log('✅ No hay triggers en la tabla forms');
    }
    console.log();

    // Query 4: Verificar vistas
    console.log('📋 Query 4: Verificar si "forms" es una vista');
    const isView = await client.query(`
      SELECT table_type
      FROM information_schema.tables
      WHERE table_name = 'forms'
    `);
    console.log(`Tipo: ${isView.rows[0].table_type}`);
    console.log();

    // Query 5: Schema completo en texto
    console.log('📋 Query 5: Schema completo como JSON text');
    console.log(JSON.stringify(form1.schema, null, 2));
    console.log();

    await client.end();
    console.log('✅ Prueba completada');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

testPostgreSQLDirecto().catch(console.error);
