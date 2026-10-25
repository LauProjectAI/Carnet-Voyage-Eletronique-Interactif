# Lanceur de l'application Carnet de Voyage — Voyages Girardot
$port = 8080
$url = "http://localhost:$port/admin.html"
$scriptPath = Join-Path $PSScriptRoot "start_server.ps1"

# Vérifier si le serveur tourne déjà sur le port 8080
$running = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if (-not $running) {
    Start-Process powershell.exe -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $PSScriptRoot
    Start-Sleep -Milliseconds 900
}

# Ouvrir l'interface d'administration dans le navigateur par défaut
Start-Process $url
