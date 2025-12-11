require('dotenv').config()
const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
})

async function checkSubmissionFields() {
  await client.connect()

  console.log('=== VERIFICAR CAMPOS DE form_submissions ===\n')

  // Ver estructura de la tabla
  const columns = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'form_submissions'
    ORDER BY ordinal_position
  `)

  console.log('Columnas de form_submissions:')
  columns.rows.forEach(col => {
    console.log(`- ${col.column_name}: ${col.data_type}`)
  })

  console.log('\n=== SUBMISSION DE ARTURO ===')
  const submission = await client.query(`
    SELECT 
      fs.*,
      u.email
    FROM form_submissions fs
    JOIN applications a ON a.id = fs.application_id
    JOIN users u ON u.applicant_id = a.applicant_id
    WHERE u.email = 'arturo321rodriguez@gmail.com'
  `)

  if (submission.rows.length > 0) {
    const sub = submission.rows[0]
    console.log('\nDatos:')
    console.log('- ID:', sub.id)
    console.log('- submitted_at:', sub.submitted_at)
    console.log('- form_data:', Object.keys(sub.form_data || {}))
    console.log('- created_at:', sub.created_at)
    console.log('- updated_at:', sub.updated_at)
    
    // Verificar si tiene submitted_at
    console.log('\n¿Está marcado como enviado?', !!sub.submitted_at)
  }

  await client.end()
}

checkSubmissionFields().catch(console.error)
