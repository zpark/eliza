import {
    composeContext,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import solc from "solc";
import { Abi, formatEther, formatUnits, parseUnits } from "viem";
import { initWalletProvider, WalletProvider } from "../providers/wallet";
import { ercContractTemplate } from "../templates";
import {
    IDeployERC1155Params,
    IDeployERC721Params,
    IDeployERC20Params,
} from "../types";
import { compileSolidity } from "../utils/contracts";

export { ercContractTemplate };

export class DeployAction {
    constructor(private walletProvider: WalletProvider) {}

    async compileSolidity(contractName: string, source: string) {
        const solName = `${contractName}.sol`;
        const input = {
            language: "Solidity",
            sources: {
                [solName]: {
                    content: source,
                },
            },
            settings: {
                outputSelection: {
                    "*": {
                        "*": ["*"],
                    },
                },
            },
        };
        elizaLogger.log("Compiling contract...");
        const output = JSON.parse(solc.compile(JSON.stringify(input)));

        // check compile error
        if (output.errors) {
            const hasError = output.errors.some(
                (error) => error.type === "Error"
            );
            if (hasError) {
                elizaLogger.error(
                    `Compilation errors: ${JSON.stringify(output.errors, null, 2)}`
                );
            }
        }

        const contract = output.contracts[solName][contractName];

        if (!contract) {
            elizaLogger.error("Compilation result is empty");
        }

        elizaLogger.log("Contract compiled successfully");
        return {
            abi: contract.abi as Abi,
            bytecode: contract.evm.bytecode.object,
        };
    }

    async deployERC20(deployTokenParams: IDeployERC20Params) {
        elizaLogger.log("deployTokenParams", deployTokenParams);
        const { name, symbol, decimals, totalSupply, chain } =
            deployTokenParams;

        this.walletProvider.switchChain(chain);

        const chainConfig = this.walletProvider.getChainConfigs(chain);
        const publicClient = this.walletProvider.getPublicClient(chain);
        const walletClient = this.walletProvider.getWalletClient(chain);

        try {
            const { abi, bytecode } = await compileSolidity("ERC20Contract");

            if (!bytecode) {
                throw new Error("Bytecode is empty after compilation");
            }

            // check wallet balance
            const balance = await publicClient.getBalance({
                address: this.walletProvider.getAddress(),
            });
            elizaLogger.log(`Wallet balance: ${formatEther(balance)} BNB`);

            if (balance === 0n) {
                elizaLogger.error("Wallet has no BNB for gas fees");
            }

            const totalSupplyWithDecimals = parseUnits(
                totalSupply.toString(),
                decimals
            );
            const hash = await walletClient.deployContract({
                account: this.walletProvider.getAccount(),
                abi,
                bytecode,
                args: [name, symbol, decimals, totalSupplyWithDecimals],
                chain: chainConfig,
            });

            elizaLogger.log("Waiting for deployment transaction...", hash);
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
            });
            const contractAddress = receipt.contractAddress;

            elizaLogger.log("Contract deployed successfully!");
            elizaLogger.log("Contract address:", contractAddress);

            elizaLogger.log("\nToken Information:");
            elizaLogger.log("=================");
            elizaLogger.log(`Name: ${name}`);
            elizaLogger.log(`Symbol: ${symbol}`);
            elizaLogger.log(`Decimals: ${decimals}`);
            elizaLogger.log(
                `Total Supply: ${formatUnits(totalSupplyWithDecimals, decimals)}`
            );

            elizaLogger.log(
                `View on BSCScan: https://testnet.bscscan.com/address/${contractAddress}`
            );

            return {
                address: contractAddress,
            };
        } catch (error) {
            elizaLogger.error("Detailed error:", error);
            throw error;
        }
    }

    async deployERC721(deployNftParams: IDeployERC721Params) {
        elizaLogger.log("deployNftParams", deployNftParams);
        const { baseURI, name, symbol, chain } = deployNftParams;

        this.walletProvider.switchChain(chain);

        const chainConfig = this.walletProvider.getChainConfigs(chain);
        const publicClient = this.walletProvider.getPublicClient(chain);
        const walletClient = this.walletProvider.getWalletClient(chain);

        try {
            const { abi, bytecode } = await compileSolidity("ERC721Contract");
            if (!bytecode) {
                throw new Error("Bytecode is empty after compilation");
            }

            // check wallet balance
            const balance = await publicClient.getBalance({
                address: this.walletProvider.getAddress(),
            });
            elizaLogger.log(`Wallet balance: ${formatEther(balance)} BNB`);

            if (balance === 0n) {
                elizaLogger.error("Wallet has no BNB for gas fees");
            }

            const hash = await walletClient.deployContract({
                account: this.walletProvider.getAccount(),
                abi,
                bytecode,
                args: [name, symbol, baseURI],
                chain: chainConfig,
            });

            elizaLogger.log("Waiting for deployment transaction...", hash);
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
            });

            const contractAddress = receipt.contractAddress;

            elizaLogger.log("Contract deployed successfully!");
            elizaLogger.log("Contract address:", contractAddress);

            return {
                address: contractAddress,
            };
        } catch (error) {
            elizaLogger.error("Deployment failed:", error);
            throw error;
        }
    }

    async deployERC1155(deploy1155Params: IDeployERC1155Params) {
        const { baseURI, name, chain } = deploy1155Params;

        this.walletProvider.switchChain(chain);

        const chainConfig = this.walletProvider.getChainConfigs(chain);
        const publicClient = this.walletProvider.getPublicClient(chain);
        const walletClient = this.walletProvider.getWalletClient(chain);

        try {
            const { bytecode, abi } = await compileSolidity("ERC1155Contract");

            if (!bytecode) {
                throw new Error("Bytecode is empty after compilation");
            }
            // check wallet balance
            const balance = await publicClient.getBalance({
                address: this.walletProvider.getAddress(),
            });
            elizaLogger.log(`Wallet balance: ${formatEther(balance)} BNB`);

            if (balance === 0n) {
                elizaLogger.error("Wallet has no BNB for gas fees");
            }

            const hash = await walletClient.deployContract({
                account: this.walletProvider.getAccount(),
                abi,
                bytecode,
                args: [name, baseURI],
                chain: chainConfig,
            });

            elizaLogger.log("Waiting for deployment transaction...", hash);
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
            });
            const contractAddress = receipt.contractAddress;
            elizaLogger.log("Contract deployed successfully!");
            elizaLogger.log("Contract address:", contractAddress);

            return {
                address: contractAddress,
                name: name,
                baseURI: baseURI,
            };
        } catch (error) {
            elizaLogger.error("Deployment failed:", error);
            throw error;
        }
    }
}

