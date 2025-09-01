package com.stallion.networkmanager;

import android.util.Log;
import com.stallion.events.StallionEventManager;
import com.stallion.storage.StallionConfigConstants;
import com.stallion.storage.StallionMetaConstants;
import com.stallion.storage.StallionStateManager;
import com.stallion.storage.StallionConfig;
import com.stallion.utils.StallionSlotManager;
import com.stallion.events.StallionEventConstants.NativeProdEventTypes;

import org.json.JSONObject;
import java.util.concurrent.atomic.AtomicBoolean;

public class StallionSyncHandler {

  private static final String TAG = "StallionSyncHandler";
  private static final AtomicBoolean isSyncInProgress = new AtomicBoolean(false);
  private static final AtomicBoolean isDownloadInProgress = new AtomicBoolean(false);

  public static void sync() {
    // Ensure only one sync job runs at a time
    if (!isSyncInProgress.compareAndSet(false, true)) {
      return; // Exit if another job is already running
    }

    new Thread(() -> {
      try {
        // Fetch StallionStateManager and StallionConfig
        StallionStateManager stateManager = StallionStateManager.getInstance();
        StallionConfig config = stateManager.getStallionConfig();

        // Use appVersion directly from StallionConfig
        String appVersion = config.getAppVersion();
        String projectId = config.getProjectId();
        String appliedBundleHash = stateManager.stallionMeta.getActiveReleaseHash();

        // Prepare payload for API call
        JSONObject requestPayload = new JSONObject();
        requestPayload.put("appVersion", appVersion);
        requestPayload.put("platform", "android");
        requestPayload.put("projectId", projectId);
        requestPayload.put("appliedBundleHash", appliedBundleHash);

        // Make API call using StallionApiManager
        JSONObject releaseMeta = StallionApiManager.post(
          StallionApiConstants.STALLION_API_BASE + StallionApiConstants.STALLION_INFO_API_PATH,
          requestPayload.toString()
        );

        // Process API response
        processReleaseMeta(releaseMeta, appVersion);

      } catch (Exception e) {
        emitSyncError(e);
      } finally {
        // Reset the flag to allow new jobs
        isSyncInProgress.set(false);
      }
    }).start();
  }
  private static void processReleaseMeta(JSONObject releaseMeta, String appVersion) {
    Log.d(TAG, "🔄 Processing release meta for app version: " + appVersion);
    
    // Handle the current API response format from your server
    // The server returns: { updateAvailable: true, releaseHash: "...", downloadUrl: "...", ... }
    // instead of the expected: { success: true, data: { appliedBundleData: {...}, newBundleData: {...} } }
    
    boolean updateAvailable = releaseMeta.optBoolean("updateAvailable", false);
    Log.d(TAG, "📦 Update available: " + updateAvailable);
    
    if (updateAvailable) {
      // Convert current response format to expected format
      JSONObject newBundleData = new JSONObject();
      try {
        // Map your server's fields to what the existing code expects
        String downloadUrl = releaseMeta.optString("downloadUrl");
        String releaseHash = releaseMeta.optString("releaseHash");
        String targetAppVersion = releaseMeta.optString("targetAppVersion");
        long bundleSize = releaseMeta.optLong("bundleSize", 0);
        
        Log.d(TAG, "🔗 Download URL: " + downloadUrl);
        Log.d(TAG, "🔐 Release Hash: " + releaseHash);
        Log.d(TAG, "🎯 Target App Version: " + targetAppVersion);
        Log.d(TAG, "📏 Bundle Size: " + bundleSize + " bytes");
        
        newBundleData.put("downloadUrl", downloadUrl);
        newBundleData.put("checksum", releaseHash); // Your server uses "releaseHash", code expects "checksum"
        newBundleData.put("targetAppVersion", targetAppVersion);
        newBundleData.put("bundleSize", bundleSize); // Pass bundle size from API
        
        // Create appliedBundleData with default values (since your server doesn't provide this)
        JSONObject appliedBundleData = new JSONObject();
        appliedBundleData.put("isRolledBack", false); // Default to not rolled back
        appliedBundleData.put("targetAppVersion", appVersion);
        
        Log.d(TAG, "✅ Successfully adapted API response format");
        
        // Process using existing handlers
        handleAppliedReleaseData(appliedBundleData, appVersion);
        handleNewReleaseData(newBundleData);
        
      } catch (Exception e) {
        // If there's an error creating the adapted response, emit sync error
        Log.e(TAG, "❌ Failed to parse API response: " + e.getMessage());
        emitSyncError(new Exception("Failed to parse API response: " + e.getMessage()));
      }
    } else {
      Log.d(TAG, "📋 No update available, trying fallback format");
      // Fallback: try the original format for backwards compatibility
      if (releaseMeta.optBoolean("success")) {
        JSONObject data = releaseMeta.optJSONObject("data");
        if (data == null) {
          Log.d(TAG, "⚠️ No data object in response");
          return;
        }

        handleAppliedReleaseData(data.optJSONObject("appliedBundleData"), appVersion);
        handleNewReleaseData(data.optJSONObject("newBundleData"));
      } else {
        Log.d(TAG, "⚠️ No success field or updateAvailable field in response");
      }
    }
  }

