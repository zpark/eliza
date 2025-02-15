// src/shared/onboarding/types.ts

export interface OnboardingSetting {
    name: string;
    description: string;
    value: string | boolean | null;
    required: boolean;
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

// Helper function to check if onboarding settings are complete
export function areSettingsComplete(state: OnboardingState): boolean {

    for (const [key, setting] of Object.entries(state)) {
        // Skip if setting is not visible
        if (setting.visibleIf && !setting.visibleIf(state)) {
            continue;
        }

        // Check if required setting has a value
        if (setting.required && (setting.value === null || setting.value === undefined)) {
            return false;
        }

        // If setting has validation function, check if value is valid
        if (setting.validation && setting.value !== null) {
            try {
                if (!setting.validation(setting.value)) {
                    return false;
                }
            } catch (error) {
                return false;
            }
        }

        // Check dependencies
        if (setting.dependsOn) {
            for (const dependency of setting.dependsOn) {
                const dependentSetting = state[dependency];
                if (!dependentSetting || dependentSetting.value === null) {
                    return false;
                }
            }
        }
    }

    return true;
}

// Helper to get visible settings based on current state
export function getVisibleSettings(state: OnboardingState): string[] {
    const visibleSettings: string[] = [];
    
    for (const [key, setting] of Object.entries(state)) {
        if (!setting.visibleIf || setting.visibleIf(state)) {
            visibleSettings.push(key);
        }
    }
    
    return visibleSettings;
}

// Helper to get next incomplete setting
export function getNextIncompleteSetting(state: OnboardingState): string | null {
    const visibleSettings = getVisibleSettings(state);
    
    for (const key of visibleSettings) {
        const setting = state[key];
        
        // Skip if all dependencies aren't met
        if (setting.dependsOn && !setting.dependsOn.every(dep => 
            state[dep] && state[dep].value !== null)) {
            continue;
        }
        
        // Return first setting that's required and doesn't have a value
        if (setting.required && setting.value === null) {
            return key;
        }
    }
    
    return null;
}