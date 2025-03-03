import { io, type Socket } from 'socket.io-client';
import { logger } from "@elizaos/core";
import type {
  SellSignalMessage,
  BuySignalMessage,
  QuoteParams,
  StartProcessParams,
  AddTransactionParams,
  PriceSignalMessage,
  StartDegenProcessParams
} from '../types';

export class SonarClient {
  private socket: Socket | null = null;
  private apiKey: string;
  private baseUrl = 'https://sonar-ai16z-test.up.railway.app';
  private wsUrl = 'wss://sonar-ai16z-test.up.railway.app';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  connect() {
    try {
      this.socket = io(this.wsUrl, {
        extraHeaders: {
          'x-api-key': this.apiKey,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      this.socket.on('connect', () => {
        logger.info('Connected to Sonar WebSocket:', { socketId: this.socket?.id });
      });

      this.socket.on('connected', (data) => {
        logger.info('Received connected event:', data);
      });

      this.socket.on('connect_error', (error) => {
        logger.error('Sonar WebSocket connection error:', {
          error: error instanceof Error ? error.message : error
        });
      });

      this.socket.on('disconnect', (reason) => {
        logger.warn('Disconnected from Sonar WebSocket:', { reason });
      });

      this.socket.on('error', (error) => {
        logger.error('Sonar WebSocket error:', {
          error: error instanceof Error ? error.message : error
        });
      });

    } catch (error) {
      logger.error('Failed to connect to Sonar WebSocket:', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private async makeRequest(endpoint: string, method: string, data?: any) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`API request failed for ${endpoint}:`, {
        error: error instanceof Error ? error.message : error,
        method,
        data
      });
      throw error;
    }
  }

  async startProcess(params: StartProcessParams) {
    logger.info('Starting process:', params);
    return await this.makeRequest('/ai16z-sol/startProcess', 'POST', {
      id: params.id,
      tokenAddress: params.tokenAddress,
      balance: params.balance,
      isSimulation: params.isSimulation,
      initialMarketCap: params.initialMarketCap,
      recommenderId: params.recommenderId,
      walletAddress: params.walletAddress,
      txHash: params.txHash
    });
  }

  async stopProcess(id: string) {
    logger.info('Stopping process:', { id });
    return await this.makeRequest('/ai16z-sol/stopProcess', 'POST', { id });
  }

  async addTransaction(params: AddTransactionParams) {
    logger.info('Adding transaction:', params);
    return await this.makeRequest('/ai16z-sol/addTransaction', 'POST', {
      id: params.id,
      address: params.address,
      amount: params.amount,
      walletAddress: params.walletAddress,
      isSimulation: params.isSimulation,
      marketCap: params.marketCap,
      recommenderId: params.recommenderId,
      txHash: params.txHash
    });
  }

  async getQuote(params: QuoteParams) {
    logger.info('Getting quote:', params);
    const queryParams = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      walletAddress: params.walletAddress,
      slippageBps: params.slippageBps.toString(),
    });

    return await this.makeRequest(`/ai16z-sol/quote?${queryParams}`, 'GET');
  }

  async startDegenProcess(params: StartDegenProcessParams) {
    logger.info('Starting degen process:', params);
    return await this.makeRequest('/ai16z-sol/startDegenProcess', 'POST', {
      id: params.id,
      tokenAddress: params.tokenAddress,
      balance: params.balance,
      isSimulation: params.isSimulation,
      initialMarketCap: params.initialMarketCap,
      initialPrice: params.initialPrice,
      recommenderId: params.recommenderId,
      walletAddress: params.walletAddress,
      txHash: params.txHash
    });
  }

  async stopDegenProcess(id: string) {
    logger.info('Stopping degen process:', { id });
    return await this.makeRequest('/ai16z-sol/stopDegenProcess', 'POST', { id });
  }

  async addDegenTransaction(params: AddTransactionParams) {
    logger.info('Adding degen transaction:', params);
    return await this.makeRequest('/ai16z-sol/addDegenTransaction', 'POST', {
      id: params.id,
      address: params.address,
      amount: params.amount,
      walletAddress: params.walletAddress,
      isSimulation: params.isSimulation,
      marketCap: params.marketCap,
      recommenderId: params.recommenderId,
      txHash: params.txHash
    });
  }

  onBuySignal(callback: (signal: BuySignalMessage) => void) {
    this.socket?.on('buySignal', (signal) => {
      logger.info('Received buy signal:', signal);
      callback(signal);
    });
  }

  onSellSignal(callback: (signal: SellSignalMessage) => void) {
    this.socket?.on('sellSignal', (signal) => {
      logger.info('Received sell signal:', signal);
      callback(signal);
    });
  }

  onPriceSignal(callback: (signal: PriceSignalMessage) => void) {
    this.socket?.on('priceSignal', (signal) => {
      logger.info('Received price signal:', signal);
      callback(signal);
    });
  }

  disconnect() {
    logger.info('Disconnecting from Sonar WebSocket');
    this.socket?.disconnect();
    this.socket = null;
  }
}