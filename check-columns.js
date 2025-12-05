/**
 * Script para ver columnas de tablas importantes
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkColumns() {
  const client = await pool.connect();
  
  try {
    const tables = ['forms', 'milestones', 'invites', 'applicants', 'applications'];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);

      console.log(`\n📋 Tabla: ${table}`);
      console.log('─'.repeat(50));
      result.rows.forEach(row => {
        console.log(`   ${row.column_name.padEnd(30)} ${row.data_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns();
