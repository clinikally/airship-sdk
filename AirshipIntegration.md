# Airship SDK Integration Guide

This guide provides step-by-step instructions for integrating the Airship SDK into your React Native project for both Android and iOS platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [iOS Integration](#ios-integration)
- [Android Integration](#android-integration)
- [Basic Usage](#basic-usage)
- [Configuration](#configuration)
- [Publishing OTA Updates](#publishing-ota-updates)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Prerequisites

Before integrating the Airship SDK, ensure your development environment meets these requirements:

- **Node.js**: >= 16.0.0
- **React Native**: >= 0.70.0 (tested up to 0.79.0)
- **React**: >= 18.0.0 (tested with React 19.0.0)
- **iOS**: Xcode 14+ with iOS 12+
- **Android**: Android SDK with API Level 21+
- **Airship CLI**: Install globally with `npm install -g @clinikally/airship-cli`

## Installation

Install the Airship SDK in your React Native project:

```bash
npm install @clinikally/airship-sdk
# or
yarn add @clinikally/airship-sdk
```

## iOS Integration

### Step 1: Install iOS Dependencies

Navigate to your iOS directory and install pods:

```bash
cd ios
pod install
cd ..
```

### Step 2: Configure Info.plist

Add the following keys to your `ios/YourApp/Info.plist` file:

```xml
<key>StallionProjectId</key>
<string>your-project-id</string>
```

### Step 3: Enable Hermes (Recommended)

In your `ios/YourApp.xcodeproj/project.pbxproj`, ensure Hermes is enabled:

```
USE_HERMES = true;
```

### Step 4: Update AppDelegate

#### For Swift AppDelegate (AppDelegate.swift):

```swift
import UIKit
import React

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // Initialize React Native
    let bridge = RCTBridge(delegate: self, launchOptions: launchOptions)!
    let rootView = RCTRootView(bridge: bridge, moduleName: "YourAppName", initialProperties: nil)
    
    if #available(iOS 13.0, *) {
      rootView.backgroundColor = UIColor.systemBackground
    } else {
      rootView.backgroundColor = UIColor.white
    }

    self.window = UIWindow(frame: UIScreen.main.bounds)
    let rootViewController = UIViewController()
    rootViewController.view = rootView
    self.window?.rootViewController = rootViewController
    self.window?.makeKeyAndVisible()
    
    return true
  }

  func application(_ application: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    return RCTLinkingManager.open(url, options: options)
  }

  func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return RCTLinkingManager.continue(userActivity, restorationHandler: restorationHandler)
  }
}

extension AppDelegate: RCTBridgeDelegate {
  func sourceURL(for bridge: RCTBridge!) -> URL! {
    return self.bundleURL()
  }

  func bundleURL() -> URL? {
    #if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
```

### Step 5: Configure Build Settings

Ensure your iOS project has the correct build settings:

1. **Header Search Paths**: Add `"$(SRCROOT)/../node_modules/@clinikally/airship-sdk/ios/main"`
2. **Framework Search Paths**: Include React Native frameworks path
3. **Other Linker Flags**: Ensure `-ObjC` is included

## Android Integration

### Step 1: Update MainActivity

In `android/app/src/main/java/.../MainActivity.java`:

```java
package com.yourapp;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

public class MainActivity extends ReactActivity {

  @Override
  protected String getMainComponentName() {
    return "YourAppName";
  }

  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        DefaultNewArchitectureEntryPoint.getFabricEnabled());
  }
}
```

### Step 2: Update MainApplication

In `android/app/src/main/java/.../MainApplication.java`:

```java
package com.yourapp;

import android.app.Application;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactHost;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.soloader.SoLoader;
import java.util.List;

// Import Airship SDK
import com.stallion.StallionPackage;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost =
      new DefaultReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          List<ReactPackage> packages = new PackageList(this).getPackages();
          // Add Airship SDK package
          packages.add(new StallionPackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }

        @Override
        protected boolean isNewArchEnabled() {
          return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        }

        @Override
        protected Boolean isHermesEnabled() {
          return BuildConfig.IS_HERMES_ENABLED;
        }
      };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public ReactHost getReactHost() {
    return DefaultReactHost.getDefaultReactHost(getApplicationContext(), getReactNativeHost());
  }

  @Override
  public void onCreate() {
    super.onCreate();
    SoLoader.init(this, false);
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      DefaultNewArchitectureEntryPoint.load();
    }
  }
}
```

### Step 3: Configure Android Manifest

Add the following to your `android/app/src/main/AndroidManifest.xml`:

```xml
<application
    android:name=".MainApplication"
    android:allowBackup="false"
    android:theme="@style/AppTheme">
    
    <!-- Add Airship configuration -->
    <meta-data
        android:name="STALLION_PROJECT_ID"
        android:value="your-project-id" />
    <meta-data
        android:name="STALLION_APP_TOKEN"
        android:value="your-app-token" />
    <meta-data
        android:name="STALLION_APP_VERSION"
        android:value="${versionName}" />
        
    <!-- Your existing activity configuration -->
    <activity
        android:name=".MainActivity"
        android:exported="true"
        android:launchMode="singleTop"
        android:theme="@style/LaunchTheme">
        <!-- ... -->
    </activity>
</application>
```

### Step 4: Update Build Configuration

In `android/app/build.gradle`, ensure you have:

```gradle
android {
    compileSdk 34

    defaultConfig {
        applicationId "com.yourapp"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Your release configuration
            signingConfig signingConfigs.release
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

## Basic Usage

### Step 1: Wrap Your App with Airship SDK

In your main `App.tsx` or `App.js` file:

```typescript
import React from 'react';
import { withStallion } from '@clinikally/airship-sdk';
import YourMainComponent from './src/YourMainComponent';

function App(): React.JSX.Element {
  return <YourMainComponent />;
}

const AppWithAirship = withStallion(App, {
  projectId: 'your-project-id',
  environment: 'prod', // or 'stage'
  debugMode: __DEV__,
});

export default AppWithAirship;
```

### Step 2: Using Airship Hooks

```typescript
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useStallionUpdate } from '@clinikally/airship-sdk';

function UpdateComponent() {
  const { checkForUpdates, downloadUpdate, installUpdate, updateAvailable } = useStallionUpdate();

  const handleCheckUpdates = async () => {
    try {
      const hasUpdate = await checkForUpdates();
      if (hasUpdate) {
        console.log('Update available!');
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

  const handleDownloadAndInstall = async () => {
    try {
      if (updateAvailable) {
        await downloadUpdate();
        await installUpdate();
      }
    } catch (error) {
      console.error('Failed to update:', error);
    }
  };

  return (
    <View>
      <Text>Update Status: {updateAvailable ? 'Available' : 'Up to date'}</Text>
      <Button title="Check for Updates" onPress={handleCheckUpdates} />
      {updateAvailable && (
        <Button title="Download & Install" onPress={handleDownloadAndInstall} />
      )}
    </View>
  );
}
```

## Configuration

### Environment Variables

Create a `.env` file in your project root (optional):

```bash
# Airship Configuration
AIRSHIP_API_BASE_URL=https://your-airship-server.com
AIRSHIP_PROJECT_ID=your-project-id
AIRSHIP_APP_TOKEN=your-app-token
```

### Advanced Configuration

```typescript
const AppWithAirship = withStallion(App, {
  projectId: 'your-project-id',
  environment: 'prod', // 'prod' | 'stage'
  debugMode: __DEV__,
  apiBaseUrl: 'https://your-custom-api.com', // Optional: Override API base URL
  autoCheckInterval: 30000, // Optional: Auto-check interval in ms
  enableCrashReporting: true, // Optional: Enable crash reporting
});
```

## Publishing OTA Updates

### Step 1: Install Airship CLI

```bash
npm install -g @clinikally/airship-cli
```

### Step 2: Login to Airship

```bash
airship login
```

### Step 3: Publish a Bundle

```bash
# For iOS
airship publish-bundle --upload-path=your-org/your-app/prod --platform=ios --release-note="Bug fixes and improvements"

# For Android  
airship publish-bundle --upload-path=your-org/your-app/prod --platform=android --release-note="Bug fixes and improvements"
```

### Step 4: Promote Bundle to Release

```bash
airship release-bundle --upload-path=your-org/your-app/prod --platform=ios --bundle-hash=<bundle-hash> --app-version=1.0.0
```

## Troubleshooting

### Common Issues

#### 1. "TypeError: undefined is not a function" on React Native 0.79+

**Solution**: Ensure you're using Airship SDK v1.2.2 or later:

```bash
npm install @clinikally/airship-sdk@^1.2.2
```

#### 2. iOS Build Errors

**Solutions**:
- Clean build folder: `Product → Clean Build Folder` in Xcode
- Delete `ios/Pods` and `ios/Podfile.lock`, then run `pod install`
- Ensure `USE_HERMES = true` in project settings
- Verify Info.plist has correct Airship configuration

#### 3. Android Build Errors

**Solutions**:
- Clean project: `cd android && ./gradlew clean && cd ..`
- Ensure `StallionPackage` is added to `MainApplication.java`
- Check Android manifest has correct meta-data
- Verify minimum SDK version is 21 or higher

#### 4. App Crashes on Startup

**Solutions**:
- Check that `withStallion` wrapper is properly configured
- Ensure project ID and app token are correctly set
- Verify React Native version compatibility
- Check native logs for detailed error messages

#### 5. OTA Updates Not Working

**Solutions**:
- Verify API base URL is accessible
- Check network permissions on Android
- Ensure app version matches the released bundle
- Verify bundle hash matches the published version

### Debug Mode

Enable debug mode to get detailed logs:

```typescript
const AppWithAirship = withStallion(App, {
  projectId: 'your-project-id',
  environment: 'prod',
  debugMode: true, // Enable debug logs
});
```

### Native Debugging

#### iOS Debugging

View native logs in Xcode console or using:

```bash
xcrun simctl spawn booted log show --predicate 'process == "YourAppName"'
```

#### Android Debugging

View native logs using:

```bash
adb logcat | grep -E "(Stallion|Airship)"
```

## API Reference

### withStallion

Higher-order component that wraps your app with Airship functionality.

```typescript
withStallion(Component: React.ComponentType, config: AirshipConfig)
```

**Config Options:**
- `projectId: string` - Your project identifier
- `environment: 'prod' | 'stage'` - Deployment environment
- `debugMode: boolean` - Enable debug logging
- `apiBaseUrl?: string` - Custom API base URL
- `autoCheckInterval?: number` - Auto-update check interval

### useStallionUpdate Hook

```typescript
const {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  updateAvailable,
  downloadProgress,
  isChecking,
  isDownloading,
} = useStallionUpdate();
```

**Methods:**
- `checkForUpdates(): Promise<boolean>` - Check if updates are available
- `downloadUpdate(): Promise<void>` - Download available update
- `installUpdate(): Promise<void>` - Install downloaded update

**State:**
- `updateAvailable: boolean` - Whether an update is available
- `downloadProgress: number` - Download progress (0-100)
- `isChecking: boolean` - Whether currently checking for updates
- `isDownloading: boolean` - Whether currently downloading

### Native Module Methods

Access native module directly:

```typescript
import { NativeModules } from 'react-native';
const { Stallion } = NativeModules;

// Get current configuration
const config = await Stallion.getStallionConfig();

// Force sync
await Stallion.sync();

// Restart app
await Stallion.restart();
```

## Support

For additional support:

- **Documentation**: [Airship Documentation](https://docs.clinikally.com)
- **Issues**: [GitHub Issues](https://github.com/clinikally/airship-sdk/issues)
- **Community**: [Discord Community](https://discord.gg/airship-sdk)

## License

This SDK is licensed under the MIT License. See [LICENSE](./LICENSE) for more information.