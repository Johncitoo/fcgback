const { Client } = require('pg');

const client = new Client({
  host: 'tramway.proxy.rlwy.net',
  port: 30026,
  user: 'postgres',
  password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
  database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function checkInvites() {
  await client.connect();
  
  const result = await client.query(`
    SELECT id, code_hash, meta, expires_at, created_at 
    FROM invites 
    WHERE code_hash LIKE '$argon2%' 
    ORDER BY created_at DESC 
    LIMIT 3
  `);
  
  console.log('\n📋 Últimos 3 invites con argon2:\n');
  result.rows.forEach((row, i) => {
    console.log(`${i+1}. ID: ${row.id.substring(0,12)}...`);
    console.log(`   Hash (primeros 50): ${row.code_hash.substring(0,50)}...`);
    console.log(`   Meta:`, row.meta);
    console.log(`   Creado: ${row.created_at}`);
    console.log(`   Expira: ${row.expires_at}`);
    console.log('');
  });
  
  await client.end();
}

checkInvites().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
