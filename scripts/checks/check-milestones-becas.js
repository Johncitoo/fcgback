require('dotenv').config();
const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    const result = await client.query(`
      SELECT * FROM milestones 
      WHERE call_id='5e33c8ee-52a7-4736-89a4-043845ea7f1a'
    `);
    
    console.log('Milestones para Becas FCG 2026:');
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await client.end();
  }
}

check().catch(console.error);
