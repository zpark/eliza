import {
    IAgentRuntime,
    Service,
    ServiceType,
    IIrysService,
    UploadIrysResult,
    DataIrysFetchedFromGQL,
    GraphQLTag,
    IrysMessageType,
    generateMessageResponse,
    ModelClass,
    IrysDataType,
    IrysTimestamp
} from "@elizaos/core";
import { Uploader } from "@irys/upload";
import { BaseEth } from "@irys/upload-ethereum";
import { GraphQLClient, gql } from 'graphql-request';
import crypto from 'crypto';

interface NodeGQL {
    id: string;
    address: string;
}

interface TransactionsIdAddress {
    success: boolean;
    data: NodeGQL[];
    error?: string;
}

interface TransactionGQL {
    transactions: {
        edges: {
            node: {
                id: string;
                address: string;
            }
        }[]
    }
}

export class IrysService extends Service implements IIrysService {
    static serviceType: ServiceType = ServiceType.IRYS;

    private runtime: IAgentRuntime | null = null;
    private irysUploader: any | null = null;
    private endpointForTransactionId: string = "https://uploader.irys.xyz/graphql";
    private endpointForData: string = "https://gateway.irys.xyz";

    async initialize(runtime: IAgentRuntime): Promise<void> {
        console.log("Initializing IrysService");
        this.runtime = runtime;
    }

    private async getTransactionId(owners: string[] = null, tags: GraphQLTag[] = null, timestamp: IrysTimestamp = null): Promise<TransactionsIdAddress> {
        const graphQLClient = new GraphQLClient(this.endpointForTransactionId);
        const QUERY = gql`
            query($owners: [String!], $tags: [TagFilter!], $timestamp: TimestampFilter) {
                transactions(owners: $owners, tags: $tags, timestamp: $timestamp) {
                    edges {
                        node {
                            id,
                            address
                        }
                    }
                }
            }
        `;
        try {
            const variables = {
                owners: owners,
                tags: tags,
                timestamp: timestamp
            }
            const data: TransactionGQL = await graphQLClient.request(QUERY, variables);
            const listOfTransactions : NodeGQL[] = data.transactions.edges.map((edge: any) => edge.node);
            console.log("Transaction IDs retrieved")
            return { success: true, data: listOfTransactions };
        } catch (error) {
            console.error("Error fetching transaction IDs", error);
            return { success: false, data: [], error: "Error fetching transaction IDs" };
        }
    }

    private async initializeIrysUploader(): Promise<boolean> {
        if (this.irysUploader) return true;
        if (!this.runtime) return false;

        try {
            const EVM_WALLET_PRIVATE_KEY = this.runtime.getSetting("EVM_WALLET_PRIVATE_KEY");
            if (!EVM_WALLET_PRIVATE_KEY) return false;

            const irysUploader = await Uploader(BaseEth).withWallet(EVM_WALLET_PRIVATE_KEY);
            this.irysUploader = irysUploader;
            return true;
        } catch (error) {
            console.error("Error initializing Irys uploader:", error);
            return false;
        }
    }

    private async fetchDataFromTransactionId(transactionId: string): Promise<DataIrysFetchedFromGQL> {
        console.log(`Fetching data from transaction ID: ${transactionId}`);
        const response = await fetch(`${this.endpointForData}/${transactionId}`);
        if (!response.ok) return { success: false, data: null, error: "Error fetching data from transaction ID" };
        return {
            success: true,
            data: response,
        };
    }

