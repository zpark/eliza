import type { IAgentRuntime, Relationship, UUID } from "./types.ts";

export async function createRelationship({
    runtime,
    entityA,
    entityB,
}: {
    runtime: IAgentRuntime;
    entityA: UUID;
    entityB: UUID;
}): Promise<boolean> {
    return runtime.databaseAdapter.createRelationship({
        entityA,
        entityB,
        agentId: runtime.agentId,
    });
}

export async function getRelationship({
    runtime,
    entityA,
    entityB,
}: {
    runtime: IAgentRuntime;
    entityA: UUID;
    entityB: UUID;
}) {
    return runtime.databaseAdapter.getRelationship({
        entityA,
        entityB,
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
            const { entityA, entityB } = relationship;

            if (entityA === userId) {
                return entityB;
            }

            return entityA;
        }
    );

    return formattedRelationships;
}
