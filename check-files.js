require('dotenv').config();
const { Client } = require('pg');

async function checkFiles() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Conectado a PostgreSQL\n');

    const result = await client.query(`
      SELECT 
        id,
        "originalFilename",
        "storedFilename",
        mimetype,
        size,
        category,
        "thumbnailPath",
        "uploadedAt"
      FROM files_metadata 
      ORDER BY "uploadedAt" DESC 
      LIMIT 5
    `);

    console.log(`📁 Últimos ${result.rows.length} archivos subidos:\n`);
    result.rows.forEach((file, index) => {
      console.log(`${index + 1}. ${file.originalFilename}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   Tipo: ${file.mimetype}`);
      console.log(`   Tamaño: ${file.size} bytes`);
      console.log(`   Categoría: ${file.category}`);
      console.log(`   Thumbnail: ${file.thumbnailPath || 'No generado'}`);
      console.log(`   Fecha: ${file.uploadedAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkFiles();
