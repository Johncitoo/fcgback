require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:aUYsbYwjBKMuYVuWUJesLhkfYYVnHDTW@switchback.proxy.rlwy.net:37224/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function listAllTables() {
  try {
    console.log('🔍 Listando todas las tablas en Railway...\n');

    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No se encontraron tablas en la base de datos\n');
      console.log('💡 Parece que la base de datos está vacía o necesita migraciones iniciales\n');
    } else {
      console.log(`📊 Se encontraron ${result.rows.length} tablas:\n`);
      
      let currentSchema = '';
      result.rows.forEach(table => {
        if (currentSchema !== table.schemaname) {
          console.log(`\n[${table.schemaname}]`);
          currentSchema = table.schemaname;
        }
        console.log(`  ✓ ${table.tablename}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

listAllTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
