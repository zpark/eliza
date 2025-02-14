import { type ChannelType } from "discord.js";
export interface OnboardingSetting {
    name: string;
    description: string;
    value: string | boolean | null;
    required: boolean;
    validation?: (value: any) => boolean;
    dependsOn?: string[];
    onSetAction?: (value: any) => string;
}

export interface OnboardingState {
    settings: {
        [key: string]: OnboardingSetting;
    };
    lastUpdated: number;
    completed: boolean;
}

export interface OnboardingConfig {
    settings: { [key: string]: Omit<OnboardingSetting, 'value'>; };
    roleRequired?: "ADMIN" | "BOSS" | "COLLEAGUE";
    allowedChannels?: ChannelType[];
}