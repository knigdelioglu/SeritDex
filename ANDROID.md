# ŞeritDeX — Native Android 16

The repository contains a React/Vite design prototype in `src/` and a separate Kotlin/Jetpack Compose Android app in `app/`.

- **minSdk=36 / targetSdk=36 / compileSdk=36**, JDK 17, Gradle 8.13
- Native adaptive tablet and Samsung DeX UI with accessibility-backed window discovery
- Accessible bottom HUD (no SYSTEM_ALERT_WINDOW permission), app launcher, width presets, hardware keyboard Alt+Left/Right and Alt+Space
- Enabling accessibility is the user's choice; no accessibility data leaves the device.
- To build: `gradle :app:testDebugUnitTest :app:assembleRelease`
- Successful main pushes publish an APK prerelease through [Releases](https://github.com/knigdelioglu/SeritDex/releases).

## Experimental horizontal strip (v0.2.0)

Android Accessibility cannot reposition another app's task. To test actual task movement:
1. Open two or more apps in separate Samsung DeX windows.
2. Install [Shizuku](https://shizuku.rikka.app/download/) and start its ADB service using wireless debugging.
3. In ŞeritDeX, tap **Shizuku bağla**, authorize it, then **Pencereleri bul**.
4. Select **Şeridi uygula** and move left/right from the main screen or bottom HUD.
5. Tap **Kurtar** to restore the original bounds if movement fails.

The experimental Android 16 bridge runs as a Shizuku user service with shell privileges. It reads live task IDs, computes an unbounded virtual horizontal strip, requests task bounds through IActivityTaskManager, and attempts edge parking. It checks the actual bounds after each request and reports rejected or clamped moves. Android / One UI may reject this entirely. This is **not yet validated on a real tablet**. Samsung DeX One UI 8 may minimize tasks beyond five. Privileged action is opt-in.

## Honest platform limits

`ActivityOptions.setLaunchBounds` supplies **new launch bounds**, not live task resizing. Android/One UI may ignore those hints. Privileged IActivityTaskManager control is experimental and not device-verified. Global three-finger gestures are not implemented. Those are concepts in the web prototype, not shipping features.

## Signing

CI builds are intentionally **debug-signed prereleases**, installable for personal testing. Every fresh runner generates its own signing certificate, so installing an update over a prior build can fail; uninstalling the old build may be required. For reliable upgrades, configure a stable **private** signing keystore in GitHub Actions secrets. Do not commit signing keys to this public repository.
