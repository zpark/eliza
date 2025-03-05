import handlebars from "handlebars";
import { names, uniqueNamesGenerator } from "unique-names-generator";
import type { Entity, Content, IAgentRuntime, Memory, State, TemplateType, UUID } from "./types.ts";

/**
 * Composes a context string by replacing placeholders in a template with corresponding values from the state.
 *
 * This function takes a template string with placeholders in the format `{{placeholder}}` and a state object.
 * It replaces each placeholder with the value from the state object that matches the placeholder's name.
 * If a matching key is not found in the state object for a given placeholder, the placeholder is replaced with an empty string.
 *
 * @param {Object} params - The parameters for composing the context.
 * @param {State} params.state - The state object containing values to replace the placeholders in the template.
 * @param {TemplateType} params.template - The template string or function containing placeholders to be replaced with state values.
 * @returns {string} The composed context string with placeholders replaced by corresponding state values.
 *
 * @example
 * // Given a state object and a template
 * const state = { userName: "Alice", userAge: 30 };
 * const template = "Hello, {{userName}}! You are {{userAge}} years old";
 *
 * // Composing the context with simple string replacement will result in:
 * // "Hello, Alice! You are 30 years old."
 * const contextSimple = composePrompt({ state, template });
 *
 * // Using composePrompt with a template function for dynamic template
 * const template = ({ state }) => {
 * const tone = Math.random() > 0.5 ? "kind" : "rude";
 *   return `Hello, {{userName}}! You are {{userAge}} years old. Be ${tone}`;
 * };
 * const contextSimple = composePrompt({ state, template });
 */

export const composePrompt = ({
    state,
    template,
}: {
    state: State;
    template: TemplateType;
}) => {
    const templateStr = typeof template === "function" ? template({ state }) : template

    const templateFunction = handlebars.compile(templateStr);
    return composeRandomUser(templateFunction(state), 10);
};

/**
 * Adds a header to a body of text.
 *
 * This function takes a header string and a body string and returns a new string with the header prepended to the body.
 * If the body string is empty, the header is returned as is.
 *
 * @param {string} header - The header to add to the body.
 * @param {string} body - The body to which to add the header.
 * @returns {string} The body with the header prepended.
 *
 * @example
 * // Given a header and a body
 * const header = "Header";
 * const body = "Body";
 *
 * // Adding the header to the body will result in:
 * // "Header\nBody"
 * const text = addHeader(header, body);
 */
export const addHeader = (header: string, body: string) => {
    return body.length > 0 ? `${header ? `${header}\n` : header}${body}\n` : "";
};

/**
 * Generates a string with random user names populated in a template.
 *
 * This function generates random user names and populates placeholders
 * in the provided template with these names. Placeholders in the template should follow the format `{{userX}}`
 * where `X` is the position of the user (e.g., `{{user1}}`, `{{user2}}`).
 *
 * @param {string} template - The template string containing placeholders for random user names.
 * @param {number} length - The number of random user names to generate.
 * @returns {string} The template string with placeholders replaced by random user names.
 *
 * @example
 * // Given a template and a length
 * const template = "Hello, {{user1}}! Meet {{user2}} and {{user3}}.";
 * const length = 3;
 *
 * // Composing the random user string will result in:
 * // "Hello, John! Meet Alice and Bob."
 * const result = composeRandomUser(template, length);
 */
export const composeRandomUser = (template: string, length: number) => {
    const exampleNames = Array.from({ length }, () =>
        uniqueNamesGenerator({ dictionaries: [names] })
    );
    let result = template;
    for (let i = 0; i < exampleNames.length; i++) {
        result = result.replaceAll(`{{user${i + 1}}}`, exampleNames[i]);
    }

    return result;
};

export const formatPosts = ({
    messages,
    actors,
    conversationHeader = true,
}: {
    messages: Memory[];
    actors: Entity[];
    conversationHeader?: boolean;
}) => {
    // Group messages by roomId
    const groupedMessages: { [roomId: string]: Memory[] } = {};
    messages.forEach((message) => {
        if (message.roomId) {
            if (!groupedMessages[message.roomId]) {
                groupedMessages[message.roomId] = [];
            }
            groupedMessages[message.roomId].push(message);
        }
    });

    // Sort messages within each roomId by createdAt (oldest to newest)
    Object.values(groupedMessages).forEach((roomMessages) => {
        roomMessages.sort((a, b) => a.createdAt - b.createdAt);
    });

    // Sort rooms by the newest message's createdAt
    const sortedRooms = Object.entries(groupedMessages).sort(
        ([, messagesA], [, messagesB]) =>
            messagesB[messagesB.length - 1].createdAt -
            messagesA[messagesA.length - 1].createdAt
    );

    const formattedPosts = sortedRooms.map(([roomId, roomMessages]) => {
        const messageStrings = roomMessages
            .filter((message: Memory) => message.userId)
            .map((message: Memory) => {
                const actor = actors.find(
                    (actor: Entity) => actor.id === message.userId
                );
                // TODO: These are okay but not great
                const userName = actor?.names[0] || "Unknown User";
                const displayName = actor?.names[0] || "unknown";

                return `Name: ${userName} (@${displayName})
ID: ${message.id}${message.content.inReplyTo ? `\nIn reply to: ${message.content.inReplyTo}` : ""}
Date: ${formatTimestamp(message.createdAt)}
Text:
${message.content.text}`;
            });

        const header = conversationHeader
            ? `Conversation: ${roomId.slice(-5)}\n`
            : "";
        return `${header}${messageStrings.join("\n\n")}`;
    });

    return formattedPosts.join("\n\n");
};

/**
 * Format messages into a string
 * @param {Object} params - The formatting parameters
 * @param {Memory[]} params.messages - List of messages to format
 * @param {Entity[]} params.actors - List of actors for name resolution
 * @returns {string} Formatted message string with timestamps and user information
 */
export const formatMessages = ({
  messages,
  actors,
}: {
  messages: Memory[];
  actors: Entity[];
}) => {
  const messageStrings = messages
    .reverse()
    .filter((message: Memory) => message.userId)
    .map((message: Memory) => {
      const messageContent = (message.content as Content).text;
      const messageAction = (message.content as Content).action;
      const formattedName =
        actors.find((actor: Entity) => actor.id === message.userId)?.names[0] ||
        "Unknown User";

      const attachments = (message.content as Content).attachments;

      const attachmentString =
        attachments && attachments.length > 0
          ? ` (Attachments: ${attachments
              .map((media) => `[${media.id} - ${media.title} (${media.url})]`)
              .join(", ")})`
          : "";

      const messageTime = new Date(message.createdAt);
      const hours = messageTime.getHours().toString().padStart(2, '0');
      const minutes = messageTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      const timestamp = formatTimestamp(message.createdAt);

      const shortId = message.userId.slice(-5);

      if(messageAction === "REFLECTION") {
        return `${timeString} (${timestamp}) [${shortId}] ${formattedName} (internal monologue) *${messageContent}*`;
      }

      return `${timeString} (${timestamp}) [${shortId}] ${formattedName}: ${messageContent}${attachmentString}${
        messageAction && messageAction !== "null" ? ` (action: ${messageAction})` : ""
      }`;
    })
    .join("\n");
  return messageStrings;
};

export const formatTimestamp = (messageDate: number) => {
  const now = new Date();
  const diff = now.getTime() - messageDate;

  const absDiff = Math.abs(diff);
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (absDiff < 60000) {
    return "just now";
  }if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
    return `${days} day${days !== 1 ? "s" : ""} ago`;
};