# Cree un raccourci sur le Bureau avec l'icone officielle Voyages Girardot
$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Carnet de Voyage Girardot.lnk"
$iconPath = Join-Path $PSScriptRoot "girardot_icon.ico"
$scriptPath = Join-Path $PSScriptRoot "launch_app.ps1"

$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$shortcut.WorkingDirectory = $PSScriptRoot
if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}
$shortcut.Description = "Lancer l application Carnet de Voyage - Voyages Girardot"
$shortcut.Save()

Write-Host "Raccourci Bureau cree avec succes avec l icone Girardot." -ForegroundColor Green
