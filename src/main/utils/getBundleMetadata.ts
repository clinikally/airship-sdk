import { API_BASE_URL, API_PATHS } from '../constants/apiConstants';

export interface IBundleMetadata {
  id: string;
  version: string;
  versionNumber: number;
  platform: string;
  environment: string;
  bundleHash: string;
  releaseNotes: string;
}

export const getBundleMetadata = async (
  bundleHash: string
): Promise<IBundleMetadata | null> => {
  try {
    const response = await fetch(API_BASE_URL + API_PATHS.GET_BUNDLE_METADATA, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bundleHash }),
    });

    if (!response.ok) {
      console.warn(
        `Failed to fetch bundle metadata: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data: IBundleMetadata = await response.json();
    return data;
  } catch (error) {
    console.warn('Error fetching bundle metadata:', error);
    return null;
  }
};
