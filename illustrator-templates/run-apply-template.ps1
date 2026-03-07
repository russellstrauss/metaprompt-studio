# run-apply-template.ps1
# Runs apply-template-variants.jsx in batch mode: no dialogs, then Illustrator quits.
# Usage: .\run-apply-template.ps1 -TemplatePath "path\to\template.ai" -JsonPath "path\to\content.json"
# Or:    .\run-apply-template.ps1 "path\to\template.ai" "path\to\content.json"

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $TemplatePath,
    [Parameter(Mandatory = $true, Position = 1)]
    [string] $JsonPath
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$argsFilePath = Join-Path $scriptDir "apply-template-args.txt"
$jsxPath = Join-Path $scriptDir "apply-template-variants.jsx"

$templateFull = (Resolve-Path -LiteralPath $TemplatePath).Path
$jsonFull = (Resolve-Path -LiteralPath $JsonPath).Path

if (-not (Test-Path -LiteralPath $jsxPath)) {
    Write-Error "Script not found: $jsxPath"
}
Set-Content -Path $argsFilePath -Encoding UTF8 -Value @($templateFull, $jsonFull)

# Find Illustrator.exe: prefer env, then latest under Program Files
$illExe = $env:ILLUSTRATOR_EXE
if (-not $illExe -or -not (Test-Path -LiteralPath $illExe)) {
    $adobe = "C:\Program Files\Adobe"
    if (Test-Path $adobe) {
        $candidates = Get-ChildItem -Path $adobe -Filter "Illustrator.exe" -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "Support Files\\Contents\\Windows\\Illustrator\.exe$" } |
            Sort-Object { $_.Directory.Parent.Parent.Name } -Descending
        if ($candidates) {
            $illExe = $candidates[0].FullName
        }
    }
}
if (-not $illExe -or -not (Test-Path -LiteralPath $illExe)) {
    Remove-Item -LiteralPath $argsFilePath -Force -ErrorAction SilentlyContinue
    Write-Error "Illustrator.exe not found. Set ILLUSTRATOR_EXE or install Adobe Illustrator."
}

Write-Host "Template: $templateFull"
Write-Host "JSON:    $jsonFull"
Write-Host "Running Illustrator with script..."
& $illExe $jsxPath

# Clean up args file if script didn't (e.g. Illustrator failed to start)
if (Test-Path -LiteralPath $argsFilePath) {
    Remove-Item -LiteralPath $argsFilePath -Force -ErrorAction SilentlyContinue
}
