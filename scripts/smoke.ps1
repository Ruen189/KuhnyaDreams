# Smoke test for the API: starts the app, walks the user journey and checks the key scenarios.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1
# NOTE: keep this file ASCII-only so Windows PowerShell 5.1 reads it regardless of encoding.
param(
    [string]$Url = 'http://localhost:5207'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'backend\BingoPlanner.Api\BingoPlanner.Api.csproj'
$log = Join-Path $PSScriptRoot 'smoke-api.log'
$errLog = "$log.err"
$json = 'application/json'

$env:ASPNETCORE_ENVIRONMENT = 'Development'
$process = Start-Process dotnet -ArgumentList @('run', '--project', $project, '--no-build', '--urls', $Url) -PassThru -RedirectStandardOutput $log -RedirectStandardError $errLog

function Step([string]$text) { Write-Host "== $text" }

try {
    $health = $null
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        try { $health = Invoke-RestMethod "$Url/api/health"; break } catch { }
    }
    if (-not $health) { throw "API did not start, see $log" }
    Step "health: database=$($health.database) telegramConfigured=$($health.telegramConfigured)"

    $email = "smoke-$([Guid]::NewGuid().ToString('N').Substring(0, 8))@bingo.local"
    $registerBody = @{ email = $email; password = 'demopass1'; displayName = 'Smoke Tester' } | ConvertTo-Json
    $auth = Invoke-RestMethod "$Url/api/auth/register" -Method Post -ContentType $json -Body $registerBody
    $headers = @{ Authorization = "Bearer $($auth.token)" }
    Step "registered: $email"

    for ($i = 1; $i -le 9; $i++) {
        $taskBody = @{ title = "Task $i"; category = 'Smoke'; priority = 1; difficulty = 2; estimatedMinutes = 15 } | ConvertTo-Json
        Invoke-RestMethod "$Url/api/tasks/" -Method Post -Headers $headers -ContentType $json -Body $taskBody | Out-Null
    }
    $tasks = Invoke-RestMethod "$Url/api/tasks/?includeArchived=false" -Headers $headers
    $tasksNoSlash = Invoke-RestMethod "$Url/api/tasks?includeArchived=false" -Headers $headers
    Step "tasks created: $($tasks.Count) (route without trailing slash: $($tasksNoSlash.Count))"

    $rewardBody = @{ title = 'Coffee break'; emoji = 'C' } | ConvertTo-Json
    $reward = Invoke-RestMethod "$Url/api/rewards/" -Method Post -Headers $headers -ContentType $json -Body $rewardBody
    Step "reward created: $($reward.title) emoji=$($reward.emoji)"

    $boardBody = @{ period = 0; shuffle = $true; useAllActiveTasks = $true } | ConvertTo-Json
    $board = Invoke-RestMethod "$Url/api/boards/" -Method Post -Headers $headers -ContentType $json -Body $boardBody
    Step "board created: $($board.title) size=$($board.size)x$($board.size) cells=$($board.cells.Count)"

    $newAchievements = @()
    foreach ($cell in $board.cells) {
        if ($cell.isFree -or $cell.isPlaceholder) { continue }
        $toggle = Invoke-RestMethod "$Url/api/boards/$($board.id)/cells/$($cell.id)/toggle" -Method Post -Headers $headers
        $newAchievements += $toggle.newAchievements
    }
    $titles = ($newAchievements | ForEach-Object { $_.title }) -join ' | '
    Step "achievements unlocked: $($newAchievements.Count) [$titles]"

    foreach ($achievement in $newAchievements) {
        $resolveBody = @{ rewardId = $reward.id; skip = $false; note = 'smoke' } | ConvertTo-Json
        Invoke-RestMethod "$Url/api/achievements/$($achievement.id)/resolve" -Method Post -Headers $headers -ContentType $json -Body $resolveBody | Out-Null
    }
    Step "reward attached to $($newAchievements.Count) achievements"

    $feed = Invoke-RestMethod "$Url/api/notifications/?take=50&unreadOnly=false" -Headers $headers
    Step "notifications: $($feed.items.Count) items, unread=$($feed.unreadCount)"

    $stats = Invoke-RestMethod "$Url/api/stats/?days=30" -Headers $headers
    $summary = $stats.summary
    Step "stats: cells=$($summary.completedCells) lines=$($summary.linesCollected) bingos=$($summary.bingosCollected) rewards=$($summary.rewardsRedeemed) streak=$($summary.currentStreakDays)/$($summary.longestStreakDays)"

    $current = Invoke-RestMethod "$Url/api/boards/current" -Headers $headers
    Step "active boards right now: $($current.Count)"

    $refreshed = Invoke-RestMethod "$Url/api/boards/$($board.id)" -Headers $headers
    Step "board progress: $($refreshed.progress.percent)% status=$($refreshed.status) bingo=$($refreshed.progress.hasBingo)"

    $checks = Invoke-RestMethod "$Url/api/notifications/run-checks" -Method Post -Headers $headers
    Step "background checks: notifications created = $($checks.created)"

    $spa = Invoke-WebRequest "$Url/" -UseBasicParsing
    Step "spa served: HTTP $($spa.StatusCode), content-type $($spa.Headers['Content-Type'])"

    Write-Host ""
    Write-Host "SMOKE TEST PASSED"
}
finally {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
}