$ErrorActionPreference = "Stop"
try {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    Write-Host "Connecting to ws://localhost:8002/ws/bbox..."
    $task = $ws.ConnectAsync([Uri]"ws://localhost:8002/ws/bbox", $ct)
    $task.Wait(3000)
    if ($ws.State -eq "Open") {
        Write-Host "WS OPEN SUCCESS - Pipeline accepts connections"
        $ws.CloseAsync("NormalClosure", "", $ct).Wait(1000)
    } else {
        Write-Host "WS STATE: $($ws.State)"
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
