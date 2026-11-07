import java.util.Properties

plugins {
    id("com.android.application")
}

// 簽章金鑰放在專案外（~/.firstroamlink-android/keystore.properties），不進版本控制
val keystoreProperties = Properties().apply {
    val file = File(System.getProperty("user.home"), ".firstroamlink-android/keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "space.firstesim.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "space.firstesim.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("release") {
            if (keystoreProperties.isNotEmpty()) {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
