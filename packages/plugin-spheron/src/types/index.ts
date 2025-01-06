import { Content } from "@elizaos/core";

export interface SpheronComputeConfig {
    name: string;
    image: string;
    replicas?: number;
    ports?: Array<{
        containerPort: number;
        servicePort: number;
    }>;
    env?: Array<{
        name: string;
        value: string;
    }>;
    computeResources?: {
        cpu: number;
        memory: string;
        storage: string;
        gpu?: {
            count: number;
            model: string;
        };
    };
    duration?: string;
    mode?: string;
    token?: string;
}

export interface EscrowContent extends Content {
    token: string;
    amount: number;
    operation: "deposit" | "withdraw" | "check";
}

export interface DeploymentContent extends Content {
    operation: "create" | "update" | "close";
    template?: string;
    customizations?: any;
    leaseId?: string;
}

export interface LeaseContent extends Content {
    leaseId: string;
    operation: "close" | "get";
}

export interface YakSwapQuote {
    amounts: bigint[];
    adapters: string[];
    path: string[];
    gasEstimate: bigint;
}

export interface TokenInfo {
    name: string;
    symbol: string;
    decimal: number;
}

export interface BalanceInfo {
    lockedBalance: string;
    unlockedBalance: string;
    token: TokenInfo;
}

export interface LeaseDetails {
    leaseId: string;
    fizzId: string;
    requestId: string;
    resourceAttribute: {
        cpuUnits: number;
        cpuAttributes: any[];
        ramUnits: number;
        ramAttributes: any[];
        gpuUnits: number;
        gpuAttributes: any[];
        endpointsKind: number;
        endpointsSequenceNumber: number;
    };
    acceptedPrice: string;
    providerAddress: string;
    tenantAddress: string;
    startBlock: string;
    startTime: number;
    endTime: number;
    state: string;
}

export interface DeploymentDetails {
    services: {
        [key: string]: {
            name: string;
            available: number;
            total: number;
            observed_generation: number;
            replicas: number;
            updated_replicas: number;
            ready_replicas: number;
            available_replicas: number;
            container_statuses: any[];
            creationTimestamp: string;
        };
    };
    forwarded_ports: {
        [key: string]: Array<{
            host: string;
            port: number;
            externalPort: number;
            proto: string;
            name: string;
        }>;
    };
    ips: null | object;
}

export interface LeaseWithOrderDetails extends LeaseDetails {
    name: string;
    tier: string;
    region?: string;
    token?: {
        symbol?: string;
        decimal?: number;
    };
}

export interface LeaseIds {
    activeLeaseIds: string[];
    terminatedLeaseIds: string[];
    allLeaseIds: string[];
}

export interface LeasesByStateOptions {
    state: "ACTIVE" | "TERMINATED";
    page?: number;
    pageSize?: number;
}

export interface LeasesByStateResponse {
    leases: LeaseWithOrderDetails[];
    activeCount: number;
    terminatedCount: number;
    totalCount: number;
}
