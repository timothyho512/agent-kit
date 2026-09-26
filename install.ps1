# Install or update Timothy's Codex setup on Windows (Windows PowerShell 5.1+).
# Safe to rerun: skills are replaced wholesale, AGENTS.md is backed up before it changes.
$ErrorActionPreference = 'Stop'

$repo = $PSScriptRoot
$skillsDest = Join-Path (Join-Path $HOME '.agents') 'skills'
if ($env:CODEX_HOME) {
    $codexHome = $env:CODEX_HOME
} else {
    $codexHome = Join-Path $HOME '.codex'
}

function Install-Skill {
    param([string]$Source)
    $name = Split-Path -Path $Source -Leaf
    $dest = Join-Path $skillsDest $name
    # Keep installed npm packages (the html-artifact checker) so updates don't force a reinstall.
    $modules = Join-Path (Join-Path $dest 'scripts') 'node_modules'
    $keep = $null
    if (Test-Path -LiteralPath $modules) {
        $keep = Join-Path ([IO.Path]::GetTempPath()) ("agent-kit-" + [guid]::NewGuid())
        New-Item -ItemType Directory -Path $keep | Out-Null
        Move-Item -LiteralPath $modules -Destination $keep
    }
    if (Test-Path -LiteralPath $dest) {
        Remove-Item -LiteralPath $dest -Recurse -Force
    }
    Copy-Item -LiteralPath $Source -Destination $dest -Recurse -Force
    if ($keep) {
        Move-Item -LiteralPath (Join-Path $keep 'node_modules') -Destination (Join-Path $dest 'scripts')
        Remove-Item -LiteralPath $keep -Force
    }
    Write-Host "  skill: $name -> $dest"
}

Write-Host "Installing skills into $skillsDest"
if (-not (Test-Path -LiteralPath $skillsDest)) {
    New-Item -ItemType Directory -Path $skillsDest -Force | Out-Null
}
Install-Skill -Source (Join-Path (Join-Path $repo 'skills') 'html-artifact')
$vendorDir = Join-Path (Join-Path (Join-Path $repo 'skills') 'vendor') 'mattpocock'
foreach ($dir in (Get-ChildItem -LiteralPath $vendorDir | Where-Object { $_.PSIsContainer })) {
    Install-Skill -Source $dir.FullName
}

Write-Host "Installing AGENTS.md into $codexHome"
if (-not (Test-Path -LiteralPath $codexHome)) {
    New-Item -ItemType Directory -Path $codexHome -Force | Out-Null
}
$agentsSrc = Join-Path $repo 'AGENTS.md'
$agentsDest = Join-Path $codexHome 'AGENTS.md'
$identical = $false
if (Test-Path -LiteralPath $agentsDest) {
    $srcHash = (Get-FileHash -LiteralPath $agentsSrc -Algorithm SHA256).Hash
    $destHash = (Get-FileHash -LiteralPath $agentsDest -Algorithm SHA256).Hash
    if ($srcHash -eq $destHash) {
        $identical = $true
    }
}
if ($identical) {
    Write-Host "  AGENTS.md: unchanged"
} else {
    if (Test-Path -LiteralPath $agentsDest) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = "$agentsDest.bak-$stamp"
        Copy-Item -LiteralPath $agentsDest -Destination $backup
        Write-Host "  AGENTS.md: backed up existing file to $backup"
    }
    Copy-Item -LiteralPath $agentsSrc -Destination $agentsDest -Force
    Write-Host "  AGENTS.md: installed $agentsDest"
}

$htmlScripts = Join-Path (Join-Path $skillsDest 'html-artifact') 'scripts'
Write-Host ""
Write-Host "Done."
Write-Host "Note: the html-artifact screenshot checker needs its dependency installed once (kept across updates):"
Write-Host "  npm install --prefix `"$htmlScripts`""
Write-Host "It uses the playwright-core npm package, which may need approval."
Write-Host "The skill works without it, but then it cannot see the pages it builds."
