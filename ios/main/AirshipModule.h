//
//  AirshipModule.h
//  react-native-stallion (renamed to Airship)
//
//  Created by Clinikally-DevOps
//

#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>

@interface AirshipModule : NSObject <RCTBridgeModule>

+ (NSURL *)getBundleURL;
+ (NSURL *)getBundleURL:(NSURL *)defaultBundlePath;

@end