  private static void handleAppliedReleaseData(JSONObject appliedData, String appVersion) {
    if (appliedData == null) return;

    boolean isRolledBack = appliedData.optBoolean("isRolledBack");
    String targetAppVersion = appliedData.optString("targetAppVersion");
    if (isRolledBack && appVersion.equals(targetAppVersion)) {
      StallionSlotManager.rollbackProd(false, "");
    }
  }

  private static void handleNewReleaseData(JSONObject newReleaseData) {
    if (newReleaseData == null) {
      Log.d(TAG, "⚠️ No new release data provided");
      return;
    }

    String newReleaseUrl = newReleaseData.optString("downloadUrl");
    String newReleaseHash = newReleaseData.optString("checksum");
    long bundleSize = newReleaseData.optLong("bundleSize", 0);

    Log.d(TAG, "📋 Handling new release data:");
    Log.d(TAG, "   URL: " + newReleaseUrl);
    Log.d(TAG, "   Hash: " + newReleaseHash);
    Log.d(TAG, "   Bundle Size: " + bundleSize + " bytes");

    StallionStateManager stateManager = StallionStateManager.getInstance();
    String lastRolledBackHash = stateManager.stallionMeta.getLastRolledBackHash();
    Log.d(TAG, "   Last rolled back hash: " + lastRolledBackHash);

    if (
        !newReleaseHash.isEmpty()
        && !newReleaseUrl.isEmpty()
        && !newReleaseHash.equals(lastRolledBackHash)
    ) {
      if(stateManager.getIsMounted()) {
        Log.d(TAG, "🚀 App is mounted, starting download immediately");
        downloadNewRelease(newReleaseHash, newReleaseUrl, bundleSize);
      } else {
        Log.d(TAG, "⏳ App not mounted, setting pending release");
        stateManager.setPendingRelease(newReleaseUrl, newReleaseHash);
      }
    } else {
      Log.d(TAG, "⏭️ Skipping download - hash empty, URL empty, or already rolled back");
    }
  }

