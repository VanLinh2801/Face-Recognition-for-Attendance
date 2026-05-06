param(
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

$composeArgs = @("--env-file", ".env.e2e", "-f", "docker-compose.yml", "-f", "docker-compose.e2e.yml")

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    docker compose @composeArgs @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

try {
    Write-Host "Starting infrastructure services..."
    Invoke-Compose -Arguments @("up", "-d", "postgres", "redis", "minio", "qdrant") -FailureMessage "Failed to start infrastructure services."

    Write-Host "Building backend image..."
    Invoke-Compose -Arguments @("build", "backend") -FailureMessage "Failed to build backend image."

    Write-Host "Applying backend migrations..."
    Invoke-Compose -Arguments @("run", "--rm", "backend-migrate") -FailureMessage "Failed to apply backend migrations."

    Write-Host "Starting MinIO bucket bootstrap..."
    Invoke-Compose -Arguments @("run", "--rm", "minio-init") -FailureMessage "Failed to initialize MinIO bucket."

    Write-Host "Starting backend..."
    Invoke-Compose -Arguments @("up", "-d", "backend") -FailureMessage "Failed to start backend service."

    Write-Host "Running backend e2e tests..."
    Invoke-Compose -Arguments @("--profile", "e2e-runner", "run", "--rm", "e2e-runner") -FailureMessage "Backend e2e tests failed."
}
finally {
    if (-not $KeepRunning) {
        Write-Host "Stopping e2e stack..."
        docker compose @composeArgs down
    }
}
