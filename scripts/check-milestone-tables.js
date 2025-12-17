const { Client } = require('pg');

const client = new Client({
  host: 'tramway.proxy.rlwy.net',
  port: 30026,
  user: 'postgres',
  password: 'LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv',
  database: 'railway',
});

async function main() {
  await client.connect();
  const result = await client.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema='public' AND (table_name LIKE '%milestone%' OR table_name LIKE '%progress%')`
  );
  console.log('Tablas con milestone o progress:');
  result.rows.forEach(row => {
    console.log('  -', row.table_name);
  });
  await client.end();
}

main();
