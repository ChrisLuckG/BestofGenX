# Deploy to Vercel Production and cleanup old deployments
# Usage: .\deploy.ps1

Write-Host "🚀 Deploying to Vercel Production..." -ForegroundColor Cyan

# Deploy to production
vercel --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🧹 Cleaning up old deployments..." -ForegroundColor Yellow

# Get all deployments (JSON format)
$deploymentsJson = vercel ls --json 2>$null

if ($deploymentsJson) {
    $deployments = $deploymentsJson | ConvertFrom-Json
    
    # Keep the latest 3 deployments, delete the rest
    $toDelete = $deployments | Select-Object -Skip 3
    
    $deleted = 0
    foreach ($dep in $toDelete) {
        $url = $dep.url
        if ($url) {
            Write-Host "  Removing: $url" -ForegroundColor Gray
            vercel rm $url --yes 2>$null
            $deleted++
        }
    }
    
    if ($deleted -gt 0) {
        Write-Host "✅ Deleted $deleted old deployment(s)" -ForegroundColor Green
    } else {
        Write-Host "✅ No old deployments to clean up" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️ Could not list deployments" -ForegroundColor Yellow
}

Write-Host "`n✨ Done!" -ForegroundColor Cyan
