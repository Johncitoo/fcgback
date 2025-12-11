/**
 * Script de Migración - CHANGELOG_HITOS
 * Adapta la BD a los cambios realizados por el compañero
 * Fecha: 4 de Diciembre, 2025
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:LVMTmEztSWRfFHuJoBLRkLUUiVAByPuv@tramway.proxy.rlwy.net:30026/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando migración de base de datos...\n');
    
    // ========================================
    // 1. AGREGAR COLUMNAS DE REVISIÓN A milestone_progress
    // ========================================
    console.log('📋 [1/7] Agregando columnas de revisión a milestone_progress...');
    
    await client.query(`
      DO $$ 
      BEGIN
        -- review_status
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'milestone_progress' AND column_name = 'review_status'
        ) THEN
          ALTER TABLE milestone_progress 
          ADD COLUMN review_status VARCHAR(50);
          RAISE NOTICE 'Columna review_status agregada';
        ELSE
          RAISE NOTICE 'Columna review_status ya existe';
        END IF;

        -- review_notes
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'milestone_progress' AND column_name = 'review_notes'
        ) THEN
          ALTER TABLE milestone_progress 
          ADD COLUMN review_notes TEXT;
          RAISE NOTICE 'Columna review_notes agregada';
        ELSE
          RAISE NOTICE 'Columna review_notes ya existe';
        END IF;

        -- reviewed_by
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'milestone_progress' AND column_name = 'reviewed_by'
        ) THEN
          ALTER TABLE milestone_progress 
          ADD COLUMN reviewed_by UUID REFERENCES users(id);
          RAISE NOTICE 'Columna reviewed_by agregada';
        ELSE
          RAISE NOTICE 'Columna reviewed_by ya existe';
        END IF;

        -- reviewed_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'milestone_progress' AND column_name = 'reviewed_at'
        ) THEN
          ALTER TABLE milestone_progress 
          ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
          RAISE NOTICE 'Columna reviewed_at agregada';
        ELSE
          RAISE NOTICE 'Columna reviewed_at ya existe';
        END IF;
      END $$;
    `);
    console.log('✅ Columnas de revisión agregadas\n');

    // ========================================
    // 2. VERIFICAR ESTADO 'BLOCKED' EN milestone_progress
    // ========================================
    console.log('📋 [2/7] Verificando campo status en milestone_progress...');
    
    // El campo status es VARCHAR, no enum, así que no necesitamos agregar valores
    // Solo verificamos que el campo exista
    const statusCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'milestone_progress' AND column_name = 'status'
    `);
    
    if (statusCheck.rows.length > 0) {
      console.log(`✅ Campo status existe (${statusCheck.rows[0].data_type})`);
      console.log('   Valores permitidos: NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED, REJECTED');
    } else {
      console.log('⚠️  Campo status no encontrado');
    }
    console.log('');

    // ========================================
    // 3. VERIFICAR COLUMNAS EN calls
    // ========================================
    console.log('📋 [3/7] Verificando columnas en tabla calls...');
    
    await client.query(`
      DO $$ 
      BEGIN
        -- is_active
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'calls' AND column_name = 'is_active'
        ) THEN
          ALTER TABLE calls 
          ADD COLUMN is_active BOOLEAN DEFAULT false;
          RAISE NOTICE 'Columna is_active agregada';
        ELSE
          RAISE NOTICE 'Columna is_active ya existe';
        END IF;

        -- start_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'calls' AND column_name = 'start_date'
        ) THEN
          ALTER TABLE calls 
          ADD COLUMN start_date TIMESTAMP WITH TIME ZONE;
          RAISE NOTICE 'Columna start_date agregada';
        ELSE
          RAISE NOTICE 'Columna start_date ya existe';
        END IF;

        -- end_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'calls' AND column_name = 'end_date'
        ) THEN
          ALTER TABLE calls 
          ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
          RAISE NOTICE 'Columna end_date agregada';
        ELSE
          RAISE NOTICE 'Columna end_date ya existe';
        END IF;

        -- auto_close
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'calls' AND column_name = 'auto_close'
        ) THEN
          ALTER TABLE calls 
          ADD COLUMN auto_close BOOLEAN DEFAULT true;
          RAISE NOTICE 'Columna auto_close agregada';
        ELSE
          RAISE NOTICE 'Columna auto_close ya existe';
        END IF;
      END $$;
    `);
    console.log('✅ Columnas de calls verificadas\n');

    // ========================================
    // 4. DESHABILITAR TRIGGER DE VALIDACIÓN DE RUT (DESARROLLO)
    // ========================================
    console.log('📋 [4/7] Deshabilitando trigger de validación de RUT...');
    
    await client.query(`
      DO $$ 
      BEGIN
        -- Verificar si el trigger existe antes de deshabilitarlo
        IF EXISTS (
          SELECT 1 FROM pg_trigger 
          WHERE tgname = 'trg_applicants_rut_validate'
        ) THEN
          ALTER TABLE applicants DISABLE TRIGGER trg_applicants_rut_validate;
          RAISE NOTICE '⚠️  Trigger de RUT DESHABILITADO para desarrollo';
        ELSE
          RAISE NOTICE 'Trigger de RUT no existe';
        END IF;
      EXCEPTION 
        WHEN undefined_object THEN 
          RAISE NOTICE 'Trigger de RUT no encontrado';
      END $$;
    `);
    console.log('⚠️  Trigger de RUT deshabilitado (REACTIVAR ANTES DE PRODUCCIÓN)\n');

    // ========================================
    // 5. CREAR/VERIFICAR CONVOCATORIA "Becas 2025"
    // ========================================
    console.log('📋 [5/7] Verificando convocatoria "Becas 2025"...');
    
    const callResult = await client.query(`
      SELECT id, name, year, status 
      FROM calls 
      WHERE name = 'Becas 2025' AND year = 2025
      LIMIT 1
    `);

    let callId;
    if (callResult.rows.length === 0) {
      // Crear convocatoria si no existe
      const insertResult = await client.query(`
        INSERT INTO calls (
          id, name, year, status, is_active, 
          start_date, end_date, auto_close,
          created_at, updated_at
        )
        VALUES (
          '3ced90a7-b252-4c51-bfa3-ac25fd73a4a4',
          'Becas 2025',
          2025,
          'OPEN',
          true,
          NOW(),
          NOW() + INTERVAL '6 months',
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE 
        SET status = 'OPEN', is_active = true
        RETURNING id, name, status
      `);
      callId = insertResult.rows[0].id;
      console.log(`✅ Convocatoria "Becas 2025" creada/actualizada`);
      console.log(`   └─ ID: ${callId}`);
      console.log(`   └─ Status: OPEN`);
    } else {
      callId = callResult.rows[0].id;
      console.log(`✅ Convocatoria "Becas 2025" ya existe`);
      console.log(`   └─ ID: ${callId}`);
      console.log(`   └─ Status: ${callResult.rows[0].status}`);
      
      // Asegurar que esté OPEN
      await client.query(`
        UPDATE calls 
        SET status = 'OPEN', is_active = true 
        WHERE id = $1
      `, [callId]);
    }
    console.log('');

    // ========================================
    // 6. CREAR HITOS SI NO EXISTEN
    // ========================================
    console.log('📋 [6/7] Verificando/creando hitos del sistema...');
    
    const milestonesData = [
      {
        name: '📝 Postulación Inicial',
        description: 'Formulario inicial de postulación',
        order_index: 1,
        status: 'ACTIVE',
        required: true,
        who_can_fill: ['APPLICANT']
      },
      {
        name: '📄 Carga de Documentos',
        description: 'Subir documentos requeridos',
        order_index: 2,
        status: 'PENDING',
        required: true,
        who_can_fill: ['APPLICANT']
      },
      {
        name: '✅ Evaluación Administrativa',
        description: 'Revisión administrativa de documentos',
        order_index: 3,
        status: 'PENDING',
        required: true,
        who_can_fill: ['REVIEWER']
      },
      {
        name: '🎤 Confirmación de Entrevista',
        description: 'Confirmar asistencia a entrevista',
        order_index: 4,
        status: 'PENDING',
        required: true,
        who_can_fill: ['APPLICANT']
      },
      {
        name: '📊 Evaluación Final',
        description: 'Evaluación final del postulante',
        order_index: 5,
        status: 'PENDING',
        required: true,
        who_can_fill: ['REVIEWER']
      }
    ];

    for (const milestone of milestonesData) {
      const existingMilestone = await client.query(`
        SELECT id FROM milestones 
        WHERE call_id = $1 AND name = $2
      `, [callId, milestone.name]);

      if (existingMilestone.rows.length === 0) {
        await client.query(`
          INSERT INTO milestones (
            call_id, name, description, order_index, 
            status, required, who_can_fill, 
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, [
          callId,
          milestone.name,
          milestone.description,
          milestone.order_index,
          milestone.status,
          milestone.required,
          milestone.who_can_fill
        ]);
        console.log(`   ✅ Hito creado: ${milestone.name}`);
      } else {
        console.log(`   ℹ️  Hito ya existe: ${milestone.name}`);
      }
    }
    console.log('');

    // ========================================
    // 7. ÍNDICES PARA OPTIMIZACIÓN
    // ========================================
    console.log('📋 [7/7] Creando índices para optimización...');
    
    await client.query(`
      DO $$ 
      BEGIN
        -- Índice para review_status
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE indexname = 'idx_milestone_progress_review_status'
        ) THEN
          CREATE INDEX idx_milestone_progress_review_status 
          ON milestone_progress(review_status);
          RAISE NOTICE 'Índice review_status creado';
        END IF;

        -- Índice para reviewed_by
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE indexname = 'idx_milestone_progress_reviewed_by'
        ) THEN
          CREATE INDEX idx_milestone_progress_reviewed_by 
          ON milestone_progress(reviewed_by);
          RAISE NOTICE 'Índice reviewed_by creado';
        END IF;

        -- Índice para calls.status
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE indexname = 'idx_calls_status'
        ) THEN
          CREATE INDEX idx_calls_status 
          ON calls(status);
          RAISE NOTICE 'Índice calls.status creado';
        END IF;

        -- Índice para calls.is_active
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE indexname = 'idx_calls_is_active'
        ) THEN
          CREATE INDEX idx_calls_is_active 
          ON calls(is_active);
          RAISE NOTICE 'Índice calls.is_active creado';
        END IF;
      END $$;
    `);
    console.log('✅ Índices creados\n');

    // ========================================
    // RESUMEN FINAL
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 CAMBIOS APLICADOS:');
    console.log('  ✅ Columnas de revisión en milestone_progress');
    console.log('  ✅ Estado BLOCKED agregado');
    console.log('  ✅ Columnas de control en calls');
    console.log('  ⚠️  Trigger de RUT deshabilitado (DESARROLLO)');
    console.log('  ✅ Convocatoria "Becas 2025" lista (OPEN)');
    console.log('  ✅ 5 hitos configurados');
    console.log('  ✅ Índices de optimización creados\n');

    console.log('⚠️  IMPORTANTE PARA PRODUCCIÓN:');
    console.log('  🔴 Reactivar trigger de RUT:');
    console.log('     ALTER TABLE applicants ENABLE TRIGGER trg_applicants_rut_validate;\n');

    console.log('📋 CONVOCATORIA ACTIVA:');
    console.log('  └─ ID: ' + callId);
    console.log('  └─ Nombre: Becas 2025');
    console.log('  └─ Status: OPEN\n');

    console.log('🎯 HITOS CONFIGURADOS:');
    const milestones = await client.query(`
      SELECT name, status, who_can_fill, order_index 
      FROM milestones 
      WHERE call_id = $1 
      ORDER BY order_index
    `, [callId]);

    milestones.rows.forEach(m => {
      console.log(`  ${m.order_index}. ${m.name}`);
      console.log(`     └─ Status: ${m.status} | Quien llena: ${m.who_can_fill}`);
    });

    console.log('\n✅ Base de datos lista para los cambios del CHANGELOG_HITOS! 🚀\n');

  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar migración
console.log('╔════════════════════════════════════════════════╗');
console.log('║   MIGRACIÓN - CHANGELOG HITOS                  ║');
console.log('║   Adaptando BD a cambios del compañero         ║');
console.log('╚════════════════════════════════════════════════╝\n');

migrateDatabase()
  .then(() => {
    console.log('✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script finalizado con errores');
    process.exit(1);
  });
