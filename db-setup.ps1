param(
    [string]$Host = "localhost",
    [string]$Port = "5432",
    [string]$AdminUser = "postgres",
    [string]$AdminPassword
)

$env:PGPASSWORD = $AdminPassword
psql -h $Host -p $Port -U $AdminUser -f db-setup.sql
Write-Host "Done. Set DATABASE_URL=postgresql://wakatime:wakatime@$Host`:$Port/wakatime-bot?schema=public"
