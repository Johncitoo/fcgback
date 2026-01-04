const fs = require('fs');
const path = require('path');

const inputFile = 'backup-fundacion-2026-01-04T07-10-00.sql';
const outputDir = 'sql-parts';

console.log('📦 Dividiendo backup SQL en partes manejables...\n');

// Crear directorio de salida
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Leer archivo completo
const content = fs.readFileSync(inputFile, 'utf8');

// Dividir por tablas
const lines = content.split('\n');
let currentPart = [];
let partNumber = 1;
let currentTable = 'inicio';
let linesInPart = 0;
const MAX_LINES = 300; // ~300 líneas por archivo para que sea manejable

// Primera parte: extensiones y setup
const setupLines = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('CREATE EXTENSION') || line.includes('SET ')) {
    setupLines.push(line);
  }
  if (line.includes('DROP TABLE') || line.includes('CREATE TABLE')) {
    break;
  }
}

fs.writeFileSync(
  path.join(outputDir, `part-00-setup.sql`),
  setupLines.join('\n'),
  'utf8'
);
console.log(`✅ part-00-setup.sql (extensiones y configuración)`);

// Procesar el resto por tablas
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detectar inicio de nueva tabla
  if (line.includes('-- Tabla:')) {
    const match = line.match(/-- Tabla: (\w+)/);
    if (match) {
      currentTable = match[1];
    }
  }
  
  // Detectar separador de tabla (nueva sección)
  if (line.includes('-- ================================================================') && 
      line.includes('Tabla:') && 
      currentPart.length > 0 && 
      linesInPart > 50) {
    
    // Guardar parte actual
    const filename = `part-${String(partNumber).padStart(2, '0')}-${currentTable}.sql`;
    fs.writeFileSync(
      path.join(outputDir, filename),
      currentPart.join('\n'),
      'utf8'
    );
    console.log(`✅ ${filename} (${linesInPart} líneas)`);
    
    partNumber++;
    currentPart = [];
    linesInPart = 0;
  }
  
  // Agregar línea a parte actual (saltear setup inicial)
  if (!line.includes('CREATE EXTENSION') && !setupLines.includes(line)) {
    currentPart.push(line);
    linesInPart++;
  }
  
  // Forzar división cada MAX_LINES si es una tabla muy grande
  if (linesInPart >= MAX_LINES) {
    const filename = `part-${String(partNumber).padStart(2, '0')}-${currentTable}-cont.sql`;
    fs.writeFileSync(
      path.join(outputDir, filename),
      currentPart.join('\n'),
      'utf8'
    );
    console.log(`✅ ${filename} (${linesInPart} líneas)`);
    
    partNumber++;
    currentPart = [];
    linesInPart = 0;
  }
}

// Guardar última parte
if (currentPart.length > 0) {
  const filename = `part-${String(partNumber).padStart(2, '0')}-final.sql`;
  fs.writeFileSync(
    path.join(outputDir, filename),
    currentPart.join('\n'),
    'utf8'
  );
  console.log(`✅ ${filename} (${linesInPart} líneas)`);
}

console.log(`\n✅ Backup dividido en ${partNumber} partes en el directorio: ${outputDir}/`);
console.log('\n📋 INSTRUCCIONES:');
console.log('1. Importa part-00-setup.sql primero (extensiones)');
console.log('2. Luego importa las demás partes en orden numérico');
console.log('3. Si alguna parte falla, puedes continuar con la siguiente\n');
