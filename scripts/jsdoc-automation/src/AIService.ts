import { ChatOpenAI } from "@langchain/openai";
import dotenv from 'dotenv';
import { ASTQueueItem, EnvUsage, OrganizedDocs, PluginDocumentation, TodoItem, TodoSection } from "./types/index.js";
import path from "path";
import { promises as fs } from 'fs';
import { Configuration } from "./Configuration.js";

// ToDo
// - Vet readme
// - Adding the Plugin to Your ElizaOS - sho adding to package.json in /agent + pnpm commands
    // - DONE - verify
// - Capabilities Provided by this Plugin: - seems wrong
// - DONE - verify
// - Verification Steps Needed?
// - Common Use Cases Vs.
// - look at API Reference prompt
// - Debugging Tips - reference discord and eliz.gg
// - https://claude.ai/chat/2e60e6d7-f8b1-4314-8b51-31b6da9097ee
// - gh workflow - jsdoc & plugin docs - conditionally run either, dont write to files
// - bash script cleaner - check if compile, bash, AI

// New Todo - it should all be based around plugins src/index.ts file
// me dumb for this



dotenv.config();

/**
 * Service for interacting with OpenAI chat API.
 */
export class AIService {
    private chatModel: ChatOpenAI;

    /**
     * Constructor for initializing the ChatOpenAI instance.
     *
     * @param {Configuration} configuration - The configuration instance to be used
     * @throws {Error} If OPENAI_API_KEY environment variable is not set
     */
    constructor(private configuration: Configuration) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set');
        }
        this.chatModel = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    /**
     * Generates a comment based on the specified prompt by invoking the chat model.
     * @param {string} prompt - The prompt for which to generate a comment
     * @returns {Promise<string>} The generated comment
     */
    public async generateComment(prompt: string): Promise<string> {
        try {
            const response = await this.chatModel.invoke(prompt);
            return response.content as string;
        } catch (error) {
            this.handleAPIError(error as Error);
            return '';
        }
    }

    public async generatePluginDocumentation({
        existingDocs,
        packageJson,
        readmeContent,
        todoItems,
        envUsages
    }: {
        existingDocs: ASTQueueItem[];
        packageJson: any;
        readmeContent?: string;
        todoItems: TodoItem[];
        envUsages: EnvUsage[];
    }): Promise<PluginDocumentation & { todos: string }> {
        const organizedDocs = this.organizeDocumentation(existingDocs);

        // write organizedDocs into a json in /here directory
        const jsonPath = path.join(this.configuration.absolutePath, 'here', 'organizedDocs.json');
        fs.writeFile(jsonPath, JSON.stringify(organizedDocs, null, 2));

        const [overview, installation, configuration, usage, apiRef, troubleshooting, todoSection] = await Promise.all([
            this.generateOverview(organizedDocs, packageJson),
            this.generateInstallation(packageJson),
            this.generateConfiguration(envUsages),
            this.generateUsage(organizedDocs, packageJson),
            this.generateApiReference(organizedDocs),
            this.generateTroubleshooting(organizedDocs, packageJson),
            this.generateTodoSection(todoItems)
        ]);

        return {
            overview,
            installation,
            configuration,
            usage,
            apiReference: apiRef,
            troubleshooting,
            todos: todoSection.todos
        };
    }

    private async generateOverview(docs: OrganizedDocs, packageJson: any): Promise<string> {
        const prompt = `Generate a comprehensive overview for a plugin/package based on the following information:

        Package name: ${packageJson.name}
        Package description: ${packageJson.description}
        Main classes:
        ${docs.classes.map(c => `${c.name}: ${c.jsDoc}`).join('\n')}
        Key interfaces:
        ${docs.interfaces.map(i => `${i.name}: ${i.jsDoc}`).join('\n')}

        Generate a clear, concise overview that explains:
        1. The purpose of this plugin
        2. Its main features

        Format the response in markdown.`;

        return await this.generateComment(prompt);
    }

    private async generateInstallation(packageJson: any): Promise<string> {
        const indexPath = path.join(this.configuration.absolutePath, 'src/index.ts');
        let mainExport = 'plugin';
        let exportName = packageJson.name.split('/').pop() + 'Plugin';

        try {
            const indexContent = await fs.readFile(indexPath, { encoding: 'utf8' });
            const exportMatch = indexContent.match(/export const (\w+):/);
            if (exportMatch) {
                exportName = exportMatch[1];
            }

            const prompt = `Generate installation and integration instructions for this ElizaOS plugin:

            Plugin name: ${packageJson.name}
            Main export: ${exportName}
            Index file exports:
            ${indexContent}
            Dependencies: ${JSON.stringify(packageJson.dependencies || {}, null, 2)}
            Peer dependencies: ${JSON.stringify(packageJson.peerDependencies || {}, null, 2)}

            This is a plugin for the ElizaOS agent system. Generate comprehensive installation instructions that include:

            1. How to add the plugin to your ElizaOS project:
               - First, explain that users need to add the following to their agent/package.json dependencies:
                 \`\`\`json
                 {
                   "dependencies": {
                     "${packageJson.name}": "workspace:*"
                   }
                 }
                 \`\`\`
               - Then, explain they need to:
                 1. cd into the agent/ directory
                 2. Run pnpm install to install the new dependency
                 3. Run pnpm build to build the project with the new plugin

            2. After installation, show how to import and use the plugin:
               - Import syntax using: import { ${exportName} } from "${packageJson.name}";
               - How to add it to the AgentRuntime plugins array

            3. Integration example showing the complete setup:
               \`\`\`typescript
               import { ${exportName} } from "${packageJson.name}";

               return new AgentRuntime({
                   // other configuration...
                   plugins: [
                       ${exportName},
                       // other plugins...
                   ],
               });
               \`\`\`

            4. Verification steps to ensure successful integration

            Format the response in markdown, with clear section headers and step-by-step instructions. Emphasize that this is a workspace package that needs to be added to agent/package.json and then built.`;

            return await this.generateComment(prompt);
        } catch (error) {
            console.error('Error reading index.ts:', error);
            return this.generateBasicInstallPrompt(packageJson);
        }
    }

    private async generateBasicInstallPrompt(packageJson: any): Promise<string> {
        console.log('AIService::generateInstallation threw an error, generating basic install prompt');
        const prompt = `Generate basic installation instructions for this ElizaOS plugin:

        Plugin name: ${packageJson.name}
        Dependencies: ${JSON.stringify(packageJson.dependencies || {}, null, 2)}
        Peer dependencies: ${JSON.stringify(packageJson.peerDependencies || {}, null, 2)}

        This is a plugin for the ElizaOS agent system. Include basic setup instructions.`;

        return await this.generateComment(prompt);
    }

    private async generateConfiguration(envUsages: EnvUsage[]): Promise<string> {
        const prompt = `Generate configuration documentation based on these environment variable usages:
        ${envUsages.map(item => `
        Environment Variable: ${item.code}
        Full Context: ${item.fullContext}
        `).join('\n')}
        Create comprehensive configuration documentation that:
        1. Lists all required environment variables and their purpose
        2. Return a full .env example file

        Inform the user that the configuration is done in the .env file.
        And to ensure the .env is set in the .gitignore file so it is not committed to the repository.

        Format the response in markdown with proper headings and code blocks.`;

        return await this.generateComment(prompt);
    }

    private async generateUsage(docs: OrganizedDocs, packageJson: any): Promise<string> {
        const prompt = `Generate usage examples based on the following API documentation:

        Classes:
        ${docs.classes.map(c => `${c.className}: ${c.jsDoc}`).join('\n')}

        Methods:
        ${docs.methods.map(m => `${m.methodName}: ${m.jsDoc}`).join('\n')}

        Create:
        1. Basic usage example showing Common use cases with Code snippets demonstrating key features

        Format the response in markdown with code examples.`;

        return await this.generateComment(prompt);
    }

    private async generateApiReference(docs: OrganizedDocs): Promise<string> {
        const prompt = `Generate API reference documentation based on:

        Classes:
        ${docs.classes.map(c => `${c.name}: ${c.jsDoc}`).join('\n')}
        Methods:
        ${docs.methods.map(m => `${m.name}: ${m.jsDoc}`).join('\n')}
        Interfaces:
        ${docs.interfaces.map(i => `${i.name}: ${i.jsDoc}`).join('\n')}
        Types:
        ${docs.types.map(t => `${t.name}: ${t.jsDoc}`).join('\n')}

        Create a comprehensive API reference including:
        1. Class descriptions and methods
        2. Method signatures and parameters
        3. Return types and values
        4. Interface definitions
        5. Type definitions
        6. Examples for complex APIs

        Format the response in markdown with proper headings and code blocks.`;

        return await this.generateComment(prompt);
    }

      /**
 * Generates troubleshooting guide based on documentation and common patterns
 */
    // toDo - integrate w/ @Jin's discord scraper to pull solutions for known issues
    private async generateTroubleshooting(docs: OrganizedDocs, packageJson: any): Promise<string> {
        const prompt = `Generate a troubleshooting guide based on:

            Package dependencies: ${JSON.stringify(packageJson.dependencies || {}, null, 2)}
            Error handling in methods:
            ${docs.methods
                        .filter(m => m.jsDoc?.toLowerCase().includes('error') || m.jsDoc?.toLowerCase().includes('throw'))
                        .map(m => `${m.methodName}: ${m.jsDoc}`)
                        .join('\n')}

            Create a troubleshooting guide including:
            1. Common issues and their solutions
            2. Error messages and their meaning
            3. Debugging tips
            4. Configuration problems
            5. Compatibility issues
            6. Performance optimization
            7. FAQ section

            Format the response in markdown with clear headings and code examples where relevant.`;

        return await this.generateComment(prompt);
    }

    /**
     * Generates TODO section documentation from found TODO comments
     */
    // toDo - integrate w/ @Jin's discord scraper to auto create GH issues/bounties
    private async generateTodoSection(todoItems: TodoItem[]): Promise<TodoSection> {
        if (todoItems.length === 0) {
            return {
                todos: "No TODOs found in the codebase.",
                todoCount: 0
            };
        }

        const prompt = `I scraped the codebase for TODO comments, for each TODO comment and its associated code, Create a section that:
        ${todoItems.map(item => `
        TODO Comment: ${item.comment}
        Code Context: ${item.fullContext}
        `).join('\n')}

        Create a section that:
        1. List the todo item
        2. Provides context about what needs to be done
        3. Tag the todo item (bug, feature, etc)`;

        const todos = await this.generateComment(prompt);
        return {
            todos,
            todoCount: todoItems.length
        };
    }

    // should be moved to utils
    private organizeDocumentation(docs: ASTQueueItem[]): OrganizedDocs {
        return docs.reduce((acc: OrganizedDocs, doc) => {
            // Use nodeType to determine the category
            switch (doc.nodeType) {
                case 'ClassDeclaration':
                    acc.classes.push(doc);
                    break;
                case 'MethodDefinition':
                case 'TSMethodSignature':
                    acc.methods.push(doc);
                    break;
                case 'TSInterfaceDeclaration':
                    acc.interfaces.push(doc);
                    break;
                case 'TSTypeAliasDeclaration':
                    acc.types.push(doc);
                    break;
                case 'FunctionDeclaration':
                    acc.functions.push(doc);
                    break;
            }
            return acc;
        }, { classes: [], methods: [], interfaces: [], types: [], functions: [] });
    }




    /**
     * Handle API errors by logging the error message and throwing the error.
     *
     * @param {Error} error The error object to handle
     * @returns {void}
     */
    public handleAPIError(error: Error): void {
        console.error('API Error:', error.message);
        throw error;
    }
}