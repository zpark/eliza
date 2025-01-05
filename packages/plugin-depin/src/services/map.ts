import {
    IAgentRuntime,
    State,
    ModelClass,
    composeContext,
    generateText,
    elizaLogger,
} from "@elizaos/core";
import axios from "axios";

import { locationExtractionTemplate } from "../template";
import { parseLocation } from "../parsers";

export async function getLatLngMapbox(
    runtime: IAgentRuntime,
    location: string
) {
    const apiKey = runtime.getSetting("MAPBOX_API_KEY");
    const apiUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${apiKey}`;

    try {
        const response = await axios.get(apiUrl);
        if (!response.data.features?.length) {
            return null; // Location not found
        }
        const [lng, lat] = response.data.features[0].center;
        return { lat, lon: lng };
    } catch (error) {
        console.error(
            "Error fetching coordinates:",
            error instanceof Error ? error.message : "Unknown error"
        );
        return null;
    }
}

export async function extractLocationAndCoordinates(
    state: State,
    runtime: IAgentRuntime
) {
    const locationExtractionContext = composeContext({
        state,
        template:
            // @ts-ignore
            runtime.character.templates?.locationExtractionTemplate ||
            locationExtractionTemplate,
    });
    const location = await generateText({
        runtime,
        context: locationExtractionContext,
        modelClass: ModelClass.SMALL,
    });

    const parsedLocation = parseLocation(location);

    elizaLogger.log("Extracted location is: ", parsedLocation);

    return getLatLngMapbox(runtime, parsedLocation);
}
