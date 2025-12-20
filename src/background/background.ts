// Background service worker - message router
import { MessageType, ExtensionMessage } from '../shared/types';
import { WalletManager } from './wallet-manager';
import { SessionManager } from './session-manager';
import {
  handleGenerateWallet,
  handleImportWallet,
  handleImportWalletFromMnemonic,
  handleUnlockWallet,
  handleLockWallet,
  handleResetWallet,
  handleCheckWallet,
  handleExportPrivateKey,
  handleChangePassword,
  handleGetBalance,
  handleEstimateFee,
  handleSendTransaction,
  handleRPCRequest,
  handleConnectionApproval,
  handleTransactionApproval,
  handleSignMessageApproval,
  getPendingRequest,
  handleGetConsolidationInfo,
  handleConsolidateUtxos,
  handleGetConsolidationSettings,
  handleUpdateConsolidationSettings,
  handleMarkConsolidationModalSeen,
  handleGetAutoLockSettings,
  handleUpdateAutoLockSettings,
} from './handlers';

console.log('🦊 Hoosat Wallet background script started');

// Note: secp256k1 initialization is handled automatically by HoosatSigner in SDK

// Wallet manager instance
const walletManager = new WalletManager();

// Session manager instance
const sessionManager = new SessionManager(walletManager);

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

/**
 * Main message router
 */
async function handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<any> {
  const { type, data } = message;

  // Update activity time on any message (except status checks and explicit activity updates)
  if (sessionManager.getIsUnlocked() && type !== 'CHECK_UNLOCK_STATUS' && type !== 'CHECK_WALLET' && type !== 'USER_ACTIVITY') {
    sessionManager.updateActivity();
  }

  switch (type) {
    // RPC requests from DApps
    case MessageType.RPC_REQUEST:
      // Note: handleRPCRequest will check if wallet needs to be unlocked for specific methods
      return handleRPCRequest(data, sender, walletManager, sessionManager);

    case MessageType.TRANSACTION_APPROVED:
      return handleTransactionApproval(data.requestId, true, walletManager, data.customFeeSompi);

    case MessageType.TRANSACTION_REJECTED:
      return handleTransactionApproval(data.requestId, false, walletManager);

    case MessageType.CONNECTION_APPROVED:
      return handleConnectionApproval(data.requestId, true);

    case MessageType.CONNECTION_REJECTED:
      return handleConnectionApproval(data.requestId, false);

    case MessageType.MESSAGE_SIGN_APPROVED:
      return handleSignMessageApproval(data.requestId, true, walletManager);

    case MessageType.MESSAGE_SIGN_REJECTED:
      return handleSignMessageApproval(data.requestId, false, walletManager);

    case MessageType.WALLET_UNLOCKED:
      sessionManager.unlock();
      return { success: true };

    // Wallet handlers
    case 'GENERATE_WALLET':
      return handleGenerateWallet(data, walletManager);

    case 'IMPORT_WALLET':
      return handleImportWallet(data, walletManager);

    case 'IMPORT_WALLET_MNEMONIC':
      return handleImportWalletFromMnemonic(data, walletManager);

    case 'UNLOCK_WALLET':
      const unlockResult = await handleUnlockWallet(data, walletManager);
      sessionManager.unlock();
      return unlockResult;

    case 'LOCK_WALLET':
      const lockResult = await handleLockWallet(walletManager);
      sessionManager.lock();
      return lockResult;

    case 'RESET_WALLET':
      const resetResult = await handleResetWallet(walletManager);
      sessionManager.lock();
      return resetResult;

    case 'CHANGE_PASSWORD':
      const changeResult = await handleChangePassword(data, walletManager);
      if (sessionManager.getIsUnlocked()) {
        sessionManager.resetTimeout();
      }
      return changeResult;

    case 'EXPORT_PRIVATE_KEY':
      return handleExportPrivateKey(data);

    case 'USER_ACTIVITY':
      // Update activity time when user interacts with popup
      if (sessionManager.getIsUnlocked()) {
        sessionManager.updateActivity();
      }
      return { success: true };

    case 'CHECK_WALLET':
      return handleCheckWallet();

    case 'CHECK_UNLOCK_STATUS':
      return sessionManager.getUnlockStatus();

    case 'GET_PENDING_REQUEST':
      const request = getPendingRequest(data.requestId);
      if (!request) {
        throw new Error('Request not found');
      }
      return request;

    // Transaction handlers
    case 'GET_BALANCE':
      return handleGetBalance(data, walletManager);

    case 'ESTIMATE_FEE':
      if (!sessionManager.getIsUnlocked()) {
        throw new Error('Wallet is locked');
      }
      return handleEstimateFee(data, walletManager);

    case 'SEND_TRANSACTION':
      if (!sessionManager.getIsUnlocked()) {
        throw new Error('Wallet is locked');
      }
      return handleSendTransaction(data, walletManager);

    // Consolidation handlers
    case 'GET_CONSOLIDATION_INFO':
      if (!sessionManager.getIsUnlocked()) {
        throw new Error('Wallet is locked');
      }
      return handleGetConsolidationInfo(walletManager);

    case 'CONSOLIDATE_UTXOS':
      if (!sessionManager.getIsUnlocked()) {
        throw new Error('Wallet is locked');
      }
      return handleConsolidateUtxos(walletManager);

    case 'GET_CONSOLIDATION_SETTINGS':
      return handleGetConsolidationSettings();

    case 'UPDATE_CONSOLIDATION_SETTINGS':
      return handleUpdateConsolidationSettings(data);

    case 'MARK_CONSOLIDATION_MODAL_SEEN':
      return handleMarkConsolidationModalSeen();

    // Auto-lock settings
    case 'GET_AUTO_LOCK_SETTINGS':
      return handleGetAutoLockSettings();

    case 'UPDATE_AUTO_LOCK_SETTINGS':
      return handleUpdateAutoLockSettings(data, sessionManager);

    // Misc
    case 'CONTENT_SCRIPT_READY':
      return { success: true };

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

// Export for testing
export { handleMessage };
