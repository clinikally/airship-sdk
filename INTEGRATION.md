# Airship SDK Integration Guide

A simple, platform-native OTA update solution for React Native apps.

## Installation

```bash
npm install @clinikally/airship-sdk
```

## Configuration

### 1. iOS Configuration

Add the following keys to your `ios/YourApp/Info.plist`:

```xml
<key>AirshipProjectId</key>
<string>your-project-id</string>
<key>AirshipEnvironment</key>
<string>your-environment</string>
```

### 2. Android Configuration

Add the following strings to your `android/app/src/main/res/values/strings.xml`:

```xml
<string name="AirshipProjectId">your-project-id</string>
<string name="AirshipEnvironment">your-environment</string>
```

### 3. App Integration

Wrap your root App component with the Airship SDK:

```javascript
import { withStallion } from '@clinikally/airship-sdk';

function App() {
  return (
    // Your app content
  );
}

// Export the wrapped component
export default withStallion(App);
```

## That's it! 🚀

Your app now supports OTA updates. The SDK will:

- Automatically read configuration from platform-native files
- Check for updates on app launch
- Download and apply updates in the background
- Handle rollbacks and error recovery

## Configuration Values

- **AirshipProjectId**: Your unique project identifier
- **AirshipEnvironment**: Environment for update targeting (e.g., `prod`, `staging`, `dev`)

## Events (Optional)

Listen to OTA events if needed:

```javascript
import { StallionEventEmitter } from '@clinikally/airship-sdk';

// Listen for download events
StallionEventEmitter.addListener('DOWNLOAD_STARTED_PROD', (data) => {
  console.log('Download started:', data);
});

StallionEventEmitter.addListener('DOWNLOAD_COMPLETE_PROD', (data) => {
  console.log('Download complete:', data);
});
```

## Platform Requirements

- **iOS**: Minimum deployment target iOS 11.0
- **Android**: Minimum API level 21 (Android 5.0)
- **React Native**: 0.60+