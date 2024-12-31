import { ChatOpenAI } from "@langchain/openai";
import dotenv from 'dotenv';
import { ASTQueueItem, EnvUsage, OrganizedDocs, PluginDocumentation, TodoItem, TodoSection } from "./types/index.js";

dotenv.config();

/**
 * Service for interacting with OpenAI chat API.
 */
export class AIService {
    private chatModel: ChatOpenAI;

    /**
     * Constructor for initializing the ChatOpenAI instance.
     *
     * @throws {Error} If OPENAI_API_KEY environment variable is not set.
     */
    constructor() {
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
            }
            return acc;
        }, { classes: [], methods: [], interfaces: [], types: [] });
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
        2. Its main features and capabilities
        3. When and why someone would use it
        4. Any key dependencies or requirements

        Format the response in markdown.`;

        return await this.generateComment(prompt);
    }

    private async generateInstallation(packageJson: any): Promise<string> {
        const prompt = `Generate installation instructions for the following package:

        Package name: ${packageJson.name}
        Dependencies: ${JSON.stringify(packageJson.dependencies || {}, null, 2)}
        Peer dependencies: ${JSON.stringify(packageJson.peerDependencies || {}, null, 2)}

        Include:
        1. Package manager commands - we are using pnpm
        2. Any prerequisite installations
        4. Verification steps to ensure successful installation

        Format the response in markdown.`;

        return await this.generateComment(prompt);
    }

    private async generateConfiguration(envUsages: EnvUsage[]): Promise<string> {
        const prompt = `Generate configuration documentation based on these environment variable usages:
        ${envUsages.map(item => `
        Environment Variable: ${item.code}
        Full Context: ${item.fullContext}
        `).join('\n')}
        Create comprehensive configuration documentation that:
        1. Lists all required environment variables
        2. Explains the purpose of each variable
        3. Provides example values where possible

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
        1. Basic usage example
        2. Common use cases with Code snippets demonstrating key features

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
    private async generateTodoSection(todoItems: TodoItem[]): Promise<TodoSection> {
        if (todoItems.length === 0) {
            return {
                todos: "No TODOs found in the codebase.",
                todoCount: 0
            };
        }

        const prompt = `Generate a TODO section for documentation based on these TODO items:
        ${todoItems.map(item => `
        TODO Comment: ${item.comment}
        Code Context: ${item.fullContext}
        `).join('\n')}
        Create a section that:
        1. Lists all TODOs in a clear, organized way
        2. Groups related TODOs if any
        3. Provides context about what needs to be done
        4. Suggests priority based on the code context
        5. Includes the file location for reference
        Format the response in markdown with proper headings and code blocks.`;

        const todos = await this.generateComment(prompt);
        return {
            todos,
            todoCount: todoItems.length
        };
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