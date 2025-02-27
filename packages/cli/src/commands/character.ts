// src/commands/character.ts
import type { Character, MessageExample } from "@elizaos/core";
import { MessageExampleSchema } from "@elizaos/core";
import { Command } from "commander";
import fs from "node:fs";
import prompts from "prompts";
import { z } from "zod";
import { adapter } from "../database";
import { handleError } from "../utils/handle-error";
import { displayCharacter, formatMessageExamples } from "../utils/helpers";
import { logger } from "../utils/logger";
import { getRegistryIndex } from "../utils/registry";
import { 
  promptWithNav, 
  promptForMultipleItems, 
  confirmAction,
  NAV_BACK,
  NAV_NEXT,
} from "../utils/cli-prompts";

import { withConnection } from "../utils/with-connection";


const characterSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  plugins: z.array(z.string()).optional(),
  secrets: z.record(z.string(), z.string()).optional(),
  bio: z.array(z.string()).optional(),
  adjectives: z.array(z.string()).optional(),
  postExamples: z.array(z.string()).optional(),
  messageExamples: z.array(z.array(MessageExampleSchema)).optional(),
  topics: z.array(z.string()).optional(),
  style: z.object({
    all: z.array(z.string()).optional(),
    chat: z.array(z.string()).optional(),
    post: z.array(z.string()).optional(),
  }).optional(),
});

type CharacterFormData = z.infer<typeof characterSchema>;

export const character = new Command()
  .name("character")
  .description("manage characters");

/**
 * Collects a conversation example.
 * Messages alternate starting with the user.
 */
async function collectSingleConversation(characterName: string, initial?: MessageExample[]): Promise<MessageExample[] | null> {
  const msgs: MessageExample[] = [...(initial || [])];
  let role: "user" | "character" = initial?.length ? (initial[initial.length - 1].user === "{{user1}}" ? "user" : "character") : "user";
  
  logger.info("\nEnter conversation messages (alternating user/character)");
  if (initial?.length) {
    logger.info("\nExisting conversation:");
    for (const msg of initial) {
      const user = msg.user === "{{user1}}" ? "User" : msg.user;
      logger.info(`${user}: ${msg.content.text}`);
    }
    logger.info("\nContinue the conversation or press Enter to keep as is:");
  } else {
    logger.info("Press Enter with empty input or type 'next' when done with the conversation");
    logger.info("Type 'cancel' to discard this conversation");
  }
  
  while (true) {
    const label = role === "user" ? "User Message" : `${characterName} Response`;
    const input = await promptWithNav(label, "", (val) => role === "user" || val ? true : "Enter a message");
    if (input === "cancel") return initial || null;
    if (input === NAV_NEXT) break;
    if (input === NAV_BACK) continue;
    msgs.push({
      user: role === "user" ? "{{user1}}" : characterName,
      content: { text: input }
    });
    role = role === "user" ? "character" : "user";
  }
  return msgs.length > 0 ? msgs : null;
}

/**
 * Collect multiple conversation examples.
 */
async function collectMessageExamples(characterName: string, initial: MessageExample[][] = []): Promise<MessageExample[][]> {
  const examples: MessageExample[][] = [...initial];
  logger.info("\nMessage Examples");
  
  if (initial.length > 0) {
    logger.info(`\nExisting conversations (${initial.length}):`);
    logger.info(formatMessageExamples(initial));
    logger.info("\nPress Enter to keep existing conversations, or add new ones:");
  } else {
    logger.info("Enter example conversations to demonstrate the character's communication style");
  }
  
  while (true) {
    const convo = await collectSingleConversation(characterName);
    if (!convo) {
      if (examples.length === initial.length) return initial;
      break;
    }
    examples.push(convo);
    logger.info(`Added conversation with ${convo.length} messages`);
    
    const { addMore } = await prompts({
      type: "confirm",
      name: "addMore",
      message: "Add another conversation?",
      initial: true,
    });
    if (!addMore) break;
  }
  
  logger.info(`Total conversations: ${examples.length}`);
  return examples;
}

/**
 * Collect character data with navigation.
 */
