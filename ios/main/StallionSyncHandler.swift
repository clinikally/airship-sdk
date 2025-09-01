//
//  StallionSyncHandler.swift
//  react-native-stallion
//
//  Created by Jasbir Singh Shergill on 29/01/25.
//

import Foundation

class StallionSyncHandler {

    private static var isSyncInProgress = false
    private static var isDownloadInProgress = false
    private static let syncQueue = DispatchQueue(label: "com.stallion.syncQueue")

    static func sync() {
        var shouldProceed = false

        syncQueue.sync {
            if !isSyncInProgress {
                isSyncInProgress = true
                shouldProceed = true
            }
        }

        guard shouldProceed else { 
            print("⚠️ Sync already in progress - skipping")
            return 
        }
        
        print("🚀 StallionSyncHandler.sync() started")
        
        // Send debug event to JavaScript
        let debugPayload: NSDictionary = ["message": "Native sync started"]
        Stallion.sendEventToRn(eventName: "SYNC_DEBUG", eventBody: debugPayload, shouldCache: false)

          DispatchQueue.global().async {
              do {
                  // Fetch StallionStateManager and StallionConfig
                  let stateManager = StallionStateManager.sharedInstance()
                  guard let config = stateManager?.stallionConfig else {
                      completeSync()
                      return
                  }

                  // Use appVersion directly from StallionConfig
                  let appVersion = config.appVersion ?? ""
                  let projectId = config.projectId ?? ""
                  let uid = config.uid ?? ""
                  let appliedBundleHash = stateManager?.stallionMeta?.getActiveReleaseHash() ?? ""

                  // Get environment from config via Info.plist
                  let environment = config.environment ?? "prod"
                  
                  // Prepare payload for API call
                  let requestPayload: [String: Any] = [
                      "appVersion": appVersion,
                      "platform": StallionConstants.PlatformValue,
                      "projectId": projectId,
                      "currentEnvironment": environment,
                      "appliedBundleHash": appliedBundleHash // Will be empty on first launch
                  ]

                  // Make API call using URLSession
                  makeApiCall(payload: requestPayload, appVersion: appVersion)

              } catch {
                  completeSync()
                  emitSyncError(error)
              }
          }
      }

