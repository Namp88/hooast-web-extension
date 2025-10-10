// Background service worker - manages wallet state and handles RPC requests

import { RPCMethod, MessageType, ExtensionMessage, DAppRequest, ErrorCode, RPCError } from '../shared/types';
import { getCurrentWallet, isOriginConnected, addConnectedSite } from '../shared/storage';
import { WalletManager } from './wallet-manager';

console.log('🦊 Hoosat Wallet background script started');

// Wallet manager instance
const walletManager = new WalletManager();

// Pending requests from DApps (waiting for user approval)
const pendingRequests = new Map<string, DAppRequest>();

// Session state (cleared on extension reload)
let isUnlocked = false;
let sessionTimeout: number | null = null;

// Auto-lock after inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function resetSessionTimeout() {
  if (sessionTimeout) {
    clearTimeout(sessionTimeout);
  }

  sessionTimeout = setTimeout(() => {
    lockWallet();
  }, SESSION_TIMEOUT_MS);
}

function lockWallet() {
  isUnlocked = false;
  walletManager.lock();

  // Notify popup
  chrome.runtime
    .sendMessage({
      type: MessageType.WALLET_LOCKED,
    })
    .catch(() => {
      // Popup might be closed, ignore error
    });

  console.log('🔒 Wallet locked due to inactivity');
}

