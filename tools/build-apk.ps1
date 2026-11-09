<#
.SYNOPSIS
  Construit l'APK Android de Aide Visio (Trusted Web Activity) signé : dist\AideVisio.apk.

.DESCRIPTION
  Refait tout, de A à Z :
    1. trouve un JDK 17+ et le SDK Android (platform android-36, build-tools 36.0.0) ;
    2. régénère les icônes Android depuis src\icons\icon.svg (node + playwright-core), sauf -SkipIcons ;
    3. crée si besoin la clé de signature %USERPROFILE%\.aidevisio\release.jks
       (mot de passe aléatoire dans release.properties, à côté, JAMAIS dans le dépôt).
       Une clé existante n'est jamais régénérée : les mises à jour de l'APK et
       assetlinks.json en dépendent. Sauvegardez ce dossier ;
    4. lance gradlew assembleRelease (Gradle 8.14.4, Android Gradle Plugin 8.13) ;
    5. copie l'APK dans dist\AideVisio.apk, vérifie la signature (apksigner) et le contenu (aapt2) ;
    6. écrit android\assetlinks.json (empreinte SHA-256 du certificat), à publier sur
       https://<hôte>/.well-known/assetlinks.json pour que l'app s'ouvre sans barre d'adresse.
  Compatible Windows PowerShell 5.1 et PowerShell 7.

.PARAMETER AppUrl
  URL publique de l'app web (https, se termine par /).

.PARAMETER VersionName
  Nom de version (par défaut : "version" de package.json).

.PARAMETER VersionCode
  Code de version entier (par défaut : majeur*10000 + mineur*100 + correctif).

.PARAMETER SkipIcons
  Ne régénère pas les icônes (utilise celles déjà présentes dans android\app\src\main\res).

.PARAMETER Clean
  Nettoie la sortie Gradle avant de construire.

.PARAMETER Install
  Installe ensuite l'APK sur l'appareil Android connecté (adb install -r).

.EXAMPLE
  pwsh -NoProfile -File tools\build-apk.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-apk.ps1 -Clean -VersionCode 20001
[CmdletBinding()]
param(
    [string]$AppUrl = 'https://cmssmc-code.github.io/aide-visio/',
    [string]$VersionName,
    [int]$VersionCode = 0,
    [switch]$SkipIcons,
    [switch]$Clean,
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$Root = Split-Path -Parent $PSScriptRoot
$Android = Join-Path $Root 'android'
$Dist = Join-Path $Root 'dist'
$DistApk = Join-Path $Dist 'AideVisio.apk'
$PackageName = 'io.github.cmssmc_code.aidevisio'
$UserHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$KeyDir = Join-Path $UserHome '.aidevisio'
$KeyStore = Join-Path $KeyDir 'release.jks'
$KeyProps = Join-Path $KeyDir 'release.properties'
$KeyAlias = 'aidevisio'
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-Step([string]$Message) { Write-Host ''; Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "    $Message" -ForegroundColor Green }
function Stop-Build([string]$Message) {
    Write-Host ''
    Write-Host "ERREUR : $Message" -ForegroundColor Red
    exit 1
}

function Invoke-Native {
    param([Parameter(Mandatory)][string]$Exe, [string[]]$Arguments = @())
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Exe @Arguments 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    [pscustomobject]@{ Code = $code; Output = @($output) }
}

function Read-Properties([string]$Path) {
    $map = @{}
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ($line -match '^\s*([^#!=:\s][^=:]*?)\s*[=:]\s*(.*)$') { $map[$Matches[1]] = $Matches[2] }
    }
    $map
}

function New-RandomPassword([int]$Length = 32) {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $limit = 256 - (256 % $alphabet.Length) # rejection sampling: no modulo bias
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $chars = New-Object System.Collections.Generic.List[char]
    $buffer = New-Object byte[] 64
    try {
        while ($chars.Count -lt $Length) {
            $rng.GetBytes($buffer)
            foreach ($b in $buffer) {
                if ($b -lt $limit -and $chars.Count -lt $Length) { $chars.Add($alphabet[$b % $alphabet.Length]) }
            }
        }
    } finally {
        $rng.Dispose()
    }
    -join $chars
}

