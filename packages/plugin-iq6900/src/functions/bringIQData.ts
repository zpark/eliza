import { elizaLogger } from "@elizaos/core";

import { Connection, PublicKey } from "@solana/web3.js";
const network = process.env.IQSOlRPC || "https://api.mainnet-beta.solana.com";
const stringAddress = process.env.IQ_WALLET_ADDRESS;

const connection = new Connection(network, "confirmed");

const iqHost = "https://solanacontractapi.uc.r.appspot.com";

async function fetchDBPDA(): Promise<string> {
    try {
        if (stringAddress) {
            elizaLogger.info("Connecting to Solana...(IQ6900)");
            elizaLogger.info("Your Address:" + stringAddress);
            const response = await fetch(`${iqHost}/getDBPDA/${stringAddress}`);
            const data = await response.json();
            if (response.ok) {
                return data.DBPDA as string;
            }
        }
    } catch (error) {
        console.error("Error fetching PDA:", error);
        return "null";
    }
}

async function convertTextToEmoji(text: string) {
    return text.replace(/\/u([0-9A-Fa-f]{4,6})/g, (match, code) => {
        return String.fromCodePoint(parseInt(code, 16));
    });
}

async function fetchTransactionInfo(txId: string) {
    try {
        const response = await fetch(`${iqHost}/get_transaction_info/${txId}`);
        if (response.ok) {
            const data = await response.json();
            return data.argData;
        }
    } catch (error) {
        elizaLogger.error("Error fetching transaction info:", error);
    }
    return null;
}

async function getTransactionData(transactionData: {
    method: string;
    code: string;
    decode_break: number;
    before_tx: string;
}): Promise<{ data: any; before_tx: string }> {
    if ("code" in transactionData) {
        return {
            data: {
                code: transactionData.code,
                method: transactionData.method,
                decode_break: transactionData.decode_break,
            },
            before_tx: transactionData.before_tx,
        };
    } else {
        return {
            data: "fail",
            before_tx: "fail",
        };
    }
}

async function extractCommitMessage(dataTxid: string): Promise<string> {
    const txInfo = await fetchTransactionInfo(dataTxid);
    if (!txInfo) return "null";

    const type_field = txInfo.type_field || "null";

    if (type_field === "json") {
        const offset = txInfo.offset;
        return offset.split("commit: ")[1];
    } else {
        return "null";
    }
}

async function bringCode(dataTxid: string) {
    const txInfo = await fetchTransactionInfo(dataTxid);
    if (!txInfo)
        return {
            json_data: "false",
            commit_message: "false",
        };

    const tail_tx = txInfo.tail_tx || "null";
    const offset = txInfo.offset || "null";
    let chunks = [];
    let before_tx = tail_tx;
    if (before_tx == "null")
        return {
            json_data: "false",
            commit_message: "false",
        };

    while (before_tx !== "Genesis") {
        if (before_tx) {
            elizaLogger.info("Chunks: " + before_tx);
            const chunk = await fetchTransactionInfo(before_tx);
            if (!chunk) {
                elizaLogger.error("No chunk found.");
                return {
                    json_data: "false",
                    commit_message: "false",
                };
            }

            const chunkData = await getTransactionData(chunk);
            if (chunkData.data == "null") {
                console.error("chunk data undefined");
                return {
                    json_data: "false",
                    commit_message: "false",
                };
            } else {
                chunks.push(chunkData.data.code);
                before_tx = chunkData.before_tx;
            }
        } else {
            console.error("before data undefined");
            return {
                json_data: "false",
                commit_message: "false",
            };
        }
    }

    const textList = chunks.reverse();
    const textData = textList.join("");

    return {
        json_data: await convertTextToEmoji(textData),
        commit_message: offset,
    };
}

async function fetchSignaturesForAddress(
    dbAddress: PublicKey
): Promise<string[]> {
    try {
        elizaLogger.info("Find Your Signature...(IQ6900)");
        const signatures = await connection.getSignaturesForAddress(dbAddress, {
            limit: 20,
        });
        return signatures.map((sig) => sig.signature);
    } catch (error) {
        console.error("Error fetching signatures:", error);
        return [];
    }
}

async function findRecentJsonSignature(): Promise<string> {
    const dbAddress = await fetchDBPDA();
    if (!dbAddress) return;
    const signatures = await fetchSignaturesForAddress(
        new PublicKey(dbAddress)
    );

    for (const signature of signatures) {
        const commit = await extractCommitMessage(signature);
        if (commit !== "null") return signature;
    }
    return;
}

export async function bringAgentWithWalletAddress() {
    const recent = await findRecentJsonSignature();
    if (!recent) {
        elizaLogger.error("Cannot found onchain data in this wallet.");
        return;
    }
    const result = await bringCode(recent);
    const json_string = result.json_data;
    return await json_string;
}
