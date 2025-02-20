// src/shared/onboarding/types.ts

export interface OnboardingSetting {
    name: string;
    description: string;         // Used in chat context when discussing the setting
    usageDescription: string;    // Used during onboarding to guide users
    value: string | boolean | null;
    required: boolean;
    public?: boolean;           // If true, shown in public channels
    secret?: boolean;           // If true, value is masked and only shown during onboarding
    validation?: (value: any) => boolean;
    dependsOn?: string[];
    onSetAction?: (value: any) => string;
    visibleIf?: (settings: { [key: string]: OnboardingSetting }) => boolean;
}

export interface OnboardingState {
    [key: string]: OnboardingSetting;
}

export interface OnboardingConfig {
    settings: { 
        [key: string]: Omit<OnboardingSetting, 'value'>; 
    };
}

// Helper to format a setting value for display
export function formatSettingValue(setting: OnboardingSetting): string {
    if (!setting.value) return "Not configured";
    if (setting.secret) return "****************";
    return String(setting.value);
}

// Helper to format setting display for chat context
export function formatSettingDisplay(setting: OnboardingSetting): string {
    return `${setting.name} - ${setting.description}`;
}

// Helper to format setting for onboarding
export function formatSettingOnboarding(setting: OnboardingSetting): string {
    return `${setting.name} - ${setting.usageDescription}`;
}

// Filter settings for public display
export function getPublicSettings(settings: OnboardingState): OnboardingState {
    const publicSettings: OnboardingState = {};
    
    for (const [key, setting] of Object.entries(settings)) {
        if (setting.public) {
            publicSettings[key] = setting;
        }
    }
    
    return publicSettings;
}

// Format settings list for display
export function formatSettingsList(settings: OnboardingState, isOnboarding = false): string {
    // If not in onboarding mode, only show public settings
    const displaySettings = isOnboarding ? settings : getPublicSettings(settings);
    const { configured, requiredUnconfigured, optionalUnconfigured } = categorizeSettings(displaySettings);
    
    let list = "Current Settings Status:\n";

    const formatSetting = isOnboarding ? formatSettingOnboarding : formatSettingDisplay;

    if (configured.length > 0) {
        list += "\nConfigured Settings:\n";
        configured.forEach(setting => {
            list += `- ${formatSetting(setting)}: ${formatSettingValue(setting)}\n`;
        });
    }

    if (requiredUnconfigured.length > 0) {
        list += "\nRequired Settings (Not Yet Configured):\n";
        requiredUnconfigured.forEach(setting => {
            list += `- ${formatSetting(setting)}\n`;
        });
    }

    if (optionalUnconfigured.length > 0) {
        list += "\nOptional Settings (Not Yet Configured):\n";
        optionalUnconfigured.forEach(setting => {
            list += `- ${formatSetting(setting)}\n`;
        });
    }

    return list;
}

// Helper to categorize settings
function categorizeSettings(onboardingState: OnboardingState) {
    const configured = [];
    const requiredUnconfigured = [];
    const optionalUnconfigured = [];

    for (const [key, setting] of Object.entries(onboardingState)) {
        if (setting.value !== null) {
            configured.push({ key, ...setting });
        } else if (setting.required) {
            requiredUnconfigured.push({ key, ...setting });
        } else {
            optionalUnconfigured.push({ key, ...setting });
        }
    }

    return { configured, requiredUnconfigured, optionalUnconfigured };
}

export const ONBOARDING_CACHE_KEY = {
    SERVER_STATE: (serverId: string) => `server_${serverId}_onboarding_state`,
} as const;

export function getOnboardingCacheKey(serverId: string): string {
    if (!serverId) {
      throw new Error('Server ID is required to construct onboarding cache key');
    }
    return `server_${serverId}_onboarding_state`;
  }

export const OWNERSHIP_CACHE_KEY = {
    SERVER_OWNERSHIP_STATE: 'server_ownership_state',
} as const;