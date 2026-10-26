# Lanceur de l'application Carnet de Voyage — Voyages Girardot
$port = 8080
$url = "http://localhost:$port/admin.html"
$scriptPath = Join-Path $PSScriptRoot "start_server.ps1"
$iconPath = Join-Path $PSScriptRoot "girardot_icon.ico"

# Synchroniser automatiquement le raccourci avec l'icône Girardot officielle
try {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut((Join-Path $PSScriptRoot "Carnet de Voyage Girardot.lnk"))
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\launch_app.ps1`""
    $shortcut.WorkingDirectory = $PSScriptRoot
    if (Test-Path $iconPath) {
        $shortcut.IconLocation = "$iconPath,0"
    }
    $shortcut.Description = "Lancer l'administration du Carnet de Voyage Voyages Girardot"
    $shortcut.Save()
} catch {}

# Vérifier si le serveur tourne déjà sur le port 8080
$running = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if (-not $running) {
    Start-Process powershell.exe -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $PSScriptRoot
    Start-Sleep -Milliseconds 900
}

# Ouvrir l'interface d'administration dans le navigateur par défaut
Start-Process $url
