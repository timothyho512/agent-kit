# Install or update Timothy's Codex setup on Windows (Windows PowerShell 5.1+).
# Safe to rerun: installs the skills listed in skills.txt, removes ones taken off the list,
# and backs up AGENTS.md before it changes.
$ErrorActionPreference = 'Stop'

$repo = $PSScriptRoot
$skillsDest = Join-Path (Join-Path $HOME '.agents') 'skills'
if ($env:CODEX_HOME) {
    $codexHome = $env:CODEX_HOME
} else {
    $codexHome = Join-Path $HOME '.codex'
}
# Names of the skills this kit installed last time, so skills taken off the list get removed.
$manifest = Join-Path $codexHome 'agent-kit-skills.txt'
$vendorDir = Join-Path (Join-Path (Join-Path $repo 'skills') 'vendor') 'mattpocock'

# A local change wins over the plain skill, which wins over the vendored original.
function Resolve-Skill {
    param([string]$Name)
    $bases = @(
        (Join-Path (Join-Path $repo 'skills') 'local'),
        (Join-Path $repo 'skills'),
        $vendorDir
    )
    foreach ($base in $bases) {
        $candidate = Join-Path $base $Name
        if (Test-Path -LiteralPath (Join-Path $candidate 'SKILL.md')) {
            return $candidate
        }
    }
    return $null
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
    Write-Host "  skill: $name <- $($Source.Substring($repo.Length + 1))"
}

$wanted = @()
foreach ($line in (Get-Content -LiteralPath (Join-Path $repo 'skills.txt'))) {
    $name = ($line -replace '#.*$', '').Trim()
    if ($name) {
        $wanted += $name
    }
}

# Check every name before touching anything.
$sources = @()
foreach ($name in $wanted) {
    $src = Resolve-Skill -Name $name
    if (-not $src) {
        throw "skills.txt lists '$name', but no skill folder has that name."
    }
    $sources += $src
}

$previous = @()
if (Test-Path -LiteralPath $manifest) {
    $previous = @(Get-Content -LiteralPath $manifest)
}

Write-Host "Installing skills into $skillsDest"
foreach ($dir in @($skillsDest, $codexHome)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
foreach ($old in $previous) {
    if (-not $old) { continue }
    $oldPath = Join-Path $skillsDest $old
    if (($wanted -notcontains $old) -and (Test-Path -LiteralPath (Join-Path $oldPath 'SKILL.md'))) {
        Remove-Item -LiteralPath $oldPath -Recurse -Force
        Write-Host "  removed: $old (not in skills.txt)"
    }
}
foreach ($src in $sources) {
    Install-Skill -Source $src
}
Set-Content -LiteralPath $manifest -Value $wanted -Encoding ASCII

Write-Host "Installing AGENTS.md into $codexHome"
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

$notes = Join-Path $HOME 'agent-notes'
if (-not (Test-Path -LiteralPath $notes)) {
    New-Item -ItemType Directory -Path $notes | Out-Null
    Write-Host "Created the agent notes folder $notes"
}

$htmlScripts = Join-Path (Join-Path $skillsDest 'html-artifact') 'scripts'
Write-Host ""
Write-Host "Done."
Write-Host "To let Codex write to the notes folder without asking each time, add this to $codexHome\config.toml once:"
Write-Host "  [sandbox_workspace_write]"
Write-Host "  writable_roots = [`"$($notes -replace '\\', '\\')`"]"
Write-Host "Note: the html-artifact screenshot checker needs its dependency installed once (kept across updates):"
Write-Host "  npm install --prefix `"$htmlScripts`""
Write-Host "It uses the playwright-core npm package, which may need approval."
Write-Host "The skill works without it, but then it cannot see the pages it builds."
