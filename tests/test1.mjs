import assert from 'assert';
import {
    send,
    log,
    logError,
    runIntegrationTest
} from "./testLibrary.mjs";

// Validation function to check required environment variables
async function validateEnvironment(requiredVars) {
    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
        throw new Error(`Required environment variables not set: ${missing.join(', ')}\nPlease set these variables before running the tests.`);
    }
    return true;
}

async function helloTrump() {
    const reply = await send("Hi");

    assert(reply.length > 0, "Response should not be empty");
    const response = reply[0];
    assert(response.text, "Response should have text property");
    assert(response.text.length > 10, `Response should be longer than 10 characters, is ${reply.length}`);

}

async function coinbaseCreateChargeTest() {
    await validateEnvironment(['COINBASE_COMMERCE_KEY']);

    const chargeRequest = "Create a charge for $100 USD for Digital Art NFT with description 'Exclusive digital artwork collection'";
    const response = await send(chargeRequest);

    // Verify response structure
    assert(Array.isArray(response), "Response should be an array");
    assert(response.length === 2, "Response should contain two messages");

    // Verify initial response
    const initialResponse = response[0];
    assert.strictEqual(initialResponse.action, "CREATE_CHARGE");

    // Verify charge creation response
    const chargeResponse = response[1];
    assert(chargeResponse.text.startsWith("Charge created successfully:"), "Should indicate successful charge creation");
    assert(chargeResponse.text.includes("https://commerce.coinbase.com/pay/"), "Should contain valid Coinbase Commerce URL");

    // Verify attachment structure
    assert(Array.isArray(chargeResponse.attachments), "Should have attachments array");
    assert(chargeResponse.attachments.length === 1, "Should have one attachment");

    const attachment = chargeResponse.attachments[0];
    assert.strictEqual(attachment.source, "coinbase");
    assert.strictEqual(attachment.title, "Coinbase Commerce Charge");
    assert(attachment.id, "Should have an ID");
    assert(attachment.url, "Should have a charge ID URL");
    assert(attachment.description.startsWith("Charge ID:"), "Should have charge ID description");
    assert(attachment.text.startsWith("Pay here:"), "Should have payment URL");
    assert(attachment.text.includes("https://commerce.coinbase.com/pay/"), "Should have valid Coinbase Commerce URL");
}

const testSuite = [helloTrump, coinbaseCreateChargeTest]; // Add tests here
try {
    for (const test of testSuite) await runIntegrationTest(test);
} catch (error) {
    logError(error);
    process.exit(1);
}
