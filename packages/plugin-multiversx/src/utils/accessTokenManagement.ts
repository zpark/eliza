import {type IAgentRuntime} from "@elizaos/core";

export function isUserAuthorized(
    userId: string,
    runtime: IAgentRuntime
): boolean {
    const authorizedUserId = runtime.getSetting("ACCESS_TOKEN_MANAGMENT_TO");
    console.log("UserID from message:", userId);
    console.log("Authorized UserID:", authorizedUserId);
    if (authorizedUserId === "everyone") {
        return true;
    }
    return userId === authorizedUserId;
}
