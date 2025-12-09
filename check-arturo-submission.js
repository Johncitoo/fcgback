require('dotenv').config()
const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway'
})

async function main() {
  await client.connect()

  console.log('\n=== 1. APLICACIÓN DE ARTURO ===')
  const app = await client.query(`
    SELECT 
      a.id,
      a.applicant_id,
      a.call_id,
      a.status,
      a.submitted_at,
      u.email,
      u.full_name,
      c.name as call_name
    FROM applications a
    JOIN users u ON u.applicant_id = a.applicant_id
    JOIN calls c ON c.id = a.call_id
    WHERE u.email = 'arturosantibanezmieres@gmail.com'
    ORDER BY a.created_at DESC
    LIMIT 1
  `)
  console.log(app.rows[0])

  if (app.rows.length === 0) {
    console.log('No se encontró aplicación de Arturo')
    await client.end()
    return
  }

  const appId = app.rows[0].id
  const callId = app.rows[0].call_id

  console.log('\n=== 2. FORM_SUBMISSIONS DE ESTA APLICACIÓN ===')
  const submissions = await client.query(`
    SELECT 
      fs.id,
      fs.application_id,
      fs.milestone_id,
      fs.form_id,
      fs.submitted_at,
      fs.answers,
      m.name as milestone_name,
      m.order_index,
      f.name as form_name
    FROM form_submissions fs
    LEFT JOIN milestones m ON m.id = fs.milestone_id
    LEFT JOIN forms f ON f.id = fs.form_id
    WHERE fs.application_id = $1
    ORDER BY fs.created_at
  `, [appId])

  console.log(`\nTotal submissions: ${submissions.rows.length}`)
  submissions.rows.forEach((sub, i) => {
    console.log(`\n--- Submission ${i + 1} ---`)
    console.log('ID:', sub.id)
    console.log('Milestone:', sub.milestone_name, '(order:', sub.order_index + ')')
    console.log('Form:', sub.form_name)
    console.log('Submitted at:', sub.submitted_at)
    console.log('Answers keys:', sub.answers ? Object.keys(sub.answers) : 'null')
    console.log('Answers preview:', JSON.stringify(sub.answers || {}).substring(0, 200))
  })

  console.log('\n=== 3. HITOS DE ESTA CONVOCATORIA ===')
  const milestones = await client.query(`
    SELECT 
      m.id,
      m.name,
      m.order_index,
      m.form_id,
      f.name as form_name
    FROM milestones m
    LEFT JOIN forms f ON f.id = m.form_id
    WHERE m.call_id = $1
    ORDER BY m.order_index
  `, [callId])

  console.log(`\nTotal hitos: ${milestones.rows.length}`)
  milestones.rows.forEach(m => {
    console.log(`\nHito ${m.order_index}: ${m.name}`)
    console.log('  Form ID:', m.form_id)
    console.log('  Form Name:', m.form_name)
  })

  console.log('\n=== 4. FORMULARIOS ===')
  const forms = await client.query(`
    SELECT 
      f.id,
      f.name,
      f.description,
      jsonb_array_length(f.schema->'sections') as num_sections
    FROM forms f
    WHERE f.id IN (SELECT DISTINCT form_id FROM milestones WHERE call_id = $1)
  `, [callId])

  forms.rows.forEach(form => {
    console.log(`\nForm: ${form.name}`)
    console.log('  ID:', form.id)
    console.log('  Sections:', form.num_sections)
  })

  console.log('\n=== 5. ¿QUÉ FORM_ID TIENE LA CONVOCATORIA? ===')
  const call = await client.query(`
    SELECT id, name, year, form_id
    FROM calls
    WHERE id = $1
  `, [callId])
  console.log(call.rows[0])

  await client.end()
}

main().catch(console.error)
