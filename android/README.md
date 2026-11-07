# 一飛通 eSIM Android App（APK）

> **舊版（只有網頁 App）。** 從 2026-11-07 起，自用 APK 改用內建 USB 讀卡機功能的版本（EasyEUICC 修改版，GPL v3），
> 原始碼在本機 `~/Developer/firstroamlink-esim-android`（`firstroamlink` 分支），說明見該專案的 `FIRSTROAMLINK.md`。
> 兩者套件名稱、簽章相同，新版可直接覆蓋這版。

用 Trusted Web Activity（Chrome 全螢幕）開啟 `https://firstesim.space/app`，App 內容就是網站的 `/app`，改網站即可更新畫面，不必重新發 APK。

- 套件名稱：`space.firstesim.app`
- 網站驗證：`public/.well-known/assetlinks.json`（指紋需和簽章金鑰一致，否則 App 上方會出現網址列）

## 簽章金鑰（不要遺失）

金鑰在專案外：`~/.firstroamlink-android/release.jks`，密碼在同資料夾的 `keystore.properties`。
遺失金鑰就無法再發布同一個 App 的更新，請備份這兩個檔案，**不要上傳到 GitHub**。

## 重新打包

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android
./gradlew assembleRelease
```

輸出：`android/app/build/outputs/apk/release/app-release.apk`。發新版時記得把 `app/build.gradle.kts` 的 `versionCode` 加 1。
