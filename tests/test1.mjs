import assert from 'assert';
import {
    send
} from "./testLibrary.mjs";

async function test1() {
    const reply = await send("Hi");
    assert(reply.length > 10);
}

async function test2() {
    // TODO
}

try {
    const allTests = [test1, test2];
    allTests.forEach(runIntegrationTest);
} catch (error) {
    console.error(`Error: ${error.message}`);
    console.log(error);
    process.exit(1);
}
