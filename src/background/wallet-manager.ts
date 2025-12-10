import { getCurrentWallet } from '../shared/storage';
import { decryptPrivateKey } from '../shared/crypto';
import { DEFAULT_NODE_URL, DEFAULT_NETWORK, SOMPI_PER_HTN } from '../shared/constants';
import type { Network } from '../shared/constants';
import type { UnlockedWallet, FeeEstimate } from '../shared/types';
import { DEFAULT_CONSOLIDATION_THRESHOLD } from '../shared/types';
import { HoosatTxBuilder, HoosatUtils, HoosatWebClient, HoosatCrypto, HoosatSigner } from 'hoosat-sdk-web';

export class WalletManager {
  private client: HoosatWebClient;
  private network: Network;
  private unlockedWallet: UnlockedWallet | null = null;

  constructor() {
    this.network = DEFAULT_NETWORK;
    this.client = new HoosatWebClient({
      baseUrl: 'https://proxy.hoosat.net/api/v1',
      timeout: 30000,
      debug: true,
    });

    console.log('✅ WalletManager initialized');
  }

  private getNodeHost(): string {
    const url = new URL(DEFAULT_NODE_URL);
    return url.hostname;
  }

  private getNodePort(): number {
    const url = new URL(DEFAULT_NODE_URL);
    return parseInt(url.port) || 42420;
  }

  /**
   * Unlock wallet with password
   */
  async unlock(password: string): Promise<string> {
    const walletData = await getCurrentWallet();

    if (!walletData) {
      throw new Error('No wallet found');
    }

    try {
      // Decrypt private key
      const privateKeyHex = decryptPrivateKey(walletData.encryptedPrivateKey, password);

      // Convert hex string to Buffer (now available via webpack polyfill)
      const privateKey = Buffer.from(privateKeyHex, 'hex');

      // Store in memory for session
      this.unlockedWallet = {
        address: walletData.address,
        privateKey,
      };

      console.log('🔓 Wallet unlocked:', walletData.address);
      return walletData.address;
    } catch (error: any) {
      throw new Error('Invalid password');
    }
  }

  /**
   * Lock wallet (clear from memory)
   */
  lock(): void {
    this.unlockedWallet = null;
    console.log('🔒 Wallet locked');
  }

  /**
   * Check if wallet is unlocked
   */
  isUnlocked(): boolean {
    return this.unlockedWallet !== null;
  }

  /**
   * Get balance for address
   */
  async getBalance(address: string): Promise<string> {
    try {
      const result = await this.client.getBalance(address);

      if (!result) {
        throw new Error('Failed to get balance');
      }

      return result.balance;
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Unknown error';
      throw new Error(`Failed to get balance: ${errorMessage}`);
    }
  }

  /**
   * Get UTXOs for address
   */
  async getUtxos(address: string) {
    try {
      const result = await this.client.getUtxos([address]);

      if (!result) {
        throw new Error('Failed to get UTXOs');
      }

      return result.utxos;
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Unknown error';
      throw new Error(`Failed to get UTXOs: ${errorMessage}`);
    }
  }

  /**
   * Calculate transaction fee
   */
  private calculateFee(inputs: number, outputs: number): string {
    return HoosatCrypto.calculateFee(inputs, outputs);
  }

  /**
   * Calculate minimum fee using proxy API
   */
  async calculateMinFee(params: { address?: string; inputs?: number; outputs?: number; payloadSize?: number }): Promise<string> {
    try {
      const response = await fetch('https://proxy.hoosat.net/api/v1/transaction/calculate-min-fee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: params.address,
          inputs: params.inputs,
          outputs: params.outputs,
          payloadSize: params.payloadSize || 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // API returns { success: true, data: { minFee: "123", ... } }
      if (!result || !result.success || !result.data || typeof result.data.minFee === 'undefined') {
        throw new Error('Invalid response from fee calculation API');
      }

      return result.data.minFee.toString();
    } catch (error: any) {
      console.error('❌ Failed to calculate min fee via API:', error);
      // Fallback to local calculation if API fails
      if (params.inputs && params.outputs) {
        return this.calculateFee(params.inputs, params.outputs);
      }
      const errorMessage = error?.message || String(error) || 'Unknown error';
      throw new Error(`Failed to calculate fee: ${errorMessage}`);
    }
  }

  /**
   * Estimate fee for transaction
   */
  async estimateFee(params: { to: string; amount: number | string }): Promise<FeeEstimate> {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }

    try {
      // Validate recipient address
      if (!HoosatUtils.isValidAddress(params.to)) {
        throw new Error('Invalid recipient address');
      }

      // Get UTXOs for current wallet
      const utxos = await this.getUtxos(this.unlockedWallet.address);

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      // Calculate fee based on actual UTXO count
      const numInputs = utxos.length;
      const numOutputs = 2; // recipient + change

      const fee = this.calculateFee(numInputs, numOutputs);

      console.log('💵 Fee estimate:', {
        fee: fee + ' sompi',
        inputs: numInputs,
        outputs: numOutputs,
      });

      return {
        fee,
        inputs: numInputs,
        outputs: numOutputs,
      };
    } catch (error: any) {
      console.error('❌ Failed to estimate fee:', error);
      const errorMessage = error?.message || String(error) || 'Unknown error';
      throw new Error(`Fee estimation failed: ${errorMessage}`);
    }
  }

