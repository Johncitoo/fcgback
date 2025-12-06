const { Client } = require('pg');

async function checkApplicationsTable() {
  const client = new Client({
    connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  // Ver columnas
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'applications'
    ORDER BY ordinal_position
  `);
  
  console.log('📋 COLUMNAS DE APPLICATIONS:');
  cols.rows.forEach(c => console.log(`   ${c.column_name}: ${c.data_type}`));
  
  // Ver foreign keys
  const fks = await client.query(`
    SELECT 
      tc.constraint_name, 
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'applications'
  `);
  
  console.log('\n🔗 FOREIGN KEYS:');
  fks.rows.forEach(fk => {
    console.log(`   ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  });
  
  // Verificar si el usuario existe en la tabla referenciada
  console.log('\n🔍 VERIFICANDO USUARIO:');
  const userId = '3fb3f91d-b475-4eac-b847-4af8b825fcff';
  
  // Probar en users
  const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
  console.log(`   users: ${userCheck.rows.length > 0 ? '✅ Existe' : '❌ No existe'}`);
  
  // Probar en applicants (por si es otra tabla)
  try {
    const appCheck = await client.query('SELECT id FROM applicants WHERE id = $1', [userId]);
    console.log(`   applicants: ${appCheck.rows.length > 0 ? '✅ Existe' : '❌ No existe'}`);
  } catch (e) {
    console.log(`   applicants: ❌ Tabla no existe`);
  }
  
  await client.end();
}

checkApplicationsTable().catch(console.error);
