import {
    type Action,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State
} from "@elizaos/core";
  
  const replyAction = {
    name: "REPLY",
    similes: ["REPLY_TO_MESSAGE", "SEND_REPLY"],
    description: "Replies to the current conversation with the text from the generated message. Default if the agent is responding with a message and no other action.",
    validate: async (
      runtime: IAgentRuntime,
      message: Memory,
      _state: State
    ) => {
      if (message.content.source !== "telegram") {
        return false;
      }
      return true;
    },
    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: State,
      options: any,
      callback: HandlerCallback,
      responses: Memory[]
    ) => {
        for (const response of responses) {
            await callback(response.content);
        }
    },
    examples: [
        // TODO: add examples
    ],
  } as Action;
  
  export default replyAction;