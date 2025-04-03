# Auto-commit script
Write-Host "Checking for changes..."
git add .
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$message = "Auto-commit: UI improvements at $timestamp"
git commit -m $message
Write-Host "Pushing changes to remote repository..."
git push
Write-Host "Changes pushed successfully!" 