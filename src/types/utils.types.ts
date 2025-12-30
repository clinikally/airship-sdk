import { NativeSyntheticEvent, TextInputChangeEventData } from 'react-native';
import { IUpdateMeta } from './updateMeta.types';
import { IStallionMeta, SWITCH_STATES } from './meta.types';
import { IStallionConfigJson } from './config.types';

interface IBundleInfo {
  url: string;
  hash: string;
}

export interface IStallionInitParams {}

export type IWithStallion = (
  BaseComponent: React.ComponentType,
  initPrams?: IStallionInitParams
) => React.ComponentType;

export interface IStallionConfig {
  stallionEnabled: boolean;
  projectId: string;
}

export interface IUseStallionModal {
  showModal: () => void;
}

export type TextChangeEventType =
  NativeSyntheticEvent<TextInputChangeEventData>;

export type TSetSdkTokenNative = (sdkToken: string) => Promise<string>;

export type TGetStallionMetaNative = () => Promise<IStallionMeta>;

export type TGetStallionConfigNative = () => Promise<IStallionConfigJson>;

export type TToggleStallionSwitchNative = (
  switchState: SWITCH_STATES
) => Promise<string>;

export type TDownloadBundleNative = (
  bundleInfo: IBundleInfo
) => Promise<string>;

export type TOnLaunchBundleNative = (launchMessage: string) => void;

export interface IUseStallionUpdate {
  isRestartRequired: boolean;
  currentlyRunningBundle: IUpdateMeta | null;
  newReleaseBundle: IUpdateMeta | null;
}

export interface ISyncContextResponse {
  updateAvailable?: boolean;
  downloadUrl?: string;
  releaseHash?: string;
  version?: string;
  versionNumber?: number;
  environment?: string;
  releaseNotes?: string;
  bundleSize?: number;
  promotionId?: number;
  targetAppVersion?: string;
  isMandatory?: boolean;
  rolloutPercentage?: number;
  [key: string]: any; // Allow additional fields from API response
}

export interface ISyncContext {
  // Request payload
  appVersion?: string;
  platform?: string;
  projectId?: string;
  currentEnvironment?: string;
  appliedBundleHash?: string;

  // OTA API response
  response?: ISyncContextResponse;
}

export interface IUseSyncContext {
  syncContext: ISyncContext | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
