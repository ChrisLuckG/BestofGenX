# Cleanup Vercel Deployments - Keeps only the latest deployment
# Usage: .\scripts\cleanup-vercel-deployments.ps1

Write-Host "Fetching Vercel deployments..." -ForegroundColor Cyan

# Get all deployments and parse URLs from output
$output = vercel ls 2>&1 | Out-String
$urls = [regex]::Matches($output, 'https://sporttock-[a-z0-9]+-chrislucks-projects\.vercel\.app') | ForEach-Object { $_.Value }

if ($urls.Count -le 1) {
    Write-Host "Only $($urls.Count) deployment(s) found. Nothing to delete." -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($urls.Count) deployments" -ForegroundColor Green

# Keep the first one (latest), delete the rest
$latest = $urls[0]
$toDelete = $urls | Select-Object -Skip 1

Write-Host "Keeping: $latest" -ForegroundColor Green
Write-Host "Deleting $($toDelete.Count) old deployments..." -ForegroundColor Yellow

$deleted = 0
$failed = 0

foreach ($url in $toDelete) {
    Write-Host "  Deleting: $url" -ForegroundColor Gray
    
    $result = vercel rm $url --yes 2>&1
    if ($LASTEXITCODE -eq 0) {
        $deleted++
        Write-Host "    OK" -ForegroundColor Green
    } else {
        Write-Host "    Failed" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Done! Deleted: $deleted, Failed: $failed" -ForegroundColor Cyan
