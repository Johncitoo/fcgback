const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway';

async function showAllTablesData() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // Obtener lista de todas las tablas
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const { rows: tables } = await client.query(tablesQuery);
    console.log(`📊 Total de tablas encontradas: ${tables.length}\n`);
    console.log('=' .repeat(100));
    
    // Para cada tabla, mostrar su estructura y datos
    for (const table of tables) {
      const tableName = table.table_name;
      
      console.log(`\n\n🔷 TABLA: ${tableName.toUpperCase()}`);
      console.log('='.repeat(100));
      
      // Contar registros
      const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const count = parseInt(countResult.rows[0].count);
      
      console.log(`📈 Total de registros: ${count}`);
      
      if (count > 0) {
        // Obtener estructura de columnas
        const columnsQuery = `
          SELECT column_name, data_type, character_maximum_length
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `;
        const { rows: columns } = await client.query(columnsQuery, [tableName]);
        
        console.log(`\n📋 Columnas: ${columns.map(c => c.column_name).join(', ')}`);
        
        // Obtener datos (limitar a 10 registros para no saturar)
        const limit = count > 10 ? 10 : count;
        const dataResult = await client.query(`SELECT * FROM "${tableName}" LIMIT ${limit}`);
        
        console.log(`\n📄 Datos (mostrando primeros ${limit} registros):`);
        console.log('-'.repeat(100));
        
        dataResult.rows.forEach((row, index) => {
          console.log(`\n[${index + 1}]`);
          for (const [key, value] of Object.entries(row)) {
            let displayValue = value;
            
            // Formatear valores largos
            if (typeof value === 'string' && value.length > 100) {
              displayValue = value.substring(0, 100) + '... (truncado)';
            } else if (typeof value === 'object' && value !== null) {
              displayValue = JSON.stringify(value, null, 2);
            } else if (value instanceof Date) {
              displayValue = value.toISOString();
            }
            
            console.log(`  ${key}: ${displayValue}`);
          }
        });
        
        if (count > 10) {
          console.log(`\n... y ${count - 10} registros más`);
        }
      } else {
        console.log('⚠️  Tabla vacía (sin registros)');
      }
      
      console.log('\n' + '='.repeat(100));
    }
    
    console.log('\n\n✅ Consulta completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

showAllTablesData();
