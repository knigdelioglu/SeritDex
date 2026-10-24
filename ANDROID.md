# ŞeritDeX — Native Android 16

The repository contains a React/Vite design prototype in `src/` and a separate Kotlin/Jetpack Compose Android app in `app/`.

- **minSdk=36 / targetSdk=36 / compileSdk=36**, JDK 17, Gradle 8.13
- Native adaptive tablet and Samsung DeX UI with accessibility-backed window discovery
- Accessible bottom HUD (no SYSTEM_ALERT_WINDOW permission), app launcher, width presets, hardware keyboard Alt+Left/Right and Alt+Space
- Enabling accessibility is the user's choice; no accessibility data leaves the device.
- To build: `gradle :app:testDebugUnitTest :app:assembleRelease`
- Successful main pushes publish an APK prerelease through [Releases](https://github.com/knigdelioglu/SeritDex/releases).

## Honest platform limits

`ActivityOptions.setLaunchBounds` supplies **new launch bounds**, not live task resizing. Android/One UI may ignore those hints. Direct IActivityTaskManager control, global three-finger gestures and Shizuku integration are **not implemented or verified** in this native baseline. Those are concepts in the web prototype, not shipping features.

## Signing

CI builds are intentionally **debug-signed prereleases**, installable for personal testing. Every fresh runner generates its own signing certificate, so installing an update over a prior build can fail; uninstalling the old build may be required. For reliable upgrades, configure a stable **private** signing keystore in GitHub Actions secrets. Do not commit signing keys to this public repository.
