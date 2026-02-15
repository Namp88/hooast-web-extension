/**
 * Typed API helpers for sending messages to background script
 */

import { MessageType } from '../types';

/**
 * Safe wrapper for chrome.runtime.sendMessage with error handling
 */
async function sendMessage(message: any): Promise<any> {
  try {
    // Check if extension context is still valid
    if (!chrome?.runtime?.id) {
      throw new Error('Extension context invalidated. Please reload the extension.');
    }

    return await chrome.runtime.sendMessage(message);
  } catch (error: any) {
    // Handle extension context invalidated error
    if (error.message?.includes('Extension context invalidated') || error.message?.includes('message port closed')) {
      console.error('Extension was reloaded. Please refresh the page.');
      throw new Error('Extension was reloaded. Please refresh the page.');
    }
    throw error;
  }
}

/**
 * Generate new wallet
 */
export async function generateWallet(password: string): Promise<{ address: string; privateKey: string }> {
  const response = await sendMessage({
    type: 'GENERATE_WALLET',
    data: { password },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Import wallet
 */
export async function importWallet(privateKey: string, password: string): Promise<{ address: string }> {
  const response = await sendMessage({
    type: 'IMPORT_WALLET',
    data: { privateKey, password },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Import wallet from mnemonic
 */
export async function importWalletFromMnemonic(mnemonic: string, password: string): Promise<{ address: string }> {
  const response = await sendMessage({
    type: 'IMPORT_WALLET_MNEMONIC',
    data: { mnemonic, password },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Unlock wallet
 */
export async function unlockWallet(password: string): Promise<{ address: string }> {
  const response = await sendMessage({
    type: 'UNLOCK_WALLET',
    data: { password },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Lock wallet
 */
export async function lockWallet(): Promise<void> {
  await sendMessage({ type: 'LOCK_WALLET' });
}

/**
 * Reset wallet
 */
export async function resetWallet(): Promise<void> {
  await sendMessage({ type: 'RESET_WALLET' });
}

/**
 * Get balance
 */
export async function getBalance(address: string): Promise<string> {
  const response = await sendMessage({
    type: 'GET_BALANCE',
    data: { address },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Estimate transaction fee
 */
export async function estimateFee(to: string, amount: number): Promise<any> {
  const response = await sendMessage({
    type: 'ESTIMATE_FEE',
    data: { to, amount },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Send transaction
 */
export async function sendTransaction(to: string, amount: number, fee?: string): Promise<string> {
  const response = await sendMessage({
    type: 'SEND_TRANSACTION',
    data: { to, amount, fee },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Export private key
 */
export async function exportPrivateKey(password: string): Promise<{ privateKey: string; address: string }> {
  const response = await sendMessage({
    type: 'EXPORT_PRIVATE_KEY',
    data: { password },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Change password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await sendMessage({
    type: 'CHANGE_PASSWORD',
    data: { currentPassword, newPassword },
  });

  if (!response.success) {
    throw new Error(response.error);
  }
}

/**
 * Check unlock status
 */
export async function checkUnlockStatus(): Promise<{ isUnlocked: boolean; inGracePeriod: boolean; address?: string }> {
  const response = await sendMessage({ type: 'CHECK_UNLOCK_STATUS' });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Notify wallet unlocked
 */
export async function notifyWalletUnlocked(): Promise<void> {
  await sendMessage({
    type: MessageType.WALLET_UNLOCKED,
  });
}

/**
 * Get pending DApp request
 */
export async function getPendingRequest(requestId: string): Promise<any> {
  const response = await sendMessage({
    type: 'GET_PENDING_REQUEST',
    data: { requestId },
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Approve connection request
 */
export async function approveConnection(requestId: string): Promise<void> {
  const response = await sendMessage({
    type: MessageType.CONNECTION_APPROVED,
    data: { requestId, approved: true },
  });

  if (!response.success) {
    throw new Error(response.error);
  }
}

/**
 * Reject connection request
 */
export async function rejectConnection(requestId: string): Promise<void> {
  const response = await sendMessage({
    type: MessageType.CONNECTION_REJECTED,
    data: { requestId, approved: false },
  });

  if (!response.success) {
    throw new Error(response.error);
  }
}

/**
 * Approve transaction request
 */
export async function approveTransaction(requestId: string, customFeeSompi?: string): Promise<void> {
  const response = await sendMessage({
    type: MessageType.TRANSACTION_APPROVED,
    data: { requestId, approved: true, customFeeSompi },
  });

  if (!response.success) {
    throw new Error(response.error);
  }
}

/**
 * Reject transaction request
 */
export async function rejectTransaction(requestId: string): Promise<void> {
  const response = await sendMessage({
    type: MessageType.TRANSACTION_REJECTED,
    data: { requestId, approved: false },
  });

  if (!response.success) {
    throw new Error(response.error);
  }
}

/**
 * Approve sign message request
 */
export async function approveSignMessage(requestId: string): Promise<void> {
  const response = await sendMessage({
    type: MessageType.MESSAGE_SIGN_APPROVED,
    data: { requestId, approved: true },
  });

  if (!response.success) {
    throw new Error(response.error);
  }
}

/**
 * Reject sign message request
 */
export async function rejectSignMessage(requestId: string): Promise<void> {
  const response = await sendMessage({
    type: MessageType.MESSAGE_SIGN_REJECTED,
    data: { requestId, approved: false },
  });

  if (!response.success) {
    throw new Error(response.error);
  }
}
