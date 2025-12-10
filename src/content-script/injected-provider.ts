/**
 * This file is injected into the page context (not extension context)
 * It provides the window.hoosat object for DApps
 */

// Hoosat Provider for DApps
class HoosatProvider {
  isHoosat: boolean;
  isConnected: boolean;
  private _requestId: number;
  private _pendingRequests: Map<number, { resolve: Function; reject: Function }>;

  constructor() {
    this.isHoosat = true;
    this.isConnected = false;
    this._requestId = 0;
    this._pendingRequests = new Map();

    // Listen for responses from content script
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data.type !== 'HOOSAT_RESPONSE') return;

      const { id, result, error } = event.data;
      const pending = this._pendingRequests.get(id);

      if (pending) {
        this._pendingRequests.delete(id);
        if (error) {
          pending.reject(error);
        } else {
          pending.resolve(result);
        }
      }
    });
  }

  async request(method: string, params: any = {}): Promise<any> {
    const id = ++this._requestId;

    return new Promise((resolve, reject) => {
      this._pendingRequests.set(id, { resolve, reject });

      // Send request to content script
      window.postMessage(
        {
          type: 'HOOSAT_REQUEST',
          id,
          method,
          params,
        },
        '*'
      );

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this._pendingRequests.has(id)) {
          this._pendingRequests.delete(id);
          reject({ code: 4900, message: 'Request timeout' });
        }
      }, 60000);
    });
  }

  // Request connection to wallet (standard Web3 API)
  async requestAccounts(): Promise<string[]> {
    const accounts = await this.request('hoosat_requestAccounts');
    this.isConnected = accounts && accounts.length > 0;
    return accounts;
  }

  // Alias for requestAccounts (alternative method name)
  async connect(): Promise<string[]> {
    return this.requestAccounts();
  }

  // Get connected accounts
  async getAccounts(): Promise<string[]> {
    return this.request('hoosat_accounts');
  }

  // Get balance for address
  async getBalance(address: string): Promise<string> {
    return this.request('hoosat_getBalance', { address });
  }

  // Send transaction
  async sendTransaction(params: { to: string; amount: number | string; fee?: string; payload?: string }): Promise<string> {
    return this.request('hoosat_sendTransaction', params);
  }

  // Sign message
  async signMessage(message: string): Promise<string> {
    return this.request('hoosat_signMessage', { message });
  }

  // Get network
  async getNetwork(): Promise<string> {
    return this.request('hoosat_getNetwork');
  }

  // Disconnect from wallet
  async disconnect(): Promise<void> {
    await this.request('hoosat_disconnect');
    this.isConnected = false;
  }

  // Event listeners (for future implementation)
  on(event: string, callback: Function): void {
    // TODO: Implement event system
  }

  removeListener(event: string, callback: Function): void {
    // TODO: Implement event system
  }
}

// Inject provider into window
(window as any).hoosat = new HoosatProvider();

// Dispatch event to notify DApp that provider is ready
window.dispatchEvent(new Event('hoosat#initialized'));

console.log('🦊 Hoosat Provider injected');
