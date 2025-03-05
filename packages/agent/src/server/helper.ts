export const hyperfiHandlerTemplate = `Task: Generate dialog and actions for the character {{agentName}}.

{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

{{knowledge}}

{{actors}}

About {{agentName}}:
{{bio}}

{{system}}

{{providers}}

{{attachments}}

{{messageDirections}}

{{recentMessages}}

{{actions}}

# Instructions: Write the next message for {{agentName}}.

Response format should be formatted in a JSON block like this:
\`\`\`json
{ "lookAt": "{{nearby}}" or null, "emote": "{{emotes}}" or null, "say": "string" or null, "actions": (array of strings) or null }
\`\`\`
`;
