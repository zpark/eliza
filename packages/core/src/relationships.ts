import type { IAgentRuntime, Relationship, UUID } from "./types.ts";

export async function createRelationship({
    runtime,
    sourceEntityId,
    targetEntityId,
    metadata = {},
}: {
    runtime: IAgentRuntime;
    sourceEntityId: UUID;
    targetEntityId: UUID;
    metadata?: { [key: string]: any };
}): Promise<boolean> {
    return runtime.databaseAdapter.createRelationship({
        sourceEntityId,
        targetEntityId,
        agentId: runtime.agentId,
        metadata,
    });
}

export async function updateRelationshipInteractionStrength({
    runtime,
    sourceEntityId,
    targetEntityId,
    increment = 1,
}: {
    runtime: IAgentRuntime;
    sourceEntityId: UUID;
    targetEntityId: UUID;
    increment?: number;
}): Promise<void> {
    // Get existing relationship
    let relationship = await getRelationship({
        runtime,
        sourceEntityId,
        targetEntityId,
    });

    if (!relationship) {
        // Create new relationship if it doesn't exist
        await createRelationship({
            runtime,
            sourceEntityId,
            targetEntityId,
            metadata: {
                interactions: increment,
            },
        });
        return;
    }

    // Update interaction strength
    const currentStrength = relationship.metadata?.interactions || 0;
    relationship.metadata = {
        ...relationship.metadata,
        interactions: currentStrength + increment,
    };

    // Update the relationship in the database
    await runtime.databaseAdapter.updateRelationship(relationship);
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
