const { Client } = require('pg');

const connectionString = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function addStartDate() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway\n');

    // Verificar si ya existe la columna
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'milestones' 
        AND column_name = 'start_date';
    `);

    if (checkColumn.rows.length > 0) {
      console.log('ℹ️  La columna start_date ya existe en milestones');
    } else {
      console.log('📝 Agregando columna start_date a milestones...');
      await client.query(`
        ALTER TABLE milestones 
        ADD COLUMN start_date TIMESTAMP WITH TIME ZONE;
      `);
      console.log('✅ Columna start_date agregada exitosamente');
    }

    // Verificar resultado
    const verify = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'milestones' 
        AND column_name IN ('start_date', 'due_date', 'status')
      ORDER BY column_name;
    `);
    
    console.log('\n📋 Columnas de fechas en milestones:');
    console.table(verify.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

addStartDate();
