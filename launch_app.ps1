# Lanceur de l'application Carnet de Voyage - Voyages Girardot
$port = 8080
$url = "http://localhost:$port/admin.html"
$scriptPath = Join-Path $PSScriptRoot "start_server.ps1"
$iconPath = Join-Path $PSScriptRoot "girardot_icon.ico"

# Synchroniser automatiquement les raccourcis (dossier projet et Bureau) avec l'icone Girardot
try {
    $wsh = New-Object -ComObject WScript.Shell
    
    # 1. Raccourci local dans le dossier du projet
    $localLnk = $wsh.CreateShortcut((Join-Path $PSScriptRoot "Carnet de Voyage Girardot.lnk"))
    $localLnk.TargetPath = "powershell.exe"
    $localLnk.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\launch_app.ps1`""
    $localLnk.WorkingDirectory = $PSScriptRoot
    if (Test-Path $iconPath) {
        $localLnk.IconLocation = "$iconPath,0"
    }
    $localLnk.Description = "Lancer l'application Carnet de Voyage - Voyages Girardot"
    $localLnk.Save()

    # 2. Raccourci sur le Bureau de l'utilisateur
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $desktopLnkPath = Join-Path $desktopPath "Carnet de Voyage Girardot.lnk"
    $desktopLnk = $wsh.CreateShortcut($desktopLnkPath)
    $desktopLnk.TargetPath = "powershell.exe"
    $desktopLnk.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\launch_app.ps1`""
    $desktopLnk.WorkingDirectory = $PSScriptRoot
    if (Test-Path $iconPath) {
        $desktopLnk.IconLocation = "$iconPath,0"
    }
    $desktopLnk.Description = "Lancer l'application Carnet de Voyage - Voyages Girardot"
    $desktopLnk.Save()
} catch {}

# Verifier si le serveur tourne deja sur le port 8080
$running = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if (-not $running) {
    Start-Process powershell.exe -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $PSScriptRoot
    Start-Sleep -Milliseconds 900
}

# Ouvrir l'application dans le navigateur par defaut
Start-Process $url
