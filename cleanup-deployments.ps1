# Cleanup old Vercel deployments - keeps only the latest one
# Run with: .\cleanup-deployments.ps1

$project = "sporttock"
$keepCount = 1  # Keep only the latest deployment

Write-Host "Fetching all deployments..." -ForegroundColor Cyan

# Get all deployment URLs (skip header lines)
$output = vercel ls $project 2>&1 | Out-String
$lines = $output -split "`n" | Where-Object { $_ -match "https://sporttock-" }

$deployments = @()
foreach ($line in $lines) {
    if ($line -match "(https://sporttock-[^\s]+)") {
        $deployments += $matches[1]
    }
}

Write-Host "Found $($deployments.Count) deployments" -ForegroundColor Yellow

if ($deployments.Count -le $keepCount) {
    Write-Host "Nothing to delete - only $($deployments.Count) deployment(s) found" -ForegroundColor Green
    exit
}

# Skip the first N (newest) deployments
$toDelete = $deployments | Select-Object -Skip $keepCount

Write-Host "Will delete $($toDelete.Count) old deployments..." -ForegroundColor Red

$deleted = 0
foreach ($url in $toDelete) {
    Write-Host "Deleting: $url" -ForegroundColor Gray
    vercel rm $url --yes 2>&1 | Out-Null
    $deleted++
    Write-Host "Deleted $deleted / $($toDelete.Count)" -ForegroundColor Green
}

Write-Host "`nDone! Deleted $deleted deployments." -ForegroundColor Cyan
