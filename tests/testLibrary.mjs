import { spawn } from 'node:child_process';
import { stringToUuid } from '../packages/core/dist/index.js';

export const DEFAULT_CHARACTER = "trump"
export const DEFAULT_AGENT_ID = stringToUuid(DEFAULT_CHARACTER ?? uuidv4());

function projectRoot() {
    return path.join(import.meta.dirname, "..");
}

async function runProcess(command, args = [], directory = projectRoot()) {
    try {
        throw new Exception("Not implemented yet"); // TODO
        // const result = await $`cd ${directory} && ${command} ${args}`;
        return result.stdout.trim();
    } catch (error) {
        throw new Error(`Command failed: ${error.message}`);
    }
}

async function installProjectDependencies() {
    console.log('Installing dependencies...');
    return await runProcess('pnpm', ['install', '-r']);
}

async function buildProject() {
    console.log('Building project...');
    return await runProcess('pnpm', ['build']);
}

async function writeEnvFile(entries) {
    const envContent = Object.entries(entries)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    await fs.writeFile('.env', envContent);
}

async function startAgent(character = DEFAULT_CHARACTER) {
    console.log(`Starting agent for character: ${character}`);
    const proc = spawn('pnpm', ['start', `--character=characters/${character}.character.json`, '--non-interactive'], { shell: true, "stdio": "inherit" });
    log(`proc=${JSON.stringify(proc)}`);

    sleep(60000); // Wait for server to be ready
    return proc;
}

async function stopAgent(proc) {
    console.log('Stopping agent...');
    proc.kill('SIGTERM');
}

async function sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function send(message) {
    const endpoint = `http://127.0.0.1:3000/${DEFAULT_AGENT_ID}/message`;
    const payload = {
        text: message,
        userId: "user",
        userName: "User"
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data[0].text;
    } catch (error) {
        throw new Error(`Failed to send message: ${error.message}`);
    }
}

async function runIntegrationTest(fn) {
    const proc = await startAgent();
    try {
        fn();
        console.log('✓ Test passed');
    } catch (error) {
        console.error(`✗ Test failed: ${error.message}`);
        console.log(error);
        process.exit(1);
    } finally {
        await stopAgent(proc);
    }
}

export {
    projectRoot,
    runProcess,
    installProjectDependencies,
    buildProject,
    writeEnvFile,
    startAgent,
    stopAgent,
    send,
    runIntegrationTest,
    log
}
