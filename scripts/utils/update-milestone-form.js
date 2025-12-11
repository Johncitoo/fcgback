require('dotenv').config();
const { Client } = require('pg');

async function update() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    // ID del nuevo form que creamos
    const newFormId = '91243f4b-a3c7-4aa0-8f68-c559d3204e6d';
    
    // ID del milestone
    const milestoneId = '0f793c2f-b4b8-4d5f-bdb2-68c2dd6df63c';
    
    const result = await client.query(`
      UPDATE milestones
      SET form_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [newFormId, milestoneId]);

    if (result.rowCount > 0) {
      console.log('✅ Milestone actualizado:');
      console.log('  form_id anterior: 1971673b-44b0-4ce8-a137-f9c4e41de640');
      console.log('  form_id nuevo:', newFormId);
    } else {
      console.log('❌ No se pudo actualizar');
    }
  } finally {
    await client.end();
  }
}

update().catch(console.error);
