# Run Seed Files Sequentially
$seedFiles = Get-ChildItem "seed_*.sql" | Where-Object { $_.Name -match '^seed_\d+\.sql$' } | Sort-Object { [int]($_.Name -replace 'seed_', '' -replace '.sql', '') }

foreach ($file in $seedFiles) {
    Write-Host "Running $($file.Name)..."
    npx wrangler d1 execute elfilm_db --file=$($file.Name) --remote
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to execute $($file.Name)"
        break
    }
    Start-Sleep -Seconds 2
}
Write-Host "All seeds completed."
