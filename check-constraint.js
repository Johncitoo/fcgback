const { Client } = require('pg');

const client = new Client({
  host: 'tramway.proxy.rlwy.net',
  port: 30026,
  user: 'postgres',
  password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
  database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function checkConstraint() {
  await client.connect();
  
  const result = await client.query(`
    SELECT pg_get_constraintdef(oid) as definition 
    FROM pg_constraint 
    WHERE conname = 'invites_used_consistency_chk'
  `);
  
  console.log('\n📋 Constraint invites_used_consistency_chk:\n');
  console.log(result.rows[0].definition);
  console.log('\n');
  
  await client.end();
}

checkConstraint().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
