import { ASTQueueItem, PluginDocumentation, TodoItem, EnvUsage } from './types/index.js';
import { AIService } from './AIService.js';
import { GitManager } from './GitManager.js';
import { Configuration } from './Configuration.js';
import fs from 'fs';
import path from 'path';

/**
 * Generates comprehensive plugin documentation based on existing JSDoc comments
 */
export class PluginDocumentationGenerator {
    constructor(
        private aiService: AIService,
        private gitManager: GitManager,
        private configuration: Configuration
    ) { }

    /**
     * Generates comprehensive plugin documentation
     * @param {ASTQueueItem[]} existingDocs - Queue of documented items
     * @param {string} branchName - Current git branch name
     * @param {TodoItem[]} todoItems - List of TODO items found in the codebase
     * @param {EnvUsage[]} envUsages - List of environment variable usages
     */
    public async generate(
        existingDocs: ASTQueueItem[],
        branchName?: string,
        todoItems: TodoItem[] = [],
        envUsages: EnvUsage[] = []
    ): Promise<void> {
        // Read package.json
        const packageJsonPath = path.join(this.configuration.absolutePath, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        // Read existing README if it exists
        const readmePath = path.join(this.configuration.absolutePath, 'README.md');
        const readmeContent = fs.existsSync(readmePath)
            ? fs.readFileSync(readmePath, 'utf-8')
            : undefined;

        // Generate documentation
        const documentation = await this.aiService.generatePluginDocumentation({
            existingDocs,
            packageJson,
            readmeContent,
            todoItems,
            envUsages
        });

        // Generate and write markdown
        const markdownContent = this.generateMarkdownContent(documentation);
        fs.writeFileSync(readmePath, markdownContent);

        // Commit if we're in a branch
        if (branchName) {
            await this.gitManager.commitFile(
                branchName,
                'README-automated.md',
                markdownContent,
                'docs: Update plugin documentation'
            );
        }
    }

    private generateMarkdownContent(docs: PluginDocumentation & { todos: string }): string {
        return `# Plugin Documentation
## Overview and Purpose
${docs.overview}
## Installation
${docs.installation}
## Configuration
${docs.configuration}
## Usage Examples
${docs.usage}
## API Reference
${docs.apiReference}
## Common Issues & Troubleshooting
${docs.troubleshooting}
## TODO Items
${docs.todos}
`;
    }
}