    private async orchestrateRequest(requestMessage: string, tags: GraphQLTag[], timestamp: IrysTimestamp = null): Promise<DataIrysFetchedFromGQL> {
        let serviceCategory = tags.find((tag) => tag.name == "Service-Category")?.values[0];
        let protocol = tags.find((tag) => tag.name == "Protocol")?.values[0];
        let minimumProviders = Number(tags.find((tag) => tag.name == "Minimum-Providers")?.values[0]);
        /*
            Further implementation of the orchestrator
            { name: "Validation-Threshold", values: validationThreshold },
            { name: "Test-Provider", values: testProvider },
            { name: "Reputation", values: reputation },
        */
        const tagsToRetrieve : GraphQLTag[] = [
            { name: "Message-Type", values: [IrysMessageType.DATA_STORAGE] },
            { name: "Service-Category", values: [serviceCategory] },
            { name: "Protocol", values: [protocol] },
        ];

        const data = await this.getDataFromAnAgent([],tagsToRetrieve, timestamp);
        if (!data.success) return { success: false, data: null, error: data.error };
        const dataArray = data.data as Array<any>;
        for (let i = 0; i < dataArray.length; i++) {
            const node = dataArray[i];
            const templateRequest = `
                Determine the truthfulness of the relationship between the given context and text.
                Context: ${requestMessage}
                Text: ${node.data}
                Return True or False
            `;
            const responseFromModel = await generateMessageResponse({
                runtime: this.runtime,
                context: templateRequest,
                modelClass: ModelClass.MEDIUM,
            });
            if (!responseFromModel.success || ((responseFromModel.content?.toString().toLowerCase().includes('false')) && (!responseFromModel.content?.toString().toLowerCase().includes('true')))) {
                dataArray.splice(i, 1);
                i--;
            }
        }
        let responseTags: GraphQLTag[] = [
            { name: "Message-Type", values: [IrysMessageType.REQUEST_RESPONSE] },
            { name: "Service-Category", values: [serviceCategory] },
            { name: "Protocol", values: [protocol] },
            { name: "Request-Id", values: [tags.find((tag) => tag.name == "Request-Id")?.values[0]] },
        ];
        if (dataArray.length == 0) {
            const response = await this.uploadDataOnIrys("No relevant data found from providers", responseTags, IrysMessageType.REQUEST_RESPONSE);
            console.log("Response from Irys: ", response);
            return { success: false, data: null, error: "No relevant data found from providers" };
        }
        const listProviders = new Set(dataArray.map((provider: any) => provider.address));
        if (listProviders.size < minimumProviders) {
            const response = await this.uploadDataOnIrys("Not enough providers", responseTags, IrysMessageType.REQUEST_RESPONSE);
            console.log("Response from Irys: ", response);
            return { success: false, data: null, error: "Not enough providers" };
        }
        const listData = dataArray.map((provider: any) => provider.data);
        const response = await this.uploadDataOnIrys(listData, responseTags, IrysMessageType.REQUEST_RESPONSE);
        console.log("Response from Irys: ", response);
        return {
            success: true,
            data: listData
        }
    }

    // Orchestrator
    private async uploadDataOnIrys(data: any, tags: GraphQLTag[], messageType: IrysMessageType, timestamp: IrysTimestamp = null): Promise<UploadIrysResult> {
        if (!(await this.initializeIrysUploader())) {
            return {
                success: false,
                error: "Irys uploader not initialized",
            };
        }
        tags.push({ name: "Timestamp", values: [new Date().toISOString()] });
        const requestId = crypto.createHash('sha256').update(new Date().toISOString()).digest('hex');
        tags.push({ name: "Request-Id", values: [requestId] });
        try {
            const dataToStore = {
                data: data,
            };

            const receipt = await this.irysUploader.upload(JSON.stringify(dataToStore), { tags: tags });
            if (messageType == IrysMessageType.DATA_STORAGE || messageType == IrysMessageType.REQUEST_RESPONSE) {
                return { success: true, url: `https://gateway.irys.xyz/${receipt.id}`};
            } else if (messageType == IrysMessageType.REQUEST) {
                const response = await this.orchestrateRequest(data, tags, timestamp);
                return {
                    success: response.success,
                    url: `https://gateway.irys.xyz/${receipt.id}`,
                    data: response.data,
                    error: response.error ? response.error : null
                }

            }
            return { success: true, url: `https://gateway.irys.xyz/${receipt.id}` };
        } catch (error) {
            return { success: false, error: "Error uploading to Irys, " + error };
        }
    }

