$ErrorActionPreference = "Stop"

$git = "C:\Users\John Alvin Baylon\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd\git.exe"
$repo = "C:\Users\John Alvin Baylon\OneDrive\AI Projects\NirvTrack 2.0"

Write-Host ">>> Initializing git repository in $repo..."
& $git -C $repo init -b main

Write-Host ">>> Configuring git remote..."
$existingRemote = & $git -C $repo remote
if ($existingRemote -contains 'origin') {
  & $git -C $repo remote set-url origin https://github.com/nirvash0074/NirvTrack-2.0.git
} else {
  & $git -C $repo remote add origin https://github.com/nirvash0074/NirvTrack-2.0.git
}

Write-Host ">>> Staging files..."
& $git -C $repo add -A

Write-Host ">>> Creating initial commit on main..."
& $git -C $repo commit -m "feat: initial commit of NirvTrack 2.0 with Supabase PostgreSQL, Google OAuth & PWA"

Write-Host ">>> Pushing main branch to origin..."
& $git -C $repo push -u origin main

Write-Host ">>> Creating and pushing dev branch..."
& $git -C $repo checkout -b dev
& $git -C $repo push -u origin dev

Write-Host ">>> Successfully pushed main and dev branches to https://github.com/nirvash0074/NirvTrack-2.0"
