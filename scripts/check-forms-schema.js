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
    `SELECT column_name FROM information_schema.columns WHERE table_name='forms' ORDER BY ordinal_position`
  );
  console.log('Columnas de forms:');
  result.rows.forEach(row => {
    console.log('  -', row.column_name);
  });
  await client.end();
}

main();
