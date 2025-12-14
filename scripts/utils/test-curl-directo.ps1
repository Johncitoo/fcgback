# Test con curl directo bypassing cache
$token = Get-Content "$PSScriptRoot\.token"

$headers = @{
    "Authorization" = "Bearer $token"
    "Cache-Control" = "no-cache, no-store, must-revalidate"
    "Pragma" = "no-cache"
    "X-No-Cache" = "true"
}

$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$url = "https://fcgback-production.up.railway.app/api/forms/900c8052-f0a1-4d86-9f7e-9db0d3e43e2a?bypass=$timestamp&nocache=$([Guid]::NewGuid())"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔬 TEST CON BYPASS DE CACHE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "URL: $url" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -UseBasicParsing
    $json = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Response Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Secciones en respuesta:" -ForegroundColor Yellow
    $sections = $json.schema.sections
    Write-Host "   Total: $($sections.Count)" -ForegroundColor $(if ($sections.Count -eq 4) { "Green" } else { "Red" })
    Write-Host ""
    
    foreach ($section in $sections) {
        $color = if ($section.id -like "tmp_*") { "Magenta" } else { "White" }
        Write-Host "   - $($section.id): $($section.title)" -ForegroundColor $color
    }
    
    Write-Host ""
    if ($sections.Count -lt 4) {
        Write-Host "❌ PROBLEMA: Faltan secciones!" -ForegroundColor Red
        Write-Host "   Se esperaban 4, se recibieron $($sections.Count)" -ForegroundColor Red
    } else {
        Write-Host "✅ OK: Se recibieron las 4 secciones" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "📋 Schema completo:" -ForegroundColor Yellow
    Write-Host ($json.schema | ConvertTo-Json -Depth 10)
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
