import assert from 'assert';
import {
    send,
    log,
    logError,
    runIntegrationTest
} from "./testLibrary.mjs";

async function test1() {
    const reply = await send("Hi");
    assert(reply.length > 10);
}

async function test2() {
    // TODO
}

try {
    // const allTests = [test1, test2];
    const allTests = [test2];
    allTests.forEach(runIntegrationTest);
} catch (error) {
    logError(error);
    process.exit(1);
}