// Listen to messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  console.log('📨 Received message:', message.type, message.data);

  handleMessage(message, sender)
    .then(response => {
      sendResponse({ success: true, data: response });
    })
    .catch(error => {
      console.error('❌ Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true; // Keep channel open for async response
});

async function handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<any> {
  const { type, data } = message;

  switch (type) {
    case MessageType.RPC_REQUEST:
      return handleRPCRequest(data, sender);

    case MessageType.WALLET_UNLOCKED:
      isUnlocked = true;
      resetSessionTimeout();
      return { success: true };

    case MessageType.TRANSACTION_APPROVED:
      return handleTransactionApproval(data.requestId, true);

    case MessageType.TRANSACTION_REJECTED:
      return handleTransactionApproval(data.requestId, false);

    case MessageType.CONNECTION_APPROVED:
      return handleConnectionApproval(data.requestId, true);

    case MessageType.CONNECTION_REJECTED:
      return handleConnectionApproval(data.requestId, false);

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

async function handleRPCRequest(request: any, sender: chrome.runtime.MessageSender): Promise<any> {
  const { method, params } = request;

  // Get origin from sender
  const origin = new URL(sender.url!).origin;

  console.log(`🌐 RPC request from ${origin}: ${method}`);

  // Check if wallet is unlocked (except for some read-only methods)
  if (!isUnlocked && method !== RPCMethod.GET_NETWORK) {
    throw createRPCError(ErrorCode.UNAUTHORIZED, 'Wallet is locked');
  }

  // Reset session timeout on activity
  resetSessionTimeout();

  switch (method) {
    case RPCMethod.REQUEST_ACCOUNTS:
      return handleRequestAccounts(origin);

    case RPCMethod.GET_ACCOUNTS:
      return handleGetAccounts(origin);

    case RPCMethod.GET_BALANCE:
      return handleGetBalance(params);

    case RPCMethod.SEND_TRANSACTION:
      return handleSendTransaction(origin, params);

    case RPCMethod.GET_NETWORK:
      return handleGetNetwork();

    default:
      throw createRPCError(ErrorCode.UNSUPPORTED_METHOD, `Method not supported: ${method}`);
  }
}

async function handleRequestAccounts(origin: string): Promise<string[]> {
  // Check if already connected
  const isConnected = await isOriginConnected(origin);

  if (isConnected) {
    const wallet = await getCurrentWallet();
    return wallet ? [wallet.address] : [];
  }

  // Need user approval - create pending request
  const requestId = `connect_${Date.now()}`;
  const request: DAppRequest = {
    id: requestId,
    origin,
    method: RPCMethod.REQUEST_ACCOUNTS,
    params: {},
    timestamp: Date.now(),
  };

  pendingRequests.set(requestId, request);

  // Open popup to show connection request
  await openPopupWithRequest(requestId);

  // Wait for user response (timeout after 5 minutes)
  return waitForApproval(requestId, 5 * 60 * 1000);
}

async function handleGetAccounts(origin: string): Promise<string[]> {
  const isConnected = await isOriginConnected(origin);

  if (!isConnected) {
    return [];
  }

  const wallet = await getCurrentWallet();
  return wallet ? [wallet.address] : [];
}

async function handleGetBalance(params: any): Promise<string> {
  const { address } = params;

  if (!address) {
    throw createRPCError(ErrorCode.UNSUPPORTED_METHOD, 'Address is required');
  }

  // Get balance from blockchain
  const balance = await walletManager.getBalance(address);
  return balance;
}

async function handleSendTransaction(origin: string, params: any): Promise<string> {
  // Check if connected
  const isConnected = await isOriginConnected(origin);

  if (!isConnected) {
    throw createRPCError(ErrorCode.UNAUTHORIZED, 'Origin not connected');
  }

  // Validate params
  if (!params.to || params.amount === undefined) {
    throw createRPCError(ErrorCode.UNSUPPORTED_METHOD, 'Invalid transaction params');
  }

  // Create pending request for user approval
  const requestId = `tx_${Date.now()}`;
  const request: DAppRequest = {
    id: requestId,
    origin,
    method: RPCMethod.SEND_TRANSACTION,
    params,
    timestamp: Date.now(),
  };

  pendingRequests.set(requestId, request);

  // Open popup to show transaction request
  await openPopupWithRequest(requestId);

  // Wait for user approval (timeout after 5 minutes)
  return waitForApproval(requestId, 5 * 60 * 1000);
}

async function handleGetNetwork(): Promise<string> {
  return walletManager.getNetwork();
}

async function handleConnectionApproval(requestId: string, approved: boolean): Promise<any> {
  const request = pendingRequests.get(requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  if (approved) {
    await addConnectedSite(request.origin);
    const wallet = await getCurrentWallet();

    // Resolve the promise waiting for approval
    resolveApproval(requestId, wallet ? [wallet.address] : []);
  } else {
    rejectApproval(requestId, createRPCError(ErrorCode.USER_REJECTED, 'User rejected connection'));
  }

  pendingRequests.delete(requestId);

  return { success: true };
}

async function handleTransactionApproval(requestId: string, approved: boolean): Promise<any> {
  const request = pendingRequests.get(requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  if (approved) {
    // Sign and send transaction
    try {
      const txId = await walletManager.sendTransaction(request.params);
      resolveApproval(requestId, txId);
    } catch (error: any) {
      rejectApproval(requestId, createRPCError(ErrorCode.DISCONNECTED, error.message));
    }
  } else {
    rejectApproval(requestId, createRPCError(ErrorCode.USER_REJECTED, 'User rejected transaction'));
  }

  pendingRequests.delete(requestId);

  return { success: true };
}

// Helper: Open popup with pending request
async function openPopupWithRequest(requestId: string): Promise<void> {
  // Store requestId in session for popup to fetch
  await chrome.storage.session.set({ pendingRequestId: requestId });

  // Open popup
  await chrome.action.openPopup();
}

// Helper: Create RPC error
function createRPCError(code: ErrorCode, message: string): RPCError {
  return { code, message };
}

// Approval waiting mechanism
const approvalResolvers = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }
>();

function waitForApproval(requestId: string, timeout: number): Promise<any> {
  return new Promise((resolve, reject) => {
    approvalResolvers.set(requestId, { resolve, reject });

    // Timeout
    setTimeout(() => {
      if (approvalResolvers.has(requestId)) {
        approvalResolvers.delete(requestId);
        reject(createRPCError(ErrorCode.USER_REJECTED, 'Request timeout'));
      }
    }, timeout);
  });
}

function resolveApproval(requestId: string, value: any) {
  const resolver = approvalResolvers.get(requestId);
  if (resolver) {
    resolver.resolve(value);
    approvalResolvers.delete(requestId);
  }
}

function rejectApproval(requestId: string, error: any) {
  const resolver = approvalResolvers.get(requestId);
  if (resolver) {
    resolver.reject(error);
    approvalResolvers.delete(requestId);
  }
}

// Export for testing
export { handleMessage, handleRPCRequest };
