import { spawn } from "node:child_process";
import { stringToUuid } from "../packages/core/dist/index.js";
import path from "path";

export const DEFAULT_CHARACTER = "trump"
export const DEFAULT_AGENT_ID = stringToUuid(DEFAULT_CHARACTER ?? uuidv4());

function projectRoot() {
    return path.join(import.meta.dirname, "..");
}

function log(message) {
    console.log(message);
}

function logError(error) {
    log("ERROR: " + error.message);
    log(error); // Print stack trace
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
    log('Installing dependencies...');
    return await runProcess('pnpm', ['install', '-r']);
}

async function buildProject() {
    log('Building project...');
    return await runProcess('pnpm', ['build']);
}

async function writeEnvFile(entries) {
    const envContent = Object.entries(entries)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    await fs.writeFile('.env', envContent);
}

async function startAgent(character = DEFAULT_CHARACTER) {
    log(`Starting agent for character: ${character}`);
    const proc = spawn("pnpm", ["start", `--character=characters/${character}.character.json`, '--non-interactive'], {
        cwd: projectRoot(),
        shell: true,
        stdio: "inherit"
    });
    log(`proc=${JSON.stringify(proc)}`);
    const startTime = Date.now();
    while (true) {
        try {
            const response = await fetch("http://127.0.0.1:3000/", {method: "GET"});
            if (response.ok) break;
        } catch (error) {}
        if (Date.now() - startTime > 120000) {
            throw new Error("Timeout waiting for server to start");
        } else {
            log("Waiting for the server to be ready...");
            await sleep(1000);
        }
    }
    log("Server is ready");
    await sleep(1000);
    return proc;
}

async function stopAgent(proc) {
    log("Stopping agent..." + JSON.stringify(proc));
    const q = proc.kill("SIGKILL");
    console.log(q);
}

async function sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function sendPostRequest(url, method, payload) {
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data[0].text;
    } catch (error) {
        throw new Error(`Failed to send message: ${error.message}`);
    }
}

async function send(message) {
    const url = `http://127.0.0.1:3000/${DEFAULT_AGENT_ID}/message`;
    return await sendPostRequest(url, "POST", {
        text: message,
        userId: "user",
        userName: "User"
    });
}

async function runIntegrationTest(fn) {
    const proc = await startAgent();
    try {
        fn();
        log("✓ Test passed");
    } catch (error) {
        log("✗ Test failed");
        logError(error);
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
    log,
    logError
}