  /**
   * Send transaction
   */
  async sendTransaction(params: { to: string; amount: number | string; fee?: string }): Promise<string> {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }

    try {
      // Validate recipient address
      if (!HoosatUtils.isValidAddress(params.to)) {
        throw new Error('Invalid recipient address');
      }

      // Convert amount to sompi if needed
      const amountSompi = typeof params.amount === 'string' ? params.amount : Math.floor(params.amount * SOMPI_PER_HTN).toString();

      console.log('💸 Sending transaction:', {
        to: params.to,
        amount: amountSompi,
        customFee: params.fee,
      });

      // Get UTXOs for current wallet
      const utxos = await this.getUtxos(this.unlockedWallet.address);

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      // Calculate total available balance
      const totalAvailable = utxos.reduce((sum, utxo) => {
        return sum + BigInt(utxo.utxoEntry.amount);
      }, BigInt(0));

      console.log('💰 Total available:', totalAvailable.toString(), 'sompi');
      console.log('📊 UTXOs count:', utxos.length);

      // Use custom fee or calculate default
      const numInputs = utxos.length;
      const numOutputs = 2; // recipient + change
      const txFee = params.fee || this.calculateFee(numInputs, numOutputs);

      console.log('💵 Transaction fee:', txFee, 'sompi', params.fee ? '(custom)' : '(auto)');

      // Check if we have enough funds (amount + fee)
      const totalRequired = BigInt(amountSompi) + BigInt(txFee);

      if (totalAvailable < totalRequired) {
        throw new Error(
          `Insufficient funds. Available: ${totalAvailable} sompi, Required: ${totalRequired} sompi (${amountSompi} + ${txFee} fee)`
        );
      }

      // Calculate change
      const change = totalAvailable - totalRequired;
      console.log('💵 Change:', change.toString(), 'sompi');

      // Build transaction
      const txBuilder = new HoosatTxBuilder({ debug: false });

      // Add inputs with private key
      for (const utxo of utxos) {
        txBuilder.addInput(utxo, this.unlockedWallet.privateKey);
      }

      // Add output (recipient)
      txBuilder.addOutput(params.to, amountSompi);

      // Set fee
      txBuilder.setFee(txFee);

      // Add change output
      txBuilder.addChangeOutput(this.unlockedWallet.address);

      // Sign transaction
      console.log('✍️ Signing transaction...');
      const signedTx = txBuilder.sign();

      // Submit transaction
      console.log('📤 Submitting transaction...');
      const result = await this.client.submitTransaction(signedTx);

      if (!result || !result.transactionId) {
        throw new Error('Failed to submit transaction');
      }

      console.log('✅ Transaction sent:', result.transactionId);
      return result.transactionId;
    } catch (error: any) {
      console.error('❌ Failed to send transaction:', error);
      const errorMessage = error?.message || String(error) || 'Unknown error';
      throw new Error(`Transaction failed: ${errorMessage}`);
    }
  }

  /**
   * Get current network
   */
  getNetwork(): string {
    return this.network;
  }

  /**
   * Get current address (if unlocked)
   */
  getCurrentAddress(): string | null {
    return this.unlockedWallet?.address || null;
  }

  /**
   * Sign message for DApp authentication and off-chain actions
   * @param message - The message to sign
   * @returns Hex-encoded signature
   */
  async signMessage(message: string): Promise<string> {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }

    try {
      // Use SDK's HoosatSigner for message signing
      // SDK handles: message prefixing, BLAKE3 hashing, ECDSA signing with security options
      const privateKeyHex = this.unlockedWallet.privateKey.toString('hex');
      const signature = HoosatSigner.signMessage(privateKeyHex, message);

      console.log('✍️ Message signed:', {
        messageLength: message.length,
        signatureLength: signature.length,
      });

      return signature;
    } catch (error: any) {
      console.error('❌ Failed to sign message:', error);
      const errorMessage = error?.message || String(error) || 'Unknown error';
      throw new Error(`Message signing failed: ${errorMessage}`);
    }
  }

  /**
   * Get consolidation information
   */
  async getConsolidationInfo(): Promise<{ utxoCount: number; currentFee: string; consolidationFee: string; estimatedSavings: string; shouldConsolidate: boolean }> {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }

    try {
      const utxos = await this.getUtxos(this.unlockedWallet.address);
      const utxoCount = utxos.length;

      // Calculate current fee (for normal 2-output transaction)
      const currentFee = await this.calculateMinFee({
        inputs: utxoCount,
        outputs: 2,
      });

      // Calculate consolidation fee (all inputs → 1 output)
      const consolidationFee = await this.calculateMinFee({
        inputs: utxoCount,
        outputs: 1,
      });

      // Estimate future savings (rough estimate: ~2000 sompi per UTXO saved)
      const estimatedSavings = (BigInt(utxoCount) * 2000n).toString();

      return {
        utxoCount,
        currentFee,
        consolidationFee,
        estimatedSavings,
        shouldConsolidate: utxoCount >= DEFAULT_CONSOLIDATION_THRESHOLD,
      };
    } catch (error: any) {
      console.error('❌ Failed to get consolidation info:', error);
      const errorMessage = error?.message || String(error) || 'Unknown error';
      throw new Error(`Failed to get consolidation info: ${errorMessage}`);
    }
  }

  /**
   * Consolidate all UTXOs into one or more batches (max 80 inputs per transaction)
   * Returns array of transaction IDs
   */
  async consolidateUtxos(): Promise<string[]> {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }

    const MAX_INPUTS_PER_TX = 80; // Safe limit (node allows 88, we use 80 for margin)
    const txIds: string[] = [];

    try {
      // Get all UTXOs (snapshot - will not refresh during processing)
      const utxos = await this.getUtxos(this.unlockedWallet.address);

      if (utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      if (utxos.length === 1) {
        throw new Error('Only 1 UTXO - consolidation not needed');
      }

      // Calculate number of batches needed
      const numBatches = Math.ceil(utxos.length / MAX_INPUTS_PER_TX);

      // Process UTXOs in batches
      for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
        const startIdx = batchIndex * MAX_INPUTS_PER_TX;
        const endIdx = Math.min(startIdx + MAX_INPUTS_PER_TX, utxos.length);
        const batchUtxos = utxos.slice(startIdx, endIdx);

        // Calculate total amount for this batch
        const batchTotal = batchUtxos.reduce((sum, utxo) => {
          return sum + BigInt(utxo.utxoEntry.amount);
        }, BigInt(0));

        // Calculate fee for this batch
        const fee = await this.calculateMinFee({
          inputs: batchUtxos.length,
          outputs: 1,
        });

        const outputAmount = batchTotal - BigInt(fee);

        if (outputAmount <= 0n) {
          throw new Error(`Batch ${batchIndex + 1}: Fee exceeds total UTXO value`);
        }

        // Build consolidation transaction for this batch
        const txBuilder = new HoosatTxBuilder({ debug: false });

        // Add batch UTXOs as inputs
        for (const utxo of batchUtxos) {
          txBuilder.addInput(utxo, this.unlockedWallet.privateKey);
        }

        // Single output back to our address
        txBuilder.addOutput(this.unlockedWallet.address, outputAmount.toString());

        // Set fee
        txBuilder.setFee(fee);

        // Sign transaction
        const signedTx = txBuilder.sign();

        // Submit transaction
        const result = await this.client.submitTransaction(signedTx);

        if (!result || !result.transactionId) {
          throw new Error(`Failed to submit consolidation transaction for batch ${batchIndex + 1}`);
        }

        txIds.push(result.transactionId);

        // Small delay between batches to avoid overwhelming the node
        if (batchIndex < numBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between batches
        }
      }

      return txIds;
    } catch (error: any) {
      console.error('❌ Failed to consolidate UTXOs:', error);
      const errorMessage = error?.message || String(error) || 'Unknown error';
      throw new Error(`Consolidation failed: ${errorMessage}`);
    }
  }
}
