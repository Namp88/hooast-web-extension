// Main popup entry point - router for all screens
import { hasWallet } from '../shared/storage';
import { MessageType } from '../shared/types';
import * as api from '../shared/api/messages';
import { showSuccessMessage, initLanguage, t } from './utils';
import { ICONS } from './utils/icons';
import {
  showWelcomeScreen,
  showGenerateWalletScreen,
  showImportWalletScreen,
  showUnlockScreen,
  showWalletScreen,
  showSendScreen,
  showReceiveScreen,
  showSettingsScreen,
  showLanguageSettingsScreen,
  showUtxoManagementScreen,
  showAutoLockSettingsScreen,
  showChangePasswordScreen,
  showExportKeyScreen,
  showDAppConnectionScreen,
  showConnectedSitesScreen,
  showSignMessageScreen,
  getCurrentBalance,
  getCurrentAddress,
  initWalletData,
  type UnlockContext,
} from './screens';
import { showBackupPrivateKey, showConfirmDialog, showAlertDialog } from './components';
import { showTransactionPreview } from './components/transaction-preview';
import { showConsolidationModal, showConsolidationProgress, showConsolidationSuccess } from './components/consolidation-modal';

console.log('Hoosat Wallet popup loaded');

// State
let isUnlocked = false;

// DOM Elements
const app = document.getElementById('app')!;

// Initialize popup
async function init() {
  console.log('Initializing popup...');

  // Initialize language settings
  await initLanguage();

  // Check if wallet exists
  const walletExists = await hasWallet();

  if (!walletExists) {
    showWelcome();
    return;
  }

  // Check if wallet is unlocked (in background)
  try {
    const status = await api.checkUnlockStatus();

    if (status.isUnlocked) {
      console.log('✅ Wallet is unlocked');
      isUnlocked = true;
    }
  } catch (error) {
    console.log('Could not check unlock status:', error);
  }

  // Check if there's a pending request (priority over showing wallet)
  const session = await chrome.storage.session.get('pendingRequestId');

  if (session.pendingRequestId) {
    try {
      // Get request data from background
      const request = await api.getPendingRequest(session.pendingRequestId);

      // For connection requests, we can show without unlock
      if (request.method === 'hoosat_requestAccounts') {
        await handlePendingRequest(request);
        return;
      }

      // For transaction requests, need to ensure wallet is unlocked first
      if (!isUnlocked) {
        // Show unlock screen, then handle request after unlock
        showUnlockForPendingRequest(request);
        return;
      }

      // Wallet is unlocked, initialize wallet data before handling request
      // This ensures getCurrentAddress() and getCurrentBalance() work
      await initWalletData();

      // Show approval screen
      await handlePendingRequest(request);
      return;
    } catch (error) {
      console.error('Failed to handle pending request:', error);
      // Clear invalid request and continue
      await chrome.storage.session.remove('pendingRequestId');
    }
  }

  // No pending requests - show normal flow
  if (isUnlocked) {
    // Show wallet directly
    await showWallet();
    // Show brief welcome message
    showSuccessMessage(`${ICONS.handWave} ${t('welcomeBack')}`, 1500);
    return;
  }

  // Not unlocked, show unlock screen
  showUnlock();
}

// ============================================================================
// DApp Request Handling
// ============================================================================

/**
 * Handle pending DApp request
 */