  public static void downloadNewRelease(String newReleaseHash, String newReleaseUrl, long bundleSize) {
    // Ensure only one download job runs at a time
    if (!isDownloadInProgress.compareAndSet(false, true)) {
      return; // Exit if another job is already running
    }
    try {
      StallionStateManager stateManager = StallionStateManager.getInstance();
      StallionConfig config = stateManager.getStallionConfig();
      String downloadPath = config.getFilesDirectory()
        + StallionConfigConstants.PROD_DIRECTORY
        + StallionConfigConstants.TEMP_FOLDER_SLOT;
      String projectId = config.getProjectId();
      // Use the downloadUrl directly - it's already a complete presigned S3 URL
      String downloadUrl = newReleaseUrl;
      Log.d(TAG, "🔗 Using complete presigned URL directly: " + downloadUrl);
      Log.d(TAG, "📏 Bundle size from API: " + bundleSize + " bytes");

      long alreadyDownloaded = StallionDownloadCacheManager.getDownloadCache(config, downloadUrl, downloadPath);

      emitDownloadStarted(newReleaseHash, alreadyDownloaded > 0);

      // Use bundle size if available, otherwise fallback to original method
      if (bundleSize > 0) {
        Log.d(TAG, "📦 Using known bundle size for download");
        StallionFileDownloader.downloadBundleWithSize(
          downloadUrl,
          downloadPath,
          alreadyDownloaded,
          bundleSize,
        new StallionDownloadCallback() {
          @Override
          public void onReject(String prefix, String error) {
            isDownloadInProgress.set(false);
            emitDownloadError(newReleaseHash, prefix + error);
          }

          @Override
          public void onSuccess(String successPayload) {
            isDownloadInProgress.set(false);
            stateManager.stallionMeta.setCurrentProdSlot(StallionMetaConstants.SlotStates.NEW_SLOT);
            stateManager.stallionMeta.setProdTempHash(newReleaseHash);
            String currentProdNewHash = stateManager.stallionMeta.getProdNewHash();
            if(currentProdNewHash != null && !currentProdNewHash.isEmpty()) {
              StallionSlotManager.stabilizeProd();
            }
            stateManager.syncStallionMeta();
            StallionDownloadCacheManager.deleteDownloadCache(downloadPath);
            emitDownloadSuccess(newReleaseHash);
          }

          @Override
          public void onProgress(double downloadFraction) {
            // Optional: Handle progress updates
          }
        }
      );
      } else {
        Log.d(TAG, "📦 No bundle size available, using original download method with HEAD request");
        StallionFileDownloader.downloadBundle(
          downloadUrl,
          downloadPath,
          alreadyDownloaded,
          new StallionDownloadCallback() {
            @Override
            public void onReject(String prefix, String error) {
              isDownloadInProgress.set(false);
              emitDownloadError(newReleaseHash, prefix + error);
            }

            @Override
            public void onSuccess(String successPayload) {
              isDownloadInProgress.set(false);
              stateManager.stallionMeta.setCurrentProdSlot(StallionMetaConstants.SlotStates.NEW_SLOT);
              stateManager.stallionMeta.setProdTempHash(newReleaseHash);
              String currentProdNewHash = stateManager.stallionMeta.getProdNewHash();
              if(currentProdNewHash != null && !currentProdNewHash.isEmpty()) {
                StallionSlotManager.stabilizeProd();
              }
              stateManager.syncStallionMeta();
              StallionDownloadCacheManager.deleteDownloadCache(downloadPath);
              emitDownloadSuccess(newReleaseHash);
            }

            @Override
            public void onProgress(double downloadFraction) {
              // Optional: Handle progress updates
            }
          }
        );
      }
    } catch (Exception ignored) {
      isDownloadInProgress.set(false);
    }
  }

  private static void emitSyncError(Exception e) {
    JSONObject syncErrorPayload = new JSONObject();
    try {
      String syncErrorString = e.getMessage() != null ? e.getMessage() : "Unknown error";
      syncErrorPayload.put("meta", syncErrorString);
    } catch (Exception ignored) { }
    StallionEventManager.getInstance().sendEvent(
      NativeProdEventTypes.SYNC_ERROR_PROD.toString(),
      syncErrorPayload
    );
  }

  private static void emitDownloadError(String releaseHash, String error) {
    JSONObject errorPayload = new JSONObject();
    try {
      errorPayload.put("releaseHash", releaseHash);
      errorPayload.put("meta", error);
    } catch (Exception ignored) { }
    StallionEventManager.getInstance().sendEvent(
      NativeProdEventTypes.DOWNLOAD_ERROR_PROD.toString(),
      errorPayload
    );
  }

  private static void emitDownloadSuccess(String releaseHash) {
    JSONObject successPayload = new JSONObject();
    try {
      successPayload.put("releaseHash", releaseHash);
    } catch (Exception ignored) { }
    StallionEventManager.getInstance().sendEvent(
      NativeProdEventTypes.DOWNLOAD_COMPLETE_PROD.toString(),
      successPayload
    );
  }

  private static void emitDownloadStarted(String releaseHash, Boolean isResume) {
    JSONObject successPayload = new JSONObject();
    try {
      successPayload.put("releaseHash", releaseHash);
    } catch (Exception ignored) { }
    StallionEventManager.getInstance().sendEvent(
      isResume ? NativeProdEventTypes.DOWNLOAD_RESUME_PROD.toString(): NativeProdEventTypes.DOWNLOAD_STARTED_PROD.toString(),
      successPayload
    );
  }
}
