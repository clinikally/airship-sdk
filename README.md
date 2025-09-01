# Airship SDK

Self-hosted OTA (Over-The-Air) updates SDK for React Native applications.

[![npm Version](https://img.shields.io/npm/v/@clinikally/airship-sdk.svg)](https://www.npmjs.com/package/@clinikally/airship-sdk)  
[![License](https://img.shields.io/npm/l/@clinikally/airship-sdk.svg)](https://www.npmjs.com/package/@clinikally/airship-sdk)

## Features

- 🚀 **Simple Integration** - Just wrap your app component
- 📱 **Platform-Native Configuration** - Uses Info.plist (iOS) and strings.xml (Android)
- 🔄 **Automatic Updates** - Background download and installation
- 🛡️ **Rollback Support** - Automatic error recovery
- 📦 **Self-Hosted** - Complete control over your update infrastructure

## Quick Start

### 1. Installation

```bash
npm install @clinikally/airship-sdk
```

### 2. Configuration

**iOS** - Add to `ios/YourApp/Info.plist`:
```xml
<key>AirshipProjectId</key>
<string>your-project-id</string>
<key>AirshipEnvironment</key>
<string>production</string>
```

**Android** - Add to `android/app/src/main/res/values/strings.xml`:
```xml
<string name="AirshipProjectId">your-project-id</string>
<string name="AirshipEnvironment">production</string>
```

### 3. Wrap Your App

```javascript
import { withStallion } from '@clinikally/airship-sdk';

function App() {
  // Your app code
}

export default withStallion(App);
```

## Documentation

📖 **[Complete Integration Guide](./INTEGRATION.md)**

## Requirements

- React Native 0.60+
- iOS 11.0+
- Android API 21+

## License

MIT License - see [LICENSE](./LICENSE) file for details.