async function handlePendingRequest(request: any): Promise<void> {
  const { method } = request;

  if (method === 'hoosat_requestAccounts') {
    // Connection request
    showDAppConnectionScreen(
      app,
      request,
      () => handleConnectionApprove(request.id),
      () => handleConnectionReject(request.id)
    );
  } else if (method === 'hoosat_sendTransaction') {
    // Transaction request - wallet must be unlocked
    if (!isUnlocked) {
      console.error('handlePendingRequest called for transaction while wallet is locked');
      // This shouldn't happen if init() flow is correct, but handle it gracefully
      showUnlock();
      return;
    }

    try {
      const currentAddress = getCurrentAddress();

      if (!currentAddress) {
        throw new Error('No wallet address available');
      }

      // Get balance and estimate fee
      const balance = await api.getBalance(currentAddress);
      const feeEstimate = await api.estimateFee(request.params.to, request.params.amount);

      // Parse amount to HTN
      const amountHTN = typeof request.params.amount === 'number'
        ? request.params.amount
        : parseFloat(request.params.amount) / 100000000;
      const minFeeHTN = parseFloat(feeEstimate.fee) / 100000000;

      // Show wallet screen first (so there's something behind the modal)
      await showWallet();

      // Then show the modal
      const result = await showTransactionPreview({
        to: request.params.to,
        amount: amountHTN,
        minFee: minFeeHTN,
        minFeeSompi: feeEstimate.fee,
        balance: balance,
        inputs: feeEstimate.inputs,
        outputs: feeEstimate.outputs,
        origin: request.origin, // Show which DApp is requesting
        timestamp: request.timestamp, // Show when request was made
      });

      if (result.confirmed) {
        // User approved
        await handleTransactionApprove(request.id, result.customFeeSompi);
      } else {
        // User rejected
        await handleTransactionReject(request.id);
      }
    } catch (error: any) {
      console.error('❌ Failed to prepare transaction approval:', error);

      // Show error to user
      app.innerHTML = `
        <div class="screen">
          <div class="header">
            <h1>❌ ${t('transactionError')}</h1>
          </div>

          <div class="dapp-request-container">
            <div class="error-message">
              <p><strong>${t('failedToProcessTransaction')}</strong></p>
              <p>${error.message || t('unknownError')}</p>
            </div>

            <button id="backBtn" class="btn btn-secondary">${t('backToWallet')}</button>
          </div>
        </div>
      `;

      document.getElementById('backBtn')?.addEventListener('click', async () => {
        // Clear the pending request
        await chrome.storage.session.remove('pendingRequestId');
        // Reject the transaction
        await api.rejectTransaction(request.id);
        // Go to wallet
        await showWallet();
      });
    }
  } else if (method === 'hoosat_signMessage') {
    // Sign message request - wallet must be unlocked
    if (!isUnlocked) {
      console.error('handlePendingRequest called for sign message while wallet is locked');
      // This shouldn't happen if init() flow is correct, but handle it gracefully
      showUnlock();
      return;
    }

    // Show sign message screen
    showSignMessageScreen(
      app,
      request,
      () => handleSignMessageApprove(request.id),
      () => handleSignMessageReject(request.id)
    );
  }
}

/**
 * Handle connection approve
 */
async function handleConnectionApprove(requestId: string): Promise<void> {
  try {
    // Check if wallet is unlocked
    if (!isUnlocked) {
      // Need to unlock first - show unlock screen with custom callback
      // that will approve the connection immediately after unlock
      const session = await chrome.storage.session.get('pendingRequestId');
      const request = await api.getPendingRequest(session.pendingRequestId || requestId);

      const context: UnlockContext = {
        origin: request.origin,
        title: t('approveConnectionTitle'),
        message: t('approveConnectionMessageComplete'),
      };

      showUnlockScreen(
        app,
        async (password: string) => {
          // Unlock the wallet
          await handleUnlock(password, true);

          // Immediately approve the connection (user already confirmed)
          await api.approveConnection(requestId);
          await chrome.storage.session.remove('pendingRequestId');
          showSuccessMessage(`${ICONS.checkCircle} ${t('siteConnectedSuccessfully')}`, 2000);

          // Go to wallet screen
          setTimeout(() => {
            showWallet();
          }, 2000);
        },
        context
      );
      return;
    }

    await api.approveConnection(requestId);
    await chrome.storage.session.remove('pendingRequestId');
    showSuccessMessage(`${ICONS.checkCircle} Site connected successfully!`, 2000);

    // Go to wallet screen
    setTimeout(() => {
      showWallet();
    }, 2000);
  } catch (error: any) {
    console.error('Failed to approve connection:', error);
    const errorEl = document.getElementById('error');
    if (errorEl) {
      errorEl.textContent = error.message || t('failedToApproveConnection');
    }
  }
}

/**
 * Handle connection reject
 */
async function handleConnectionReject(requestId: string): Promise<void> {
  await api.rejectConnection(requestId);
  await chrome.storage.session.remove('pendingRequestId');
  showSuccessMessage(`${ICONS.error} ${t('connectionRejected')}`, 2000);

  // Go back to normal flow
  setTimeout(() => {
    init();
  }, 2000);
}

/**
 * Handle transaction approve
 */
