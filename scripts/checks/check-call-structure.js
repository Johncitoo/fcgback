require('dotenv').config()
const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
})

async function main() {
  await client.connect()

  console.log('\n=== CONVOCATORIA "TEST 2029" ===')
  const call = await client.query(`
    SELECT 
      id,
      name,
      year,
      status
    FROM calls
    WHERE name = 'Test' AND year = 2029
  `)

  if (call.rows.length === 0) {
    console.log('No se encontró convocatoria')
    await client.end()
    return
  }

  const callData = call.rows[0]
  console.log('ID:', callData.id)
  console.log('Status:', callData.status)

  console.log('\n=== HITOS DE ESTA CONVOCATORIA ===')
  const milestones = await client.query(`
    SELECT 
      m.id,
      m.name,
      m.order_index,
      m.form_id,
      f.name as form_name,
      f.description,
      jsonb_array_length(f.schema->'sections') as num_sections
    FROM milestones m
    LEFT JOIN forms f ON f.id = m.form_id
    WHERE m.call_id = $1
    ORDER BY m.order_index
  `, [callData.id])

  console.log(`\nTotal hitos: ${milestones.rows.length}`)
  milestones.rows.forEach(m => {
    console.log(`\n[${m.order_index}] ${m.name}`)
    console.log(`    Form ID: ${m.form_id}`)
    console.log(`    Form Name: ${m.form_name}`)
    console.log(`    Sections: ${m.num_sections}`)
  })

  console.log('\n=== TODOS LOS FORMULARIOS DE LOS HITOS ===')
  const allForms = await client.query(`
    SELECT DISTINCT
      f.id,
      f.name,
      f.description,
      f.schema
    FROM forms f
    JOIN milestones m ON m.form_id = f.id
    WHERE m.call_id = $1
  `, [callData.id])

  console.log(`\nTotal formularios: ${allForms.rows.length}`)
  allForms.rows.forEach(form => {
    console.log(`\n- ${form.name}`)
    console.log(`  ID: ${form.id}`)
    
    // Contar campos
    let totalFields = 0
    if (form.schema && form.schema.sections) {
      form.schema.sections.forEach(section => {
        if (section.fields) {
          totalFields += section.fields.length
        }
      })
    }
    console.log(`  Total campos: ${totalFields}`)
  })

  console.log('\n=== ¿QUÉ FORMULARIO COMPLETÓ ARTURO? ===')
  const arturoDatos = await client.query(`
    SELECT 
      fs.id as submission_id,
      fs.form_id,
      fs.milestone_id,
      f.name as form_name,
      m.name as milestone_name,
      m.order_index,
      fs.form_data
    FROM form_submissions fs
    JOIN applications a ON a.id = fs.application_id
    JOIN users u ON u.applicant_id = a.applicant_id
    LEFT JOIN forms f ON f.id = fs.form_id
    LEFT JOIN milestones m ON m.id = fs.milestone_id
    WHERE u.email = 'arturo321rodriguez@gmail.com'
  `)

  if (arturoDatos.rows.length > 0) {
    const sub = arturoDatos.rows[0]
    console.log('Formulario:', sub.form_name)
    console.log('Hito:', sub.milestone_name, '(order:', sub.order_index + ')')
    console.log('Form ID:', sub.form_id)
    console.log('Milestone ID:', sub.milestone_id)
    console.log('Campos completados:', Object.keys(sub.form_data || {}).join(', '))
  }

  await client.end()
}

main().catch(console.error)
