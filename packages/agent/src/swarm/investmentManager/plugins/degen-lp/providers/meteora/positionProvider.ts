import { elizaLogger, IAgentRuntime, Memory, Provider, settings, State } from "@elizaos/core";
import { DLMM } from "@meteora-ag/dlmm";
import { PublicKey } from "@solana/web3.js";
import { loadWallet } from "../../utils/loadWallet";

export interface MeteoraPositionStatistics {
    poolAddress: string;
    positionPubKey: string;
    inRange: boolean;
    distanceFromActiveBinBps: number;
    binRange: number;
}

export const meteoraPositionProvider: Provider = {
    name: "degen-lp-meteora-position-provider",
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ) => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        }
        
        try {
            const { address: ownerAddress, connection } = await loadWallet(runtime, false);
            const positions = await fetchPositions(connection, ownerAddress);
            return JSON.stringify(positions);
        } catch (error) {
            elizaLogger.error("Error in Meteora position provider:", error);
            return null;
        }
    },
};

const fetchPositions = async (connection: any, ownerAddress: PublicKey): Promise<MeteoraPositionStatistics[]> => {
    try {
        // This would need to be populated with actual pool addresses from Meteora
        const POOL_ADDRESSES = [
            // TODO: Add known Meteora pool addresses
        ];

        const positions: MeteoraPositionStatistics[] = [];

        for (const poolAddress of POOL_ADDRESSES) {
            const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
            const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(ownerAddress);
            const activeBin = await dlmmPool.getActiveBin();

            for (const position of userPositions) {
                const binData = position.positionData.positionBinData;
                const positionBinIds = binData.map(b => b.binId);
                const binRange = Math.max(...positionBinIds) - Math.min(...positionBinIds);
                
                const centerBinId = Math.floor(
                    (Math.max(...positionBinIds) + Math.min(...positionBinIds)) / 2
                );
                
                const distanceFromActiveBinBps = Math.abs(centerBinId - activeBin.binId) * 100;

                positions.push({
                    poolAddress: poolAddress.toString(),
                    positionPubKey: position.publicKey.toString(),
                    inRange: positionBinIds.includes(activeBin.binId),
                    distanceFromActiveBinBps,
                    binRange,
                });
            }
        }

        return positions;
    } catch (error) {
        throw new Error(`Error fetching Meteora positions: ${error}`);
    }
}; 