async function handleTransactionApprove(requestId: string, customFeeSompi?: string): Promise<void> {
  await api.approveTransaction(requestId, customFeeSompi);
  await chrome.storage.session.remove('pendingRequestId');
  showSuccessMessage(`${ICONS.checkCircle} ${t('transactionApproved')}`, 2000);

  // Go to wallet screen
  setTimeout(() => {
    showWallet();
  }, 2000);
}

/**
 * Handle transaction reject
 */
async function handleTransactionReject(requestId: string): Promise<void> {
  await api.rejectTransaction(requestId);
  await chrome.storage.session.remove('pendingRequestId');
  showSuccessMessage(`${ICONS.error} ${t('transactionRejected')}`, 2000);

  // Go to wallet screen
  setTimeout(() => {
    showWallet();
  }, 2000);
}

/**
 * Handle sign message approve
 */
async function handleSignMessageApprove(requestId: string): Promise<void> {
  await api.approveSignMessage(requestId);
  await chrome.storage.session.remove('pendingRequestId');
  showSuccessMessage(`${ICONS.checkCircle} ${t('messageSignedSuccessfully')}`, 2000);

  // Go to wallet screen
  setTimeout(() => {
    showWallet();
  }, 2000);
}

/**
 * Handle sign message reject
 */
async function handleSignMessageReject(requestId: string): Promise<void> {
  await api.rejectSignMessage(requestId);
  await chrome.storage.session.remove('pendingRequestId');
  showSuccessMessage(`${ICONS.error} ${t('messageSigningRejected')}`, 2000);

  // Go to wallet screen
  setTimeout(() => {
    showWallet();
  }, 2000);
}

// ============================================================================
// Screen Routers
// ============================================================================

/**
 * Show welcome screen
 */
function showWelcome() {
  showWelcomeScreen(app, showGenerate, showImport);
}

/**
 * Show generate wallet screen
 */
function showGenerate() {
  showGenerateWalletScreen(app, showWelcome, handleGenerateWallet);
}

/**
 * Show import wallet screen
 */
function showImport() {
  showImportWalletScreen(app, showWelcome, handleImportWallet);
}

/**
 * Show unlock screen
 */
function showUnlock() {
  showUnlockScreen(app, handleUnlock);
}

/**
 * Show unlock screen for pending DApp request
 */
function showUnlockForPendingRequest(request: any) {
  // Prepare context based on request type
  let context: UnlockContext = {
    origin: request.origin,
  };

  if (request.method === 'hoosat_requestAccounts') {
    context.title = t('approveConnectionTitle');
    context.message = t('approveConnectionMessage');
  } else if (request.method === 'hoosat_sendTransaction') {
    context.title = t('approveTransactionTitle');
    context.message = t('approveTransactionMessage');
  } else if (request.method === 'hoosat_signMessage') {
    context.title = t('signMessageTitle');
    context.message = t('signMessageMessage');
  }

  showUnlockScreen(
    app,
    async (password: string) => {
      // First unlock the wallet (skip showing wallet screen)
      await handleUnlock(password, true);

      // Then handle the pending request
      try {
        await handlePendingRequest(request);
      } catch (error) {
        console.error('Failed to handle pending request after unlock:', error);
        // Clear invalid request and go to wallet
        await chrome.storage.session.remove('pendingRequestId');
        await showWallet();
      }
    },
    context
  );
}

/**
 * Show main wallet screen
 */
async function showWallet() {
  await showWalletScreen(app, showSend, showReceive, handleLock, showSettings);
}

/**
 * Show send screen
 */
function showSend() {
  const balance = getCurrentBalance();
  showSendScreen(app, balance, showWallet, handleSendSuccess);
}

/**
 * Show receive screen
 */
async function showReceive() {
  const address = getCurrentAddress();
  if (!address) {
    console.error('No address available');
    return;
  }
  await showReceiveScreen(app, address, showWallet, copyAddress);
}

/**
 * Show settings screen
 */
async function showSettings() {
  await showSettingsScreen(app, showWallet, showLanguageSettings, showUtxoManagement, showAutoLockSettings, showChangePassword, showExportKey, showConnectedSites, handleReset);
}

/**
 * Show language settings screen
 */
async function showLanguageSettings() {
  await showLanguageSettingsScreen(app, showSettings);
}

/**
 * Show UTXO management screen
 */
async function showUtxoManagement() {
  await showUtxoManagementScreen(app, showSettings);
}

/**
 * Show auto-lock settings screen
 */