function Find-Jdk {
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:JAVA_HOME) { $candidates.Add($env:JAVA_HOME) }
    $candidates.Add((Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'))
    foreach ($vendorDir in @('Microsoft', 'Eclipse Adoptium', 'Java', 'Zulu', 'Amazon Corretto')) {
        $base = Join-Path $env:ProgramFiles $vendorDir
        if (Test-Path $base) {
            Get-ChildItem $base -Directory -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending | ForEach-Object { $candidates.Add($_.FullName) }
        }
    }
    $java = Get-Command java -ErrorAction SilentlyContinue
    if ($java) { $candidates.Add((Split-Path (Split-Path $java.Source))) }
    foreach ($dir in $candidates) {
        if (-not $dir) { continue }
        $exe = Join-Path $dir 'bin\java.exe'
        if (-not ((Test-Path $exe) -and (Test-Path (Join-Path $dir 'bin\keytool.exe')))) { continue }
        $probe = Invoke-Native $exe @('-version')
        if (($probe.Output -join "`n") -match 'version "(\d+)') {
            if ([int]$Matches[1] -ge 17) { return $dir }
        }
    }
    $null
}

function Format-Fingerprint([string]$Hex) {
    $clean = ($Hex -replace '[^0-9a-fA-F]', '').ToUpperInvariant()
    (($clean -split '(..)') | Where-Object { $_ }) -join ':'
}

if ($AppUrl -notmatch '^https://[^/\s]+') { Stop-Build "AppUrl doit commencer par https:// (reçu : $AppUrl)" }
if (-not $AppUrl.EndsWith('/')) { $AppUrl += '/' }
$AppUri = [Uri]$AppUrl
$AppOrigin = '{0}://{1}' -f $AppUri.Scheme, $AppUri.Authority

Write-Step 'Outils : JDK et SDK Android'
$Jdk = Find-Jdk
if (-not $Jdk) { Stop-Build 'JDK 17 ou plus introuvable. Installez Microsoft OpenJDK 21 (winget install Microsoft.OpenJDK.21) ou définissez JAVA_HOME.' }
$env:JAVA_HOME = $Jdk
$env:PATH = (Join-Path $Jdk 'bin') + [System.IO.Path]::PathSeparator + $env:PATH
$Keytool = Join-Path $Jdk 'bin\keytool.exe'
Write-Ok "JDK : $Jdk"

$SdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT)
if ($env:LOCALAPPDATA) { $SdkCandidates += (Join-Path $env:LOCALAPPDATA 'Android\Sdk') }
$Sdk = $SdkCandidates | Where-Object { $_ -and (Test-Path (Join-Path $_ 'platforms')) } | Select-Object -First 1
if (-not $Sdk) { Stop-Build 'SDK Android introuvable (ANDROID_HOME, ou %LOCALAPPDATA%\Android\Sdk).' }
$BuildTools = Join-Path $Sdk 'build-tools\36.0.0'
$Missing = @()
if (-not (Test-Path (Join-Path $Sdk 'platforms\android-36\android.jar'))) { $Missing += 'platforms;android-36' }
if (-not (Test-Path (Join-Path $BuildTools 'aapt2.exe'))) { $Missing += 'build-tools;36.0.0' }
if ($Missing.Count) {
    Stop-Build ("Composants SDK manquants : {0}. Installez-les avec :`n  `"{1}`" {2}" -f ($Missing -join ', '),
        (Join-Path $Sdk 'cmdline-tools\latest\bin\sdkmanager.bat'), (($Missing | ForEach-Object { "`"$_`"" }) -join ' '))
}
$env:ANDROID_HOME = $Sdk
[System.IO.File]::WriteAllText((Join-Path $Android 'local.properties'),
    "# Généré par tools/build-apk.ps1 (ne pas versionner)`nsdk.dir=$(($Sdk -replace '\\', '/') -replace ':', '\:')`n", $Utf8NoBom)
Write-Ok "SDK : $Sdk"

Write-Step 'Icônes Android (depuis src\icons\icon.svg)'
$Node = Get-Command node -ErrorAction SilentlyContinue
$HaveIcons = Test-Path (Join-Path $Android 'app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png')
if ($SkipIcons) {
    Write-Ok 'Ignoré (-SkipIcons).'
} elseif (-not $Node -or -not (Test-Path (Join-Path $Root 'node_modules\playwright-core'))) {
    if (-not $HaveIcons) { Stop-Build 'Icônes absentes et impossibles à générer : installez Node.js puis lancez « npm install » à la racine.' }
    Write-Warning 'node ou playwright-core absent : icônes existantes conservées.'
} else {
    $icons = Invoke-Native $Node.Source @((Join-Path $Android 'scripts\gen-icons.mjs'))
    $icons.Output | ForEach-Object { Write-Host "    $_" }
    if ($icons.Code -ne 0) {
        if (-not $HaveIcons) { Stop-Build 'Génération des icônes impossible.' }
        Write-Warning 'Génération des icônes impossible : icônes existantes conservées.'
    }
}

Write-Step "Clé de signature ($KeyDir)"
if (-not (Test-Path $KeyStore)) {
    if (Test-Path $KeyProps) {
        Stop-Build "release.properties existe mais release.jks a disparu. Restaurez release.jks depuis votre sauvegarde (une nouvelle clé empêcherait la mise à jour de l'app installée)."
    }
    $newDir = -not (Test-Path $KeyDir)
    New-Item -ItemType Directory -Force -Path $KeyDir | Out-Null
    if ($newDir) {
        $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $acl = Invoke-Native 'icacls.exe' @($KeyDir, '/inheritance:r', '/grant:r', "*${sid}:(OI)(CI)F", '*S-1-5-18:(OI)(CI)F')
        if ($acl.Code -ne 0) { Write-Warning "Droits du dossier non restreints : $($acl.Output -join ' ')" }
    }
    $password = New-RandomPassword 32
    $env:AIDE_VISIO_KS_PASS = $password
    try {
        $gen = Invoke-Native $Keytool @('-genkeypair', '-keystore', $KeyStore, '-storetype', 'PKCS12',
            '-alias', $KeyAlias, '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
            '-dname', 'CN=Aide Visio, OU=Aide Visio, O=cmssmc-code, C=FR',
            '-storepass:env', 'AIDE_VISIO_KS_PASS', '-noprompt')
    } finally {
        Remove-Item Env:AIDE_VISIO_KS_PASS -ErrorAction SilentlyContinue
    }
    if ($gen.Code -ne 0 -or -not (Test-Path $KeyStore)) { Stop-Build "keytool a échoué : $($gen.Output -join ' ')" }
    $props = @(
        '# Aide Visio : clé de signature de l''APK. NE PAS PARTAGER, NE PAS VERSIONNER. Sauvegarder avec release.jks.',
        "storeFile=$($KeyStore -replace '\\', '/')",
        "storePassword=$password",
        "keyAlias=$KeyAlias",
        "keyPassword=$password"
    ) -join "`n"
    [System.IO.File]::WriteAllText($KeyProps, $props + "`n", $Utf8NoBom)
    Write-Ok "Nouvelle clé créée : $KeyStore (mot de passe dans release.properties)"
} elseif (-not (Test-Path $KeyProps)) {
    Stop-Build "release.jks existe mais release.properties est absent (mot de passe inconnu). Restaurez release.properties ; ne régénérez pas la clé."
} else {
    Write-Ok "Clé existante réutilisée : $KeyStore"
}
$Signing = Read-Properties $KeyProps
foreach ($k in @('storeFile', 'storePassword', 'keyAlias')) {
    if (-not $Signing.ContainsKey($k) -or -not $Signing[$k]) { Stop-Build "Clé « $k » absente de $KeyProps" }
}
$env:AIDE_VISIO_SIGNING_PROPERTIES = $KeyProps

Write-Step 'Gradle : assembleRelease'
$GradleArgs = New-Object System.Collections.Generic.List[string]
if ($Clean) { $GradleArgs.Add('clean') }
$GradleArgs.Add('assembleRelease')
foreach ($a in @('--no-daemon', '--console=plain', '--warning-mode=summary', "-PaidevisioUrl=$AppUrl")) { $GradleArgs.Add($a) }
if ($VersionName) { $GradleArgs.Add("-PaidevisioVersionName=$VersionName") }
if ($VersionCode -gt 0) { $GradleArgs.Add("-PaidevisioVersionCode=$VersionCode") }
$Gradlew = Join-Path $Android 'gradlew.bat'
$previous = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
Push-Location $Android
try {
    & $Gradlew @GradleArgs
    $gradleCode = $LASTEXITCODE
} finally {
    Pop-Location
    $ErrorActionPreference = $previous
}
if ($gradleCode -ne 0) { Stop-Build "Gradle a échoué (code $gradleCode). Relancez avec -Clean ; détails ci-dessus." }

$BuiltApk = Join-Path $Android 'app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path $BuiltApk)) { Stop-Build "APK signé introuvable ($BuiltApk). La signature est-elle configurée ?" }
New-Item -ItemType Directory -Force -Path $Dist | Out-Null
Copy-Item $BuiltApk $DistApk -Force
Write-Ok "APK : $DistApk"

Write-Step 'Vérification de la signature (apksigner)'
$Apksigner = Join-Path $BuildTools 'apksigner.bat'
$verify = Invoke-Native $Apksigner @('verify', '--verbose', '--print-certs', $DistApk)
if ($verify.Code -ne 0) { Stop-Build "apksigner : signature invalide.`n$($verify.Output -join "`n")" }
$schemes = $verify.Output | Where-Object { $_ -match '^Verified using v\d.*: true$' }
$schemes | ForEach-Object { Write-Ok $_ }
$digestLine = $verify.Output | Where-Object { $_ -match 'Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)' } | Select-Object -First 1
if (-not $digestLine) { Stop-Build 'Empreinte SHA-256 du certificat introuvable dans la sortie apksigner.' }
$null = $digestLine -match 'SHA-256 digest:\s*([0-9a-fA-F]+)'
$CertSha256 = Format-Fingerprint $Matches[1]

$env:AIDE_VISIO_KS_PASS = $Signing['storePassword']
try {
    $list = Invoke-Native $Keytool @('-J-Duser.language=en', '-list', '-v', '-keystore', ($Signing['storeFile'] -replace '/', '\'),
        '-alias', $Signing['keyAlias'], '-storepass:env', 'AIDE_VISIO_KS_PASS')
} finally {
    Remove-Item Env:AIDE_VISIO_KS_PASS -ErrorAction SilentlyContinue
}
$ksPattern = 'SHA[ -]?256\s*:\s*([0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){31})'
$ksLine = $list.Output | Where-Object { $_ -match $ksPattern } | Select-Object -First 1
if (-not $ksLine) {
    Write-Warning 'Empreinte de la clé locale illisible (keytool) : comparaison ignorée.'
} else {
    $null = $ksLine -match $ksPattern
    if ((Format-Fingerprint $Matches[1]) -ne $CertSha256) { Stop-Build "L'APK n'est pas signé avec $($Signing['storeFile'])." }
    Write-Ok 'Empreinte identique à celle de la clé locale.'
}
Write-Ok "Certificat SHA-256 : $CertSha256"

Write-Step 'Vérification du contenu (aapt2)'
$Aapt2 = Join-Path $BuildTools 'aapt2.exe'
$badging = Invoke-Native $Aapt2 @('dump', 'badging', $DistApk)
if ($badging.Code -ne 0) { Stop-Build "aapt2 dump badging a échoué.`n$($badging.Output -join "`n")" }
$text = $badging.Output -join "`n"
$pkgLine = $badging.Output | Where-Object { $_ -like 'package:*' } | Select-Object -First 1
if ($pkgLine -notmatch "name='([^']+)' versionCode='(\d+)' versionName='([^']*)'") { Stop-Build "Ligne package illisible : $pkgLine" }
$ApkPackage = $Matches[1]; $ApkVersionCode = $Matches[2]; $ApkVersionName = $Matches[3]
$ApkMinSdk = if ($text -match "sdkVersion:'(\d+)'") { $Matches[1] } else { '?' }
$ApkTargetSdk = if ($text -match "targetSdkVersion:'(\d+)'") { $Matches[1] } else { '?' }
$Permissions = @($badging.Output | Where-Object { $_ -match "^uses-permission: name='([^']+)'" } | ForEach-Object { ($_ -split "'")[1] })
$Label = if ($text -match "application-label:'([^']*)'") { $Matches[1] } else { '?' }
$problems = @()
if ($ApkPackage -ne $PackageName) { $problems += "package $ApkPackage (attendu $PackageName)" }
foreach ($p in @('android.permission.INTERNET', 'android.permission.RECORD_AUDIO')) {
    if ($Permissions -notcontains $p) { $problems += "permission manquante $p" }
}
if ($ApkTargetSdk -ne '36') { $problems += "targetSdk $ApkTargetSdk (attendu 36)" }
if ($Label -ne 'Aide Visio') { $problems += "nom $Label (attendu Aide Visio)" }
if ($text -notmatch "launchable-activity: name='$([regex]::Escape($PackageName)).LauncherActivity'") { $problems += 'activité de lancement absente' }

$manifestTree = Invoke-Native $Aapt2 @('dump', 'xmltree', '--file', 'AndroidManifest.xml', $DistApk)
$tree = $manifestTree.Output -join "`n"
if ($tree -notmatch [regex]::Escape($AppUri.Host)) { $problems += "hôte $($AppUri.Host) absent du filtre d'intention" }
$strings = Invoke-Native $Aapt2 @('dump', 'strings', $DistApk)
if (($strings.Output -join "`n") -notmatch [regex]::Escape($AppUrl)) { $problems += "URL $AppUrl absente des ressources" }
if ($problems.Count) { Stop-Build ('APK incorrect : ' + ($problems -join ' ; ')) }
Write-Ok "Package $ApkPackage, version $ApkVersionName ($ApkVersionCode), minSdk $ApkMinSdk, targetSdk $ApkTargetSdk"
Write-Ok ('Permissions : ' + ($Permissions -join ', '))

$Apkanalyzer = Join-Path $Sdk 'cmdline-tools\latest\bin\apkanalyzer.bat'
if (Test-Path $Apkanalyzer) {
    $summary = Invoke-Native $Apkanalyzer @('apk', 'summary', $DistApk)
    if ($summary.Code -eq 0) { Write-Ok ('apkanalyzer : ' + (($summary.Output | Where-Object { $_ -match '\S' }) -join ' ')) }
}

Write-Step 'Digital Asset Links'
$AssetLinks = Join-Path $Android 'assetlinks.json'
$json = @"
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "$PackageName",
      "sha256_cert_fingerprints": ["$CertSha256"]
    }
  }
]
"@
[System.IO.File]::WriteAllText($AssetLinks, ($json -replace "`r`n", "`n") + "`n", $Utf8NoBom)
Write-Ok "$AssetLinks"
Write-Ok "À publier sur : $AppOrigin/.well-known/assetlinks.json"

