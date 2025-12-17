const { Client } = require('pg');

const connectionString = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function checkStructure() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway\n');

    // 1. Estructura de milestones
    console.log('📋 ESTRUCTURA DE TABLA: milestones');
    console.log('=' .repeat(80));
    const milestonesStructure = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'milestones'
      ORDER BY ordinal_position;
    `);
    console.table(milestonesStructure.rows);

    // 2. Ejemplo de un milestone
    console.log('\n📋 EJEMPLO DE MILESTONE:');
    console.log('=' .repeat(80));
    const sampleMilestone = await client.query(`
      SELECT * FROM milestones LIMIT 1;
    `);
    if (sampleMilestone.rows.length > 0) {
      console.log(JSON.stringify(sampleMilestone.rows[0], null, 2));
    } else {
      console.log('No hay milestones en la BD');
    }

    // 3. Estructura de applications
    console.log('\n📋 ESTRUCTURA DE TABLA: applications');
    console.log('=' .repeat(80));
    const applicationsStructure = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'applications'
      ORDER BY ordinal_position;
    `);
    console.table(applicationsStructure.rows);

    // 4. Ver los ENUM de application_status
    console.log('\n📋 VALORES DE ENUM: application_status');
    console.log('=' .repeat(80));
    const enumValues = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = 'application_status'::regtype
      ORDER BY enumsortorder;
    `);
    console.log(enumValues.rows.map(r => r.enumlabel).join(', '));

    // 5. Estructura de milestone_progress
    console.log('\n📋 ESTRUCTURA DE TABLA: milestone_progress');
    console.log('=' .repeat(80));
    const progressStructure = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'milestone_progress'
      ORDER BY ordinal_position;
    `);
    console.table(progressStructure.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkStructure();