async function showAutoLockSettings() {
  await showAutoLockSettingsScreen(app, showSettings);
}

/**
 * Show connected sites screen
 */
function showConnectedSites() {
  showConnectedSitesScreen(app, showSettings);
}

/**
 * Show change password screen
 */
function showChangePassword() {
  showChangePasswordScreen(app, showSettings, handleChangePassword);
}

/**
 * Show export key screen
 */
function showExportKey() {
  showExportKeyScreen(app, showSettings, handleExportPrivateKey);
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Handle generate wallet
 */
async function handleGenerateWallet(password: string, confirmPassword: string): Promise<void> {
  const response = await api.generateWallet(password);

  // Show the generated private key
  showBackupPrivateKey(app, response.privateKey, response.address, password, async () => {
    isUnlocked = true;
    await showWallet();
    showSuccessMessage(`${ICONS.party} ${t('walletCreatedSuccessfully')}`, 2000);
  });
}

/**
 * Handle import wallet
 */
async function handleImportWallet(privateKey: string, password: string, confirmPassword: string): Promise<void> {
  await api.importWallet(privateKey, password);

  // Auto-unlock with the password user just entered
  await api.unlockWallet(password);

  // Notify background that wallet is unlocked
  await api.notifyWalletUnlocked();

  isUnlocked = true;

  // Show wallet directly
  await showWallet();
  showSuccessMessage(`${ICONS.party} ${t('walletImportedSuccessfully')}`, 2000);
}

/**
 * Handle unlock
 */
async function handleUnlock(password: string, skipShowWallet: boolean = false): Promise<void> {
  await api.unlockWallet(password);

  // Notify background
  await api.notifyWalletUnlocked();

  isUnlocked = true;

  // Show wallet (unless caller wants to handle navigation themselves)
  if (!skipShowWallet) {
    await showWallet();
    // Check if consolidation is needed after showing wallet
    await checkAndShowConsolidationModal();
  } else {
    // Even if we skip showing wallet screen, we need to load the wallet data
    // so getCurrentAddress() and getCurrentBalance() work
    await initWalletData();
  }
}

/**
 * Check if UTXO consolidation is needed and show modal
 */
async function checkAndShowConsolidationModal(): Promise<void> {
  try {
    // Get consolidation settings
    const settingsResponse = await chrome.runtime.sendMessage({
      type: 'GET_CONSOLIDATION_SETTINGS',
    });

    if (!settingsResponse.success) {
      return; // Silently fail - don't block user
    }

    const settings = settingsResponse.data;

    // If user has already seen the modal, don't show it again
    if (settings.hasSeenModal) {
      return;
    }

    // Get consolidation info
    const infoResponse = await chrome.runtime.sendMessage({
      type: 'GET_CONSOLIDATION_INFO',
    });

    if (!infoResponse.success) {
      return; // Silently fail
    }

    const info = infoResponse.data;

    // Show modal if consolidation is recommended
    if (info.shouldConsolidate && info.utxoCount >= settings.threshold) {
      await showConsolidationModal(
        app,
        async () => {
          await handleConsolidation();
        },
        async () => {
          // User clicked "Later" - mark modal as seen
          await chrome.runtime.sendMessage({
            type: 'MARK_CONSOLIDATION_MODAL_SEEN',
          });
        }
      );
    }
  } catch (error) {
    console.error('Failed to check consolidation:', error);
    // Don't block user on error
  }
}

/**
 * Handle UTXO consolidation process
 */
async function handleConsolidation(): Promise<void> {
  try {
    // Get info for progress display
    const infoResponse = await chrome.runtime.sendMessage({
      type: 'GET_CONSOLIDATION_INFO',
    });

    if (!infoResponse.success) {
      throw new Error('Failed to get consolidation info');
    }

    const info = infoResponse.data;

    // Show progress modal
    const progressModal = showConsolidationProgress(app, info.utxoCount, info.consolidationFee);

    // Execute consolidation
    const response = await chrome.runtime.sendMessage({
      type: 'CONSOLIDATE_UTXOS',
    });

    // Remove progress modal
    progressModal.remove();

    if (!response.success) {
      throw new Error(response.error || 'Consolidation failed');
    }

    // response.data is now an array of transaction IDs
    const txIds: string[] = response.data || [];

    // Show success modal
    showConsolidationSuccess(app, info.utxoCount, info.consolidationFee, txIds.length, async () => {
      // Refresh wallet screen to show updated UTXO count
      await showWallet();
    });

    // Mark modal as seen after successful consolidation
    await chrome.runtime.sendMessage({
      type: 'MARK_CONSOLIDATION_MODAL_SEEN',
    });
  } catch (error) {
    console.error('Consolidation failed:', error);
    await showAlertDialog('Error', 'Consolidation failed: ' + (error as Error).message, 'error');
  }
}

/**
 * Handle send success
 */
async function handleSendSuccess(txId: string): Promise<void> {
  await showWallet();
  // Show success message after returning to wallet
  showSuccessMessage(`${t('transactionSentTxId')} ${txId.substring(0, 16)}...`);
}

/**
 * Copy address to clipboard
 */
function copyAddress(): void {
  const address = getCurrentAddress();
  if (!address) return;

  navigator.clipboard.writeText(address).then(() => {
    const btn = document.getElementById('copyBtn');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = `${ICONS.check} ${t('copied')}`;
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 1000);
    }
  });
}

