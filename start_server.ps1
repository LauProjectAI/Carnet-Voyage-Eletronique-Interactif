$port = 8080
$rootDir = $PSScriptRoot

function Get-MimeType([string]$ext) {
    switch ($ext.ToLower()) {
        ".html" { "text/html; charset=utf-8" }
        ".css"  { "text/css; charset=utf-8" }
        ".js"   { "application/javascript; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".png"  { "image/png" }
        ".jpg"  { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".webp" { "image/webp" }
        ".pdf"  { "application/pdf" }
        ".svg"  { "image/svg+xml" }
        ".ico"  { "image/x-icon" }
        ".eml"  { "message/rfc822; charset=utf-8" }
        ".csv"  { "text/csv; charset=utf-8" }
        default { "application/octet-stream" }
    }
}

$useHttpListener = $false
$httpListener = $null
try {
    $httpListener = New-Object System.Net.HttpListener
    $httpListener.Prefixes.Add("http://localhost:$port/")
    $httpListener.Prefixes.Add("http://127.0.0.1:$port/")
    $httpListener.Start()
    $useHttpListener = $true
} catch {
    if ($httpListener) {
        try { $httpListener.Close() } catch {}
    }
    $useHttpListener = $false
}

if ($useHttpListener) {
    Write-Host "SERVEUR_OK"
    while ($httpListener.IsListening) {
        try {
            $ctx = $httpListener.GetContext()
            $url = $ctx.Request.Url.AbsolutePath.TrimStart('/')
            if ([string]::IsNullOrEmpty($url) -or $url -eq '/') { $url = 'admin.html' }
            $url = [System.Uri]::UnescapeDataString($url)
            $filePath = Join-Path $rootDir $url

            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $ext = [System.IO.Path]::GetExtension($filePath)
                $ctx.Response.StatusCode = 200
                $ctx.Response.ContentType = Get-MimeType $ext
                $ctx.Response.AddHeader("Access-Control-Allow-Origin", "*")
                $ctx.Response.AddHeader("Cache-Control", "no-cache")
                $ctx.Response.ContentLength64 = $bytes.Length
                $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Fichier Non Trouve")
                $ctx.Response.StatusCode = 404
                $ctx.Response.ContentType = "text/plain; charset=utf-8"
                $ctx.Response.ContentLength64 = $bodyBytes.Length
                $ctx.Response.OutputStream.Write($bodyBytes, 0, $bodyBytes.Length)
            }
            $ctx.Response.OutputStream.Close()
        } catch {
            try { if ($ctx -and $ctx.Response) { $ctx.Response.Abort() } } catch {}
        }
    }
} else {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
    $listener.Start()
    Write-Host "SERVEUR_OK"

    while ($true) {
        $client = $null
        try {
            $client = $listener.AcceptTcpClient()
            $client.ReceiveTimeout = 2000
            $client.SendTimeout = 5000
            $stream = $client.GetStream()
            $stream.ReadTimeout = 2000
            $reader = New-Object System.IO.StreamReader($stream)
            $line = $reader.ReadLine()

            if ($line) {
                $parts = $line.Split(' ')
                if ($parts.Length -ge 2) {
                    $url = $parts[1].TrimStart('/')
                    if ([string]::IsNullOrEmpty($url) -or $url -eq '/') { $url = 'admin.html' }
                    if ($url.Contains('?')) { $url = $url.Substring(0, $url.IndexOf('?')) }
                    $url = [System.Uri]::UnescapeDataString($url)
                    $filePath = Join-Path $rootDir $url

                    if (Test-Path $filePath -PathType Leaf) {
                        $bytes = [System.IO.File]::ReadAllBytes($filePath)
                        $ext = [System.IO.Path]::GetExtension($filePath)
                        $mime = Get-MimeType $ext
                        $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
                        $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($bytes, 0, $bytes.Length)
                    } else {
                        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Fichier Non Trouve")
                        $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`nConnection: close`r`n`r`n"
                        $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                    }
                }
            }
        } catch {
            # Ignore client timeouts / speculative preconnects without blocking next request
        } finally {
            if ($client) {
                try { $client.Close() } catch {}
            }
        }
    }
}
