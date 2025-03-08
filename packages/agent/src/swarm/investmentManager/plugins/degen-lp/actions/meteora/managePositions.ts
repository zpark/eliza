import {
    Action,
    elizaLogger,
    generateText,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    parseJSONObjectFromText,
    settings,
    State,
} from "@elizaos/core";
import { PublicKey } from "@solana/web3.js";
import { DLMM, StrategyType } from "@meteora-ag/dlmm";
import { sendTransaction } from "../../utils/sendTransaction";
import { loadWallet } from "../../utils/loadWallet";

interface FetchedPosition {
    poolAddress: string;
    positionPubKey: string;
    inRange: boolean;
    distanceFromActiveBinBps: number;
    binRange: number;
}

interface ManagePositionsInput {
    repositionThresholdBps: number;
    intervalSeconds: number;
    slippageToleranceBps: number;
}

export const managePositions: Action = {
    name: 'manage_meteora_positions',
    similes: ["AUTOMATE_METEORA_REBALANCING", "AUTOMATE_METEORA_POSITIONS"],
    description: "Automatically manage Meteora positions by rebalancing when they drift from active bin",

    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const config = await extractAndValidateConfiguration(message.content.text, runtime);
        return !!config;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        params: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Start managing Meteora positions");
        
        const { repositionThresholdBps, slippageToleranceBps }: ManagePositionsInput = 
            await extractAndValidateConfiguration(message.content.text, runtime);
        
        const fetchedPositions = await extractFetchedPositions(state.providers, runtime);
        const { signer: wallet } = await loadWallet(runtime, true);

        await handleRepositioning(
            fetchedPositions,
            repositionThresholdBps,
            wallet
        );

        return true;
    },
    examples: []
};

async function handleRepositioning(
    fetchedPositions: FetchedPosition[],
    repositionThresholdBps: number,
    wallet: any
) {
    return await Promise.all(
        fetchedPositions.map(async (position) => {
            if (position.distanceFromActiveBinBps > repositionThresholdBps) {
                const dlmmPool = await DLMM.create(
                    wallet.connection,
                    new PublicKey(position.poolAddress)
                );

                const activeBin = await dlmmPool.getActiveBin();
                const TOTAL_RANGE_INTERVAL = position.binRange;
                
                try {
                    // Remove existing liquidity
                    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(wallet.publicKey);
                    const userPosition = userPositions.find(p => 
                        p.publicKey.toString() === position.positionPubKey
                    );

                    if (!userPosition) return null;

                    const binIdsToRemove = userPosition.positionData.positionBinData.map(bin => bin.binId);
                    const removeLiquidityTx = await dlmmPool.removeLiquidity({
                        position: userPosition.publicKey,
                        user: wallet.publicKey,
                        binIds: binIdsToRemove,
                        liquiditiesBpsToRemove: new Array(binIdsToRemove.length).fill(10000), // 100%
                        shouldClaimAndClose: true
                    });

                    await sendTransaction(wallet.connection, removeLiquidityTx, wallet);

                    // Create new position around active bin
                    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
                    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

                    const newPosition = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
                        positionPubKey: userPosition.publicKey,
                        user: wallet.publicKey,
                        totalXAmount: userPosition.positionData.totalXAmount,
                        totalYAmount: userPosition.positionData.totalYAmount,
                        strategy: {
                            maxBinId,
                            minBinId,
                            strategyType: StrategyType.SpotBalanced,
                        },
                    });

                    await sendTransaction(wallet.connection, newPosition, wallet);

                    return {
                        oldPosition: position.positionPubKey,
                        newPosition: userPosition.publicKey.toString()
                    };

                } catch (error) {
                    elizaLogger.error(`Error repositioning: ${error}`);
                    return null;
                }
            }
            return null;
        })
    );
}

// ... rest of the helper functions similar to Orca implementation ... 