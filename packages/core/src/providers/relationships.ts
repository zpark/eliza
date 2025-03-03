import type { IAgentRuntime, Memory, Provider, State, Relationship, UUID } from "../types.ts";

async function getRelationships({
    runtime,
    userId,
}: {
    runtime: IAgentRuntime;
    userId: UUID;
}) {
    return runtime.databaseAdapter.getRelationships({ userId, agentId: runtime.agentId });
}

async function formatRelationships(runtime: IAgentRuntime, relationships: Relationship[]) {
    // Sort relationships by interaction strength (descending)
    const sortedRelationships = relationships
        .filter(rel => rel.metadata?.interactions)
        .sort((a, b) => 
            (b.metadata?.interactions || 0) - (a.metadata?.interactions || 0)
        )
        .slice(0, 30); // Get top 30

    if (sortedRelationships.length === 0) {
        return "";
    }

    const formattedRelationships = await Promise.all(sortedRelationships
        .map(async (rel, _index) => {

            const formatMetadata = (metadata: any) => {
                return JSON.stringify(Object.entries(metadata)
                    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
                    .join("\n"));
            }

            // get the targetEntityId
            const targetEntityId = rel.targetEntityId;
            
            // get the entity
            const entity = await runtime.getEntity(targetEntityId);

            if(!entity) {
                return null;
            }

            const names = entity.names.join(" aka ");
            return `${names}\n${rel.tags ? rel.tags.join(", ") : ""}\n${formatMetadata(entity.metadata)}\n`;
        })
    );

    return formattedRelationships.filter(Boolean).join("\n");
}

const relationshipsProvider: Provider = {
    name: "relationships",
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        // Get all relationships for the current user
        const relationships = await getRelationships({
            runtime,
            userId: message.userId,
        });

        if (!relationships || relationships.length === 0) {
            return "";
        }

        const formattedRelationships = await formatRelationships(runtime, relationships);

        if (!formattedRelationships) {
            return "";
        }

        return `${runtime.character.name} has observed ${state.senderName} interacting with these people:\n${formattedRelationships}`;
    },
};

export { relationshipsProvider }; 