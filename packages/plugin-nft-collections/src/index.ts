import { Plugin, type Character, type Service } from "@ai16z/eliza";
import { ReservoirService } from "./services/reservoir";
import { MarketIntelligenceService } from "./services/market-intelligence";
import { SocialAnalyticsService } from "./services/social-analytics";
import { nftCollectionProvider } from "./providers/nft-collections";

export default class NFTCollectionsPlugin extends Plugin {
    public override readonly name = "nft-collections";
    public override readonly description =
        "Provides NFT collection information and market intelligence";

    private reservoirService: ReservoirService;
    private marketIntelligenceService?: MarketIntelligenceService;
    private socialAnalyticsService?: SocialAnalyticsService;

    constructor() {
        super();
    }

    async setup(character: Character): Promise<void> {
        const reservoirApiKey = character.settings.secrets?.RESERVOIR_API_KEY;
        if (!reservoirApiKey) {
            throw new Error(
                "RESERVOIR_API_KEY is required in character settings"
            );
        }

        this.reservoirService = new ReservoirService(reservoirApiKey);
        await this.reservoirService.initialize();

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
        }

        if (Object.values(socialApiKeys).some((key) => key)) {
            this.socialAnalyticsService = new SocialAnalyticsService(
                socialApiKeys
            );
            await this.socialAnalyticsService.initialize();
        }

        (character as any).services =
            (character as any).services || new Map<string, Service>();
        (character as any).services.set("nft", this.reservoirService);

        if (this.marketIntelligenceService) {
            (character as any).services.set(
                "nft_market_intelligence",
                this.marketIntelligenceService
            );
        }

        if (this.socialAnalyticsService) {
            (character as any).services.set(
                "nft_social_analytics",
                this.socialAnalyticsService
            );
        }

        (character as any).providers = (character as any).providers || [];
        (character as any).providers.push(nftCollectionProvider);
    }

    async teardown(): Promise<void> {
        // Cleanup if needed
    }
}