    async uploadFileOrImageOnIrys(data: string, tags: GraphQLTag[]): Promise<UploadIrysResult> {
        if (!(await this.initializeIrysUploader())) {
            return {
                success: false,
                error: "Irys uploader not initialized"
            };
        }

        try {
            const receipt = await this.irysUploader.uploadFile(data, { tags: tags });
            return { success: true, url: `https://gateway.irys.xyz/${receipt.id}` };
        } catch (error) {
            return { success: false, error: "Error uploading to Irys, " + error };
        }
    }

    private normalizeArrayValues(arr: number[], min: number, max?: number): void {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.max(min, max !== undefined ? Math.min(arr[i], max) : arr[i]);
        }
    }

    async workerUploadDataOnIrys(data: any, dataType: IrysDataType, messageType: IrysMessageType, serviceCategory: string[], protocol: string[], validationThreshold: number[] = [], minimumProviders: number[] = [], testProvider: boolean[] = [], reputation: number[] = []): Promise<UploadIrysResult> {
        this.normalizeArrayValues(validationThreshold, 0, 1);
        this.normalizeArrayValues(minimumProviders, 0);
        this.normalizeArrayValues(reputation, 0, 1);

        const tags = [
            { name: "Message-Type", values: [messageType] },
            { name: "Service-Category", values: serviceCategory },
            { name: "Protocol", values: protocol },
            { name: "Validation-Threshold", values: validationThreshold },
            { name: "Minimum-Providers", values: minimumProviders },
            { name: "Test-Provider", values: testProvider },
            { name: "Reputation", values: reputation },
        ] as GraphQLTag[];

        if (dataType == IrysDataType.FILE || dataType == IrysDataType.IMAGE) {
            return await this.uploadFileOrImageOnIrys(data, tags);
        }

        return await this.uploadDataOnIrys(data, tags, messageType);
    }

    async providerUploadDataOnIrys(data: any, dataType: IrysDataType, serviceCategory: string[], protocol: string[]): Promise<UploadIrysResult> {
        const tags = [
            { name: "Message-Type", values: [IrysMessageType.DATA_STORAGE] },
            { name: "Service-Category", values: serviceCategory },
            { name: "Protocol", values: protocol },
        ] as GraphQLTag[];

        if (dataType == IrysDataType.FILE || dataType == IrysDataType.IMAGE) {
            return await this.uploadFileOrImageOnIrys(data, tags);
        }

        return await this.uploadDataOnIrys(data, tags, IrysMessageType.DATA_STORAGE);
    }

    async getDataFromAnAgent(agentsWalletPublicKeys: string[] = null, tags: GraphQLTag[] = null, timestamp: IrysTimestamp = null): Promise<DataIrysFetchedFromGQL> {
        try {
            const transactionIdsResponse = await this.getTransactionId(agentsWalletPublicKeys, tags, timestamp);
            if (!transactionIdsResponse.success) return { success: false, data: null, error: "Error fetching transaction IDs" };
            const transactionIdsAndResponse = transactionIdsResponse.data.map((node: NodeGQL) => node);
            const dataPromises: Promise<any>[] = transactionIdsAndResponse.map(async (node: NodeGQL) => {
                const fetchDataFromTransactionIdResponse = await this.fetchDataFromTransactionId(node.id);
                if (await fetchDataFromTransactionIdResponse.data.headers.get('content-type') == "application/octet-stream") {
                    let data = null;
                    try {
                        data = await fetchDataFromTransactionIdResponse.data.json();
                    } catch (error) {
                        try {
                            data = await fetchDataFromTransactionIdResponse.data.text();
                        } catch (error) {
                            console.log("Error fetching data from transaction ID, ", error);
                        }
                    }
                    return {
                        data: data,
                        address: node.address
                    }
                }
                else {
                    return {
                        data: fetchDataFromTransactionIdResponse.data.url,
                        address: node.address
                    }
                }
            });
            const data = await Promise.all(dataPromises);
            return { success: true, data: data };
        } catch (error) {
            return { success: false, data: null, error: "Error fetching data from transaction IDs " + error };
        }
    }
}

export default IrysService;