async function collectCharacterData(initialData?: Partial<CharacterFormData>): Promise<CharacterFormData | null> {
  const data: Partial<CharacterFormData> = { ...initialData };
  
  // Fetch plugin registry in advance
  let pluginRegistry: Record<string, string>;
  try {
    pluginRegistry = await getRegistryIndex();
  } catch (error) {
    logger.error("Error fetching plugins from registry:", error);
    pluginRegistry = {};
  }

  logger.info("\n=== Create Your Character ===");
  logger.info("Navigation Instructions:");
  logger.info("- Press Enter or type 'next' to move forward");
  logger.info("- Type 'back' to go to previous field");
  logger.info("- Type 'cancel' to abort at any time");
  logger.info("----------------------------------------\n");
  
  type Field = { key: keyof CharacterFormData; prompt: () => Promise<"success" | typeof NAV_BACK | typeof NAV_NEXT | "cancel"> };
  const fields: Field[] = [
    { key: "name", prompt: async () => {
        const inp = await promptWithNav("Name:", data.name || "", (val) => val.length >= 2 ? true : "Min 2 chars");
        if (inp === "cancel") return "cancel";
        if (inp === NAV_BACK) return NAV_BACK;
        if (inp === NAV_NEXT) return NAV_NEXT;
        data.name = inp;
        data.username = inp.toLowerCase().replace(/\s+/g, "_");
        return "success";
      }
    },
    { key: "bio", prompt: async () => {
        const items = await promptForMultipleItems("Bio", data.bio || []);
        data.bio = items;
        return "success";
      }
    },
    { key: "adjectives", prompt: async () => {
        // Start with any existing adjectives from data
        let items = [...(data.adjectives || [])];

        // This helper will prompt for multiple items and append them:
        async function promptAdjectives() {
          const newItems = await promptForMultipleItems("Adjectives", items);
          // If the user typed "cancel", promptForMultipleItems might just return the original array
          items = newItems;
        }

        // Prompt the user once:
        await promptAdjectives();
        // If under 3 adjectives, prompt again in a loop until the user provides at least 3 (or cancels):
        while (items.length < 3) {
          logger.error(`Require at least 3 adjectives, but you only provided ${items.length}. Please enter additional adjectives.`);
          await promptAdjectives();
        }

        // Now that we have 3 or more, save them:
        data.adjectives = items;
        return "success";
      }
    },
    { key: "topics", prompt: async () => {
        const items = await promptForMultipleItems("Topics", data.topics || []);
        data.topics = items;
        return "success";
      }
    },
    { key: "plugins", prompt: async () => {
        // Use pre-fetched plugin registry
        const pluginChoices = Object.keys(pluginRegistry).map(plugin => ({
          title: plugin,
          value: plugin,
          selected: data.plugins?.includes(plugin) || false,
          description: pluginRegistry[plugin]
        }));

        if (pluginChoices.length === 0) {
          logger.info("\nNo plugins available");
          data.plugins = [];
          return "success";
        }

        logger.info("\nSelect plugins for your character:");
        
        const { selectedPlugins } = await prompts({
          type: 'multiselect',
          name: 'selectedPlugins',
          message: 'Available plugins',
          choices: pluginChoices,
          hint: 'Space to select/deselect, Enter to confirm'
        });

        if (selectedPlugins === undefined) {
          logger.info("No plugins selected, continuing with empty plugins list");
          data.plugins = [];
          return "success";
        }
        data.plugins = selectedPlugins;
        logger.info(`Selected plugins: ${selectedPlugins.join(", ") || "none"}`);
        return "success";
      }
    },
    { key: "postExamples", prompt: async () => {
        const items = await promptForMultipleItems("Post Examples", data.postExamples || []);
        data.postExamples = items;
        return "success";
      }
    },
    { key: "style", prompt: async () => {
        data.style = data.style || {};
        const fieldsStyle: (keyof typeof data.style)[] = ["all", "chat", "post"];
        
        logger.info("\nDefine character's style traits:");
        logger.info("Enter one trait per line for each category");
        logger.info("Press Enter with empty input or type 'next' when done with a category");
        logger.info("Type 'back' to return to previous category");
        
        for (const field of fieldsStyle) {
          try {
            logger.info(`\n${field.toUpperCase()} STYLE TRAITS:`);
            if (field === "all") {
              logger.info("These traits apply to all interactions");
            } else if (field === "chat") {
              logger.info("These traits apply only to chat/conversation interactions");
            } else if (field === "post") {
              logger.info("These traits apply only to social media posts");
            }
            
            const items = await promptForMultipleItems(`${field} style`, data.style[field] || []);
            data.style[field] = items || [];
            logger.info(`${field} style: ${items.length} traits added`);
          } catch {
            logger.error(`Error in ${field} style input, skipping...`);
            data.style[field] = [];
          }
        }
        return "success";
      }
    },
    { key: "messageExamples", prompt: async () => {
        // Ensure message examples match the required type structure
        const existingExamples = (data.messageExamples || []).map(conversation =>
          conversation.map(msg => ({
            user: msg.user || "unknown",
            content: {
              text: msg.content?.text || "",
              ...msg.content
            }
          }))
        ) as MessageExample[][];
        const exs = await collectMessageExamples(data.name || "", existingExamples);
        data.messageExamples = exs;
        return "success";
      }
    },
  ];
  
  let idx = 0;
  while (idx < fields.length) {
    const res = await fields[idx].prompt();
    if (res === "cancel") {
      logger.info("Creation cancelled");
      return null;
    }if (res === NAV_BACK) {
      if (idx > 0) idx--;
      else logger.info("First field");
    } else {
      idx++;
    }
  }
  return data as CharacterFormData;
}

