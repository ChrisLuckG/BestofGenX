# Cleanup ALL old Vercel deployments - keeps only the latest one
# Loops through all pages

$project = "sporttock"
$keepCount = 1
$allDeployments = @()
$nextToken = $null

Write-Host "Fetching all deployments (all pages)..." -ForegroundColor Cyan

# Loop through all pages
do {
    if ($nextToken) {
        $output = vercel ls $project --next $nextToken 2>&1 | Out-String
    } else {
        $output = vercel ls $project 2>&1 | Out-String
    }
    
    # Extract deployment URLs
    $lines = $output -split "`n" | Where-Object { $_ -match "https://sporttock-" }
    foreach ($line in $lines) {
        if ($line -match "(https://sporttock-[^\s]+)") {
            $allDeployments += $matches[1]
        }
    }
    
    # Check for next page token
    if ($output -match "--next (\d+)") {
        $nextToken = $matches[1]
        Write-Host "  Found page, total so far: $($allDeployments.Count)" -ForegroundColor Gray
    } else {
        $nextToken = $null
    }
} while ($nextToken)

Write-Host "Found $($allDeployments.Count) total deployments" -ForegroundColor Yellow

if ($allDeployments.Count -le $keepCount) {
    Write-Host "Nothing to delete!" -ForegroundColor Green
    exit
}

# Skip the newest
$toDelete = $allDeployments | Select-Object -Skip $keepCount

Write-Host "Deleting $($toDelete.Count) old deployments..." -ForegroundColor Red

$deleted = 0
foreach ($url in $toDelete) {
    Write-Host "Deleting: $url" -ForegroundColor Gray
    vercel rm $url --yes 2>&1 | Out-Null
    $deleted++
    if ($deleted % 10 -eq 0) {
        Write-Host "Progress: $deleted / $($toDelete.Count)" -ForegroundColor Green
    }
}

Write-Host "`nDone! Deleted $deleted deployments." -ForegroundColor Cyan