if ($Install) {
    Write-Step 'Installation sur l''appareil (adb)'
    $Adb = Join-Path $Sdk 'platform-tools\adb.exe'
    if (-not (Test-Path $Adb)) { Stop-Build 'adb introuvable (platform-tools).' }
    $inst = Invoke-Native $Adb @('install', '-r', $DistApk)
    $inst.Output | ForEach-Object { Write-Host "    $_" }
    if ($inst.Code -ne 0) { Stop-Build 'adb install a échoué (appareil connecté et débogage USB/wifi autorisé ?).' }
}

$size = (Get-Item $DistApk).Length
$apkHash = (Get-FileHash $DistApk -Algorithm SHA256).Hash
Write-Host ''
Write-Host 'AideVisio.apk prêt' -ForegroundColor Green
Write-Host ("  Fichier     : {0} ({1:N2} Mo)" -f $DistApk, ($size / 1MB))
Write-Host ("  Version     : {0} ({1}), minSdk {2}, targetSdk {3}" -f $ApkVersionName, $ApkVersionCode, $ApkMinSdk, $ApkTargetSdk)
Write-Host ("  URL         : {0}" -f $AppUrl)
Write-Host ("  Certificat  : SHA-256 {0}" -f $CertSha256)
Write-Host ("  SHA-256 APK : {0}" -f $apkHash)
Write-Host ("  Asset links : {0} -> {1}/.well-known/assetlinks.json" -f $AssetLinks, $AppOrigin)
