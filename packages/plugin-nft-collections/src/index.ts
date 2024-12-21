import {
    Plugin,
    type Character,
    type Service,
    type IAgentRuntime,
} from "@ai16z/eliza";
import { ReservoirService } from "./services/reservoir";
import { MarketIntelligenceService } from "./services/market-intelligence";
import { SocialAnalyticsService } from "./services/social-analytics";
import { nftCollectionProvider } from "./providers/nft-collections";
import { sweepFloorAction } from "./actions/sweep-floor";
import { listNFTAction } from "./actions/list-nft";

export class NFTCollectionsPlugin implements Plugin {
    public readonly name = "nft-collections";
    public readonly description =
        "Provides NFT collection information and market intelligence";

    private reservoirService?: ReservoirService;
    private marketIntelligenceService?: MarketIntelligenceService;
    private socialAnalyticsService?: SocialAnalyticsService;

    constructor() {
        // No need for super() since we're implementing, not extending
    }

    async setup(
        character: Character & { runtime?: IAgentRuntime }
    ): Promise<void> {
        if (!character.runtime) {
            throw new Error("Runtime not available in character");
        }

        console.log(
            "Character settings:",
            JSON.stringify(character.settings, null, 2)
        );
        console.log(
            "Environment RESERVOIR_API_KEY:",
            process.env.RESERVOIR_API_KEY
        );

        // Try to get the API key from character settings or environment variable
        const reservoirApiKey =
            character.settings?.secrets?.RESERVOIR_API_KEY ||
            process.env.RESERVOIR_API_KEY;
        console.log("Final reservoirApiKey:", reservoirApiKey);

        if (!reservoirApiKey) {
            throw new Error(
                "RESERVOIR_API_KEY is required in either character settings or environment variables"
            );
        }

        this.reservoirService = new ReservoirService(reservoirApiKey);
        await this.reservoirService.initialize(character.runtime);
        await character.runtime.registerService(this.reservoirService);

        // Optional services
        const marketApiKeys = {
            nansen: character.settings.secrets?.NANSEN_API_KEY,
            dune: character.settings.secrets?.DUNE_API_KEY,
            alchemy: character.settings.secrets?.ALCHEMY_API_KEY,
            chainbase: character.settings.secrets?.CHAINBASE_API_KEY,
            nftscan: character.settings.secrets?.NFTSCAN_API_KEY,
        };

        const socialApiKeys = {
            twitter: character.settings.secrets?.TWITTER_API_KEY,
            discord: character.settings.secrets?.DISCORD_API_KEY,
            telegram: character.settings.secrets?.TELEGRAM_API_KEY,
            alchemy: character.settings.secrets?.ALCHEMY_API_KEY,
            nftscan: character.settings.secrets?.NFTSCAN_API_KEY,
        };

        // Initialize optional services only if API keys are provided
        if (Object.values(marketApiKeys).some((key) => key)) {
            this.marketIntelligenceService = new MarketIntelligenceService(
                marketApiKeys
            );
            await this.marketIntelligenceService.initialize();
            await character.runtime.registerService(
                this.marketIntelligenceService
            );
        }

        if (Object.values(socialApiKeys).some((key) => key)) {
            this.socialAnalyticsService = new SocialAnalyticsService(
                socialApiKeys
            );
            await this.socialAnalyticsService.initialize();
            await character.runtime.registerService(
                this.socialAnalyticsService
            );
        }

        // Register providers and actions
        (character as any).providers = (character as any).providers || [];
        (character as any).providers.push(nftCollectionProvider);

        (character as any).actions = (character as any).actions || [];
        (character as any).actions.push(sweepFloorAction, listNFTAction);
    }

    async teardown(): Promise<void> {
        // Cleanup if needed
    }
}

export const nftCollectionsPlugin = new NFTCollectionsPlugin();

export { ReservoirService } from "./services/reservoir";
export { MarketIntelligenceService } from "./services/market-intelligence";
export { SocialAnalyticsService } from "./services/social-analytics";
export * from "./types";

export default nftCollectionsPlugin;
