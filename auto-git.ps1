# Auto git script
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Update: $timestamp"

# Change to the correct directory
Set-Location -Path "D:\inequality-web\fe_web"

# Git commands
git add .
git commit -m $commitMessage
git push

Write-Host "Changes committed and pushed successfully at $timestamp" 