import { getRelationships } from "../relationships.ts";
import { IAgentRuntime, Memory, Provider, State, Relationship } from "../types.ts";

function formatRelationships(relationships: Relationship[]) {
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

    console.log("*** sortedRelationships", sortedRelationships)

    return sortedRelationships
        .map((rel, index) => {
            const strength = rel.metadata?.interactions || 0;
            const name = rel.metadata?.name || "Unknown";
            const description = rel.metadata?.description || "";
            return `${index + 1}. ${name} (Interaction Strength: ${strength})${description ? ` - ${description}` : ""}`;
        })
        .join("\n");
}

const relationshipsProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        // Get all relationships for the current user
        const relationships = await getRelationships({
            runtime,
            userId: message.userId,
        });

        console.log("*** relationships", relationships)

        if (!relationships || relationships.length === 0) {
            return "";
        }

        const formattedRelationships = formatRelationships(relationships);

        console.log("*** formattedRelationships", formattedRelationships)

        if (!formattedRelationships) {
            return "";
        }

        console.log('******* formattedRelationships', formattedRelationships)

        return `Top relationships that ${runtime.character.name} has observed:\n${formattedRelationships}`;
    },
};

export { relationshipsProvider }; 