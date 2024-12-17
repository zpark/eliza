import assert from 'assert';
import {
    send,
    log,
    logError,
    runIntegrationTest
} from "./testLibrary.mjs";

async function helloTrump() {
    const reply = await send("Hi");
    assert(reply.length > 10);
}

async function coinbaseTest() {
    // Test Coinbase Commerce charge creation
    const chargeRequest = "Create a charge for $100 USD for Digital Art NFT with description 'Exclusive digital artwork collection'";
    const reply = await send(chargeRequest);

    // Verify the response contains expected charge details
    assert(reply.includes("Charge created successfully"));
    assert(reply.includes("$100 USD")); // Amount verification
    assert(reply.includes("Digital Art NFT")); // Name verification
    assert(reply.includes("Exclusive digital artwork collection")); // Description verification
    assert(reply.includes("hosted_url")); // Verify payment URL is included
}

const testSuite = [helloTrump, coinbaseTest]; // Add tests here
try {
    for (const test of testSuite) await runIntegrationTest(test);
} catch (error) {
    logError(error);
    process.exit(1);
}