function getDefaultCharacterFields(existing?: Partial<Character>) {
  return {
    topics: existing?.topics || [],
    style: {
      all: existing?.style?.all || [],
      chat: existing?.style?.chat || [],
      post: existing?.style?.post || [],
    },
    plugins: existing?.plugins || [],
  };
}




/**
 * Display character data for review and get confirmation
 */
async function reviewCharacter(data: Partial<Character>): Promise<boolean> {
  displayCharacter(data);

  const { confirmed } = await prompts({
    type: "confirm",
    name: "confirmed",
    message: "Save this character?",
    initial: true
  });

  return confirmed;
}

//
// COMMAND ACTIONS
//

character.command("list")
  .alias("ls")
  .description("list all characters")
  .option("-j, --json", "output as JSON")
  .action(async (opts) => {
    await withConnection(async () => {
      const chars = await adapter.listCharacters();
      if (chars.length === 0) {
        logger.info("No characters found");
      } else if (opts.json) {
        logger.info(JSON.stringify(chars, null, 2));
      } else {
        logger.info("\nCharacters:");
        console.table(chars.map(c => ({ name: c.name, bio: c.bio[0] })));
      }
    });
  });

character.command("create")
  .alias("new")
  .description("create a new character")
  .option("-i, --import <file>", "import from JSON file")
  .option("-y, --yes", "skip confirmation")
  .action(async (opts) => {
    await withConnection(async () => {
      let formData: CharacterFormData | null = null;
      
      if (opts.import) {
        try {
          const raw = await fs.promises.readFile(opts.import, "utf8");
          formData = characterSchema.parse(JSON.parse(raw));
        } catch (error) {
          logger.error(`Failed to import file: ${error.message}`);
          return;
        }
      } else {
        formData = await collectCharacterData();
      }

      if (!formData) {
        logger.info("Creation cancelled");
        return;
      }

      const charData = {
        ...getDefaultCharacterFields(),
        name: formData.name,
        bio: formData.bio,
        adjectives: formData.adjectives,
        postExamples: formData.postExamples,
        messageExamples: (formData.messageExamples || []).map(conversation => 
          conversation.map(msg => ({
            user: msg.user || "{{user1}}",
            content: msg.content
          }))
        ),
        topics: formData.topics || [],
        plugins: formData.plugins || [],
        style: {
          all: formData.style?.all || [],
          chat: formData.style?.chat || [],
          post: formData.style?.post || []
        }
      } as Character;

      if (opts.yes || await reviewCharacter(charData)) {
        await adapter.createCharacter(charData);
        logger.success(`Created character ${charData.name}`);
      } else {
        logger.info("Creation cancelled");
      }
    });
  });

