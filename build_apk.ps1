$source = "C:\Users\Asus\OneDrive\Desktop\skill change\skill change"
$dest = "C:\skill_change_build"

Write-Host "Copying project to $dest to avoid space-in-path bugs..."
# Exclude specifically the root android and .git folders
robocopy $source $dest /MIR /XD "$source\android" "$source\.git" /XF release_build_logs.txt build_apk.ps1

Set-Location $dest

Write-Host "Running prebuild..."
npx expo prebuild -p android --clean

Write-Host "Setting local.properties..."
"sdk.dir=C\:\\Users\\Asus\\AppData\\Local\\Android\\Sdk" | Out-File -FilePath "$dest\android\local.properties" -Encoding ascii

Set-Location "$dest\android"

Write-Host "Building APK..."
.\gradlew assembleRelease

Write-Host "Copying APK back to project..."
Copy-Item "app\build\outputs\apk\release\app-release.apk" "$source\app-release.apk" -Force

Write-Host "Done!"
