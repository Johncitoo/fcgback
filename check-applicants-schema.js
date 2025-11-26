const { Client } = require('pg');

const client = new Client({
  host: 'tramway.proxy.rlwy.net',
  port: 30026,
  user: 'postgres',
  password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
  database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function checkApplicantsSchema() {
  await client.connect();
  
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'applicants' 
    ORDER BY ordinal_position
  `);
  
  console.log('\n📋 Esquema de tabla applicants:\n');
  result.rows.forEach(col => {
    console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });
  
  await client.end();
}

checkApplicantsSchema().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
