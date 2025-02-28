import type { IAgentRuntime, Relationship, UUID } from "./types.ts";

export async function createRelationship({
    runtime,
    sourceEntityId,
    targetEntityId,
}: {
    runtime: IAgentRuntime;
    sourceEntityId: UUID;
    targetEntityId: UUID;
}): Promise<boolean> {
    return runtime.databaseAdapter.createRelationship({
        sourceEntityId,
        targetEntityId,
        agentId: runtime.agentId,
    });
}

export async function getRelationship({
    runtime,
    sourceEntityId,
    targetEntityId,
}: {
    runtime: IAgentRuntime;
    sourceEntityId: UUID;
    targetEntityId: UUID;
}) {
    return runtime.databaseAdapter.getRelationship({
        sourceEntityId,
        targetEntityId,
        agentId: runtime.agentId,
    });
}

export async function getRelationships({
    runtime,
    userId,
}: {
    runtime: IAgentRuntime;
    userId: UUID;
}) {
    return runtime.databaseAdapter.getRelationships({ userId, agentId: runtime.agentId });
}

export async function formatRelationships({
    runtime,
    userId,
}: {
    runtime: IAgentRuntime;
    userId: UUID;
}) {
    const relationships = await getRelationships({ runtime, userId });

    const formattedRelationships = relationships.map(
        (relationship: Relationship) => {
            const { sourceEntityId, targetEntityId } = relationship;

            if (sourceEntityId === userId) {
                return targetEntityId;
            }

            return sourceEntityId;
        }
    );

    return formattedRelationships;
}