      private static func makeApiCall(payload: [String: Any], appVersion: String) {
          guard let url = URL(string: StallionConstants.STALLION_API_BASE + StallionConstants.STALLION_INFO_API_PATH) else {
              emitSyncError(NSError(domain: "Invalid URL", code: -1))
              return
          }

          var request = URLRequest(url: url)
          request.httpMethod = "POST"
          request.setValue("application/json", forHTTPHeaderField: "Content-Type")

          // No authentication headers needed - API is public

          // Convert payload to JSON
          do {
              let jsonData = try JSONSerialization.data(withJSONObject: payload, options: [])
              request.httpBody = jsonData
          } catch {
              completeSync()
              emitSyncError(error)
              return
          }

          let task = URLSession.shared.dataTask(with: request) { data, response, error in
              if let error = error {
                  completeSync()
                  emitSyncError(error)
                  return
              }
            
              guard let data = data, let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                  completeSync()
                  let responseError = NSError(domain: "Invalid response from server", code: -2)
                  emitSyncError(responseError)
                  return
              }

              // Parse the JSON response
              print("📡 Raw API response data: \(String(data: data, encoding: .utf8) ?? "Unable to decode")")
              
              do {
                  if let releaseMeta = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                      print("✅ JSON parsed successfully: \(releaseMeta)")
                      
                      // Send debug event to JavaScript
                      let debugPayload: NSDictionary = ["message": "JSON parsed successfully", "updateAvailable": releaseMeta["updateAvailable"] ?? false]
                      Stallion.sendEventToRn(eventName: "SYNC_DEBUG", eventBody: debugPayload, shouldCache: false)
                      
                      completeSync()
                      processReleaseMeta(releaseMeta, appVersion: appVersion)
                  } else {
                      print("❌ Failed to parse JSON response")
                      completeSync()
                      let parsingError = NSError(domain: "Invalid JSON format", code: -3)
                      emitSyncError(parsingError)
                  }
              } catch {
                  print("❌ JSON parsing error: \(error)")
                  completeSync()
                  emitSyncError(error)
              }
          }

          task.resume()
      }
    
    private static func completeSync() {
        syncQueue.sync {
            isSyncInProgress = false
        }
    }
  
    private static func processReleaseMeta(_ releaseMeta: [String: Any], appVersion: String) {
        print("🔍 Processing release meta: \(releaseMeta)")
        
        // Check if update is available
        guard let updateAvailable = releaseMeta["updateAvailable"] as? Bool, updateAvailable else { 
            print("❌ No update available or updateAvailable key missing")
            return 
        }
        
        print("✅ Update available! Processing new release data...")
        // Process the release data directly from our API format
        handleNewReleaseData(releaseMeta)
    }

    private static func handleAppliedReleaseData(_ appliedData: [String: Any], appVersion: String) {
        guard let isRolledBack = appliedData["isRolledBack"] as? Bool,
              let targetAppVersion = appliedData["targetAppVersion"] as? String else { return }

        if isRolledBack && appVersion == targetAppVersion {
          StallionSlotManager.rollbackProd(withAutoRollback: false, errorString: "")
        }
    }

    private static func handleNewReleaseData(_ newReleaseData: [String: Any]) {
        print("🔍 Processing new release data: \(newReleaseData)")
        
        // Try our API format first
        var newReleaseUrl = newReleaseData["downloadUrl"] as? String
        var newReleaseHash = newReleaseData["releaseHash"] as? String
        
        // Fallback to legacy format
        if newReleaseHash == nil {
            newReleaseHash = newReleaseData["checksum"] as? String
        }
        
        guard let url = newReleaseUrl, let hash = newReleaseHash,
              !url.isEmpty, !hash.isEmpty else { 
            print("❌ Missing downloadUrl or release hash")
            print("downloadUrl: \(newReleaseData["downloadUrl"] ?? "nil")")
            print("releaseHash: \(newReleaseData["releaseHash"] ?? "nil")")
            print("checksum: \(newReleaseData["checksum"] ?? "nil")")
            return 
        }
        
        // Use the validated values
        let finalUrl = url
        let finalHash = hash
        
        print("✅ Found valid release data - URL: \(finalUrl)")
        print("✅ Release hash: \(finalHash)")

        let stateManager = StallionStateManager.sharedInstance()
        let lastRolledBackHash = stateManager?.stallionMeta?.lastRolledBackHash ?? ""

        if finalHash != lastRolledBackHash {
            if stateManager?.isMounted == true {
                print("✅ State manager is mounted - starting download...")
                downloadNewRelease(newReleaseHash: finalHash, newReleaseUrl: finalUrl)
            } else {
                print("⏳ State manager not mounted - storing pending release...")
                stateManager?.pendingReleaseUrl = finalUrl
                stateManager?.pendingReleaseHash = finalHash
            }
        } else {
            print("⚠️ Release hash matches last rolled back hash - skipping download")
        }
    }

    static func downloadNewRelease(newReleaseHash: String, newReleaseUrl: String) {
        print("🚀 Starting download for release hash: \(newReleaseHash)")
        print("🚀 Download URL: \(newReleaseUrl)")
        
        guard let stateManager = StallionStateManager.sharedInstance(),
              let config = stateManager.stallionConfig else { 
            print("❌ Failed to get state manager or config")
            return 
        }
      
        var shouldDownload = false
        syncQueue.sync {
            if !isDownloadInProgress {
                isDownloadInProgress = true
                shouldDownload = true
            }
        }
        guard shouldDownload else { return }

      let downloadPath = config.filesDirectory + "/" + StallionConstants.PROD_DIRECTORY + "/" + StallionConstants.TEMP_FOLDER_SLOT
      let projectId = config.projectId ?? ""
      
      // Use the download URL directly - it's already a complete presigned S3 URL
      guard let fromUrl = URL(string: newReleaseUrl) else { 
          print("❌ Invalid download URL: \(newReleaseUrl)")
          return 
      }
      
      print("✅ Using download URL: \(fromUrl)")

      emitDownloadStarted(releaseHash: newReleaseHash)

      StallionFileDownloader().downloadBundle(url: fromUrl, downloadDirectory: downloadPath, onProgress: { progress in
        // Handle progress updates if necessary
    }, resolve: { _ in
        completeDownload()
      stateManager.stallionMeta?.currentProdSlot =  SlotStates.newSlot
      stateManager.stallionMeta?.prodTempHash =  newReleaseHash
      if let currentProdNewHash = stateManager.stallionMeta?.prodNewHash,
         !currentProdNewHash.isEmpty {
          StallionSlotManager.stabilizeProd()
      }
      stateManager.syncStallionMeta()
      emitDownloadSuccess(releaseHash: newReleaseHash)
    }, reject: { code, prefix, error  in
        completeDownload()
      emitDownloadError(
        releaseHash: newReleaseHash,
        error: "\(String(describing: prefix))\(String(describing: error))"
      )
    })
  }
    
    private static func completeDownload() {
        syncQueue.sync {
            isDownloadInProgress = false
        }
    }

    // MARK: - Event Emission

    private static func emitSyncError(_ error: Error) {
      let syncErrorPayload: NSDictionary = ["meta": error.localizedDescription]
      Stallion.sendEventToRn(eventName: StallionConstants.NativeEventTypesProd.SYNC_ERROR_PROD,
                             eventBody: syncErrorPayload,
                             shouldCache: true
      )
    }

    private static func emitDownloadError(releaseHash: String, error: String) {
        let errorPayload: NSDictionary = [
            "releaseHash": releaseHash,
            "meta": error
        ]
      Stallion.sendEventToRn(eventName: StallionConstants.NativeEventTypesProd.DOWNLOAD_ERROR_PROD,
                             eventBody: errorPayload,
                             shouldCache: true
      )
    }

    private static func emitDownloadSuccess(releaseHash: String) {
      let successPayload: NSDictionary = ["releaseHash": releaseHash]
      Stallion.sendEventToRn(eventName: StallionConstants.NativeEventTypesProd.DOWNLOAD_COMPLETE_PROD,
                             eventBody: successPayload,
                             shouldCache: true
      )
    }

    private static func emitDownloadStarted(releaseHash: String) {
        let startedPayload: NSDictionary = ["releaseHash": releaseHash]
        Stallion.sendEventToRn(eventName: StallionConstants.NativeEventTypesProd.DOWNLOAD_STARTED_PROD,
                             eventBody: startedPayload,
                             shouldCache: true
      )
    }
}

