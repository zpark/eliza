import { adjectives, Config, names, uniqueNamesGenerator } from 'unique-names-generator';
import { addHeader } from "../prompts";
import { IAgentRuntime, Memory, Provider } from "../types";

// Configuration for name generation
const nameConfig: Config = {
  dictionaries: [adjectives, names],
  separator: '',
  length: 2,
  style: 'capital'
};

// Example messages to determine if the agent should respond
const messageExamples = [
  // Examples where agent should RESPOND
  `// {{user1}}: Hey {{agentName}}, can you help me with something
// Response: RESPOND`,

  `// {{user1}}: Hey {{agentName}}, can I ask you a question
// {{agentName}}: Sure, what is it
// {{user1}}: can you help me create a basic react module that demonstrates a counter
// Response: RESPOND`,

  `// {{user1}}: {{agentName}} can you tell me a story
// {{user1}}: about a girl named {{characterName}}
// {{agentName}}: Sure.
// {{agentName}}: Once upon a time, in a quaint little village, there was a curious girl named {{characterName}}.
// {{agentName}}: {{characterName}} was known for her adventurous spirit and her knack for finding beauty in the mundane.
// {{user1}}: I'm loving it, keep going
// Response: RESPOND`,

  `// {{user1}}: okay, i want to test something. can you say marco?
// {{agentName}}: marco
// {{user1}}: great. okay, now do it again
// Response: RESPOND`,

  `// {{user1}}: what do you think about artificial intelligence?
// Response: RESPOND`,

  // Examples where agent should IGNORE
  `// {{user1}}: I just saw a really great movie
// {{user2}}: Oh? Which movie?
// Response: IGNORE`,

  `// {{user1}}: i need help
// {{agentName}}: how can I help you?
// {{user1}}: no. i need help from {{user2}}
// Response: IGNORE`,

  `// {{user1}}: {{user2}} can you answer a question for me?
// Response: IGNORE`,

  `// {{agentName}}: Oh, this is my favorite scene
// {{user1}}: sick
// {{user2}}: wait, why is it your favorite scene
// Response: RESPOND`,

  // Examples where agent should STOP
  `// {{user1}}: {{agentName}} stop responding plz
// Response: STOP`,

  `// {{user1}}: stfu bot
// Response: STOP`,

  `// {{user1}}: {{agentName}} stfu plz
// Response: STOP`,
];

export const shouldRespondProvider: Provider = {
  name: "SHOULD_RESPOND",
  description: "Examples of when the agent should respond, ignore, or stop responding",
  get: async (runtime: IAgentRuntime, message: Memory) => {
    // Get agent name
    const agentName = runtime.character.name;
    
    // Create random user names and character name
    const user1 = uniqueNamesGenerator(nameConfig);
    const user2 = uniqueNamesGenerator(nameConfig);
    const characterName = uniqueNamesGenerator(nameConfig);
    
    // Shuffle the message examples array
    const shuffledExamples = [...messageExamples]
      .sort(() => 0.5 - Math.random())
      .slice(0, 7); // Use a subset of examples
    
    // Replace placeholders with generated names
    const formattedExamples = shuffledExamples.map(example => {
      return example
        .replace(/{{user1}}/g, user1)
        .replace(/{{user2}}/g, user2)
        .replace(/{{agentName}}/g, agentName)
        .replace(/{{characterName}}/g, characterName);
    });

    // Join examples with newlines
    const text = addHeader("# RESPONSE EXAMPLES", formattedExamples.join("\n\n"));

    return {
      text,
    };
  },
};