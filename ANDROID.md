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

The experimental Android 16 bridge runs as a Shizuku user service with shell privileges. It reads desktop task IDs and computes a virtual horizontal strip while keeping requested windows inside the display. Windows outside the current strip viewport stack behind the selected windows; persistent HUD arrows bring them back into view. The bridge reconnects after an app restart only if Shizuku permission has already been granted. It checks actual bounds after each request, reanchors windows enlarged by OEM minimum sizes, and reports rejected or clamped moves. Android / One UI may reject moves. Samsung DeX One UI 8 may minimize tasks beyond five. Privileged action is opt-in.

## Honest platform limits

New launches request the leftmost free horizontal space based on accessibility-visible windows, or the least overlapping position if the screen is full. Enable accessibility for this placement hint to account for existing windows. Reopening a visible app preserves its observed bounds. This does not automatically rearrange other windows; use the Shizuku strip controls for that.

`ActivityOptions.setLaunchBounds` supplies **new launch bounds**, not live task resizing. Android/One UI may ignore those hints. Privileged IActivityTaskManager control is experimental and OEM-dependent. Global three-finger gestures are not implemented. Those are concepts in the web prototype, not shipping features.

### Device verification (v0.2.2, 24 October 2026)

On SM-X230, verified six desktop tasks (including separate Google and Gemini tasks): navigation from Home after fullscreen, restoring minimized tasks, left/right navigation, and wrapping from the last task to the first. Actual bounds stayed within the 1920 × 1200 display during these checks. Eight local unit tests passed. This confirms the tested workflow on this device, not support for all One UI versions.

A separate offscreen experiment requested a window starting at x=1920. One UI clamped it to x=1857, leaving 63 pixels visible. Fullscreen followed by Home did not remove that clamp in this test. The shipped layout therefore keeps actual windows inside the display and brings the selected pair forward. Shizuku bridge replacements use its reserved destroy transaction so outdated service processes can exit.

## Signing

CI builds are intentionally **debug-signed prereleases**, installable for personal testing. Every fresh runner generates its own signing certificate, so installing an update over a prior build can fail; uninstalling the old build may be required. For reliable upgrades, configure a stable **private** signing keystore in GitHub Actions secrets. Do not commit signing keys to this public repository.