export const deployAction = {
    name: "DEPLOY_TOKEN",
    description:
        "Deploy token contracts (ERC20/721/1155) based on user specifications",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting deploy action...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose context
        const context = composeContext({
            state,
            template: ercContractTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: context,
            modelClass: ModelClass.LARGE,
        });

        elizaLogger.log("content", content);

        const walletProvider = initWalletProvider(runtime);
        const action = new DeployAction(walletProvider);

        const contractType = content.contractType;
        let result;
        switch (contractType.toLocaleLowerCase()) {
            case "erc20":
                result = await action.deployERC20({
                    chain: content.chain,
                    decimals: content.decimals,
                    symbol: content.symbol,
                    name: content.name,
                    totalSupply: content.totalSupply,
                });
                break;
            case "erc721":
                result = await action.deployERC721({
                    chain: content.chain,
                    name: content.name,
                    symbol: content.symbol,
                    baseURI: content.baseURI,
                });
                break;
            case "erc1155":
                result = await action.deployERC1155({
                    chain: content.chain,
                    name: content.name,
                    baseURI: content.baseURI,
                });
                break;
        }

        elizaLogger.log("result: ", result);
        if (result) {
            callback?.({
                text: `Successfully create contract - ${result?.address}`,
                content: { ...result },
            });
        } else {
            callback?.({
                text: `Unsuccessfully create contract`,
                content: { ...result },
            });
        }

        try {
            return true;
        } catch (error) {
            elizaLogger.error("Error in get balance:", error.message);
            callback?.({
                text: `Getting balance failed`,
                content: { error: error.message },
            });
            return false;
        }
    },
    template: ercContractTemplate,
    validate: async (_runtime: IAgentRuntime) => {
        return true;
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "deploy an ERC20 token",
                    action: "DEPLOY_TOKEN",
                },
            },
            {
                user: "user",
                content: {
                    text: "Deploy an ERC721 NFT contract",
                    action: "DEPLOY_TOKEN",
                },
            },
            {
                user: "user",
                content: {
                    text: "Deploy an ERC1155 contract",
                    action: "DEPLOY_TOKEN",
                },
            },
        ],
    ],
    similes: [
        "DEPLOY_ERC20",
        "DEPLOY_ERC721",
        "DEPLOY_ERC1155",
        "CREATE_TOKEN",
    ],
};
