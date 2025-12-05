require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query(`
  SELECT enumlabel 
  FROM pg_enum 
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'call_status')
`).then(r => {
  console.log('Valores del enum call_status:');
  r.rows.forEach(row => console.log('  -', row.enumlabel));
  pool.end();
}).catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
