const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: { rejectUnauthorized: false }
});

async function testEndpoint() {
  try {
    const arturoAppId = '04954eed-5b40-4a89-ab40-6f513fffd78e';

    console.log('\n=== SIMULAR ENDPOINT GET /files/list ===\n');

    // Simular la query que hace el endpoint
    const where = {
      active: true,
      entityType: 'APPLICATION',
      entityId: arturoAppId
    };

    console.log('Filtros:', where);

    const files = await pool.query(`
      SELECT 
        id,
        "originalFilename",
        "storedFilename",
        mimetype,
        size,
        category,
        "entityType",
        "entityId",
        path,
        "thumbnailPath",
        "uploadedBy",
        description,
        "uploadedAt",
        active
      FROM files_metadata
      WHERE active = true 
        AND "entityType" = $1 
        AND "entityId" = $2
      ORDER BY "uploadedAt" DESC;
    `, ['APPLICATION', arturoAppId]);

    console.log(`\n✅ Query ejecutada. Total archivos: ${files.rows.length}\n`);

    if (files.rows.length > 0) {
      console.log('Respuesta que debería devolver el endpoint:');
      console.log(JSON.stringify({ files: files.rows }, null, 2));
    } else {
      console.log('❌ No se encontraron archivos');
      
      // Buscar con otros criterios
      console.log('\n--- Buscando sin filtro de entityType/entityId ---');
      const allFiles = await pool.query(`
        SELECT 
          id,
          "originalFilename",
          "entityType",
          "entityId",
          category,
          "uploadedAt"
        FROM files_metadata
        WHERE active = true
        ORDER BY "uploadedAt" DESC
        LIMIT 10;
      `);
      
      console.log(`Total archivos (últimos 10): ${allFiles.rows.length}`);
      allFiles.rows.forEach(f => {
        const match = f.entityId === arturoAppId ? '✅ MATCH' : '';
        console.log(`  - ${f.originalFilename} | entityType: ${f.entityType} | entityId: ${f.entityId?.substring(0, 8)}... ${match}`);
      });
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testEndpoint();