/**
 * Handle change password
 */
async function handleChangePassword(currentPassword: string, newPassword: string, confirmNewPassword: string): Promise<void> {
  await api.changePassword(currentPassword, newPassword);

  // Show success and return to settings
  await showSettings();
  showSuccessMessage(`${ICONS.party} ${t('passwordChangedSuccessfully')}`, 3000);
}

/**
 * Handle export private key
 */
async function handleExportPrivateKey(password: string): Promise<{ privateKey: string; address: string }> {
  return await api.exportPrivateKey(password);
}

/**
 * Handle lock wallet
 */
async function handleLock(): Promise<void> {
  await api.lockWallet();
  isUnlocked = false;
  showUnlock();
}

/**
 * Handle reset wallet
 */
async function handleReset(): Promise<void> {
  const confirmed = await showConfirmDialog(
    t('resetWalletTitle'),
    t('resetWalletConfirm')
  );

  if (confirmed) {
    await api.resetWallet();
    showWelcome();
  }
}

// Listen for new pending requests while popup is open
chrome.storage.session.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }) => {
  if (changes.pendingRequestId) {
    const newRequestId = changes.pendingRequestId.newValue;

    // Only handle if a new request was added (not removed)
    if (newRequestId) {
      console.log('🔔 New pending request detected while popup is open:', newRequestId);

      // Handle async operation
      (async () => {
        try {
          // Get request data from background
          const request = await api.getPendingRequest(newRequestId);

          // Check unlock status
          const status = await api.checkUnlockStatus();
          isUnlocked = status.isUnlocked;

          // Handle request based on method type
          if (request.method === 'hoosat_requestAccounts') {
            // Connection request can be shown without unlock
            await handlePendingRequest(request);
          } else {
            // Transaction or sign message - need unlock first
            if (!isUnlocked) {
              showUnlockForPendingRequest(request);
            } else {
              // Initialize wallet data if needed
              await initWalletData();
              await handlePendingRequest(request);
            }
          }
        } catch (error) {
          console.error('Failed to handle new pending request:', error);
          // Clear invalid request
          await chrome.storage.session.remove('pendingRequestId');
        }
      })();
    }
  }
});

// Listen for wallet lock messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MessageType.WALLET_LOCKED) {
    console.log('🔒 Wallet locked by background - showing unlock screen');
    isUnlocked = false;
    showUnlock();
  }
  // Must return true for async response (even if we don't send one)
  return false;
});

// Reset activity timer on any user interaction in popup
let lastActivityUpdate = 0;
const ACTIVITY_UPDATE_THROTTLE = 10000; // Update at most once per 10 seconds

document.addEventListener('click', () => {
  const now = Date.now();
  if (now - lastActivityUpdate > ACTIVITY_UPDATE_THROTTLE) {
    lastActivityUpdate = now;
    // Notify background of user activity (will reset session timeout)
    chrome.runtime.sendMessage({ type: 'USER_ACTIVITY' }).catch(() => {
      // Ignore errors (popup might be closing)
    });
  }
});

document.addEventListener('input', () => {
  const now = Date.now();
  if (now - lastActivityUpdate > ACTIVITY_UPDATE_THROTTLE) {
    lastActivityUpdate = now;
    chrome.runtime.sendMessage({ type: 'USER_ACTIVITY' }).catch(() => {});
  }
});

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', init);
