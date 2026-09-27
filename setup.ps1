$ErrorActionPreference = "Stop"

Write-Host "Starting ReachInbox infrastructure..."
docker compose up -d

Write-Host "Installing backend dependencies..."
Push-Location backend
if (!(Test-Path .env)) {
    Copy-Item .env.example .env

    function New-RandomHex {
    param(
        [int]$Bytes = 32
    )

    $buffer = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $rng.GetBytes($buffer)
    }
    finally {
        $rng.Dispose()
    }

    return ([Convert]::ToHexString($buffer)).ToLower()
}

$sessionSecret = New-RandomHex 32
$encryptionKey = New-RandomHex 32

    (Get-Content .env) -replace '^SESSION_SECRET=.*$', "SESSION_SECRET=$sessionSecret" `
                      -replace '^ENCRYPTION_KEY=.*$', "ENCRYPTION_KEY=$encryptionKey" |
        Set-Content .env
}

npm install
npx prisma migrate deploy
npx prisma generate
Pop-Location

Write-Host "Installing frontend dependencies..."
Push-Location frontend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
Pop-Location

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Configure Google OAuth, Slack OAuth and Ethereal values in backend/.env before testing those integrations."
Write-Host "Never commit backend/.env."