character.command("edit")
  .alias("e")
  .description("edit a character")
  .requiredOption("-n, --name <name>", "character name")
  .option("-y, --yes", "skip confirmation")
  .option("-f, --field <field>", "edit specific field (bio, adjectives, topics, style, plugins, examples)")
  .action(async (opts) => {
    await withConnection(async () => {
      const existing = await adapter.getCharacter(opts.name);
      if (!existing) {
        logger.error(`Character ${opts.name} not found`);
        return;
      }

      // Show current values before editing
      displayCharacter(existing, "Current Character Values");
      
      logger.info("\n=== Starting Edit Mode ===");
      logger.info("Press Enter to keep existing values, or type new ones");
      logger.info("Type 'back' to go to previous field, 'next' to skip to next field");
      logger.info("Type 'cancel' to abort at any time\n");
      
      const formData = await collectCharacterData({
        name: existing.name,
        bio: Array.isArray(existing.bio) ? existing.bio : [existing.bio],
        adjectives: existing.adjectives || [],
        postExamples: existing.postExamples || [],
        messageExamples: existing.messageExamples || [],
        topics: existing.topics || [],
        plugins: existing.plugins || [],
        style: {
          all: existing.style?.all || [],
          chat: existing.style?.chat || [],
          post: existing.style?.post || []
        },
      });

      if (!formData) {
        logger.info("Editing cancelled");
        return;
      }

      const updated = {
        ...getDefaultCharacterFields(existing),
        name: formData.name,
        bio: formData.bio || [],
        adjectives: formData.adjectives || [],
        postExamples: formData.postExamples || [],
        messageExamples: (formData.messageExamples || []).map(conversation => 
          conversation.map(msg => ({
            user: msg.user || "unknown",
            content: msg.content
          }))
        ),
        topics: formData.topics || [],
        plugins: formData.plugins || [],
        style: {
          all: formData.style?.all || [],
          chat: formData.style?.chat || [],
          post: formData.style?.post || []
        }
      } as Character;

      if (opts.yes || await reviewCharacter(updated)) {
        await adapter.updateCharacter(opts.name, updated);
        logger.success(`Updated character ${formData.name} successfully`);
      } else {
        logger.info("Update cancelled");
      }
    });
  });

character.command("import")
  .alias("i")
  .description("import a character from file")
  .argument("<file>", "JSON file path")
  .option("-y, --yes", "skip confirmation")
  .action(async (file, opts) => {
    await withConnection(async () => {
      try {
        const raw = await fs.promises.readFile(file, "utf8");
        const parsed = characterSchema.parse(JSON.parse(raw));
        const charData = {
          name: parsed.name,
          bio: parsed.bio || [],
          adjectives: parsed.adjectives || [],
          postExamples: parsed.postExamples || [],
          messageExamples: parsed.messageExamples as MessageExample[][],
          topics: parsed.topics || [],
          style: {
            all: parsed.style?.all || [],
            chat: parsed.style?.chat || [],
            post: parsed.style?.post || [],
          },
          plugins: parsed.plugins || [],
        };

        // Check if a character with the same name already exists.
        const existing = await adapter.getCharacter(parsed.name);
        if (existing) {
          logger.warn(`Character "${parsed.name}" already exists.`);
          let proceed: boolean;
          if (opts.yes) {
            proceed = true;
          } else {
            proceed = await confirmAction(`Do you want to replace the existing character "${parsed.name}"?`);
          }
          if (!proceed) {
            logger.info("Import cancelled");
            return;
          }

          // Optionally review the character before replacing if not skipping confirmation.
          if (!(opts.yes || await reviewCharacter(charData))) {
            logger.info("Replacement cancelled");
            return;
          }
          await adapter.updateCharacter(parsed.name, charData);
          logger.success(`Replaced character "${parsed.name}" successfully`);
        } else {
          if (opts.yes || await reviewCharacter(charData)) {
            await adapter.createCharacter(charData);
            logger.success(`Imported character "${parsed.name}" successfully`);
          } else {
            logger.info("Import cancelled");
          }
        }
      } catch (error) {
        handleError(error);
      }
    });
  });

character.command("export")
  .alias("x")
  .description("export a character to file")
  .requiredOption("-n, --name <name>", "character name")
  .option("-o, --output <file>", "output file path")
  .option("-p, --pretty", "pretty print JSON")
  .action(async (opts) => {
    await withConnection(async () => {
      const characterData = await adapter.getCharacter(opts.name);
      if (!characterData) {
        logger.error(`Character ${opts.name} not found`);
        return;
      }
      const outputPath = opts.output || `${characterData.name}.json`;
      await fs.promises.writeFile(
        outputPath, 
        JSON.stringify(characterData, null, opts.pretty ? 2 : undefined)
      );
      logger.success(`Exported character to ${outputPath}`);
    });
  });

character.command("remove")
  .alias("rm")
  .description("remove a character")
  .requiredOption("-n, --name <name>", "character name")
  .option("-f, --force", "skip confirmation")
  .action(async (opts) => {
    await withConnection(async () => {
      const exists = await adapter.getCharacter(opts.name);
      if (!exists) {
        logger.error(`Character ${opts.name} not found`);
        return;
      }

      if (opts.force || await confirmAction(`Are you sure you want to remove character "${opts.name}"?`)) {
        await adapter.removeCharacter(opts.name);
        logger.success(`Removed character ${opts.name}`);
      } else {
        logger.info("Removal cancelled");
      }
    });
  });

