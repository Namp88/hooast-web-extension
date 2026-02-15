import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import { WalletData } from '../../shared/types';
import { DEFAULT_NETWORK } from '../../shared/constants';
import { addWallet, loadWallet, saveWallet, clearAllData, hasWallet, getCurrentWallet } from '../../shared/storage';
import { encryptPrivateKey, decryptPrivateKey } from '../../shared/crypto';
import { MIN_PASSWORD_LENGTH } from '../../shared/constants';
import { WalletManager } from '../wallet-manager';
import { HoosatCrypto } from 'hoosat-sdk-web';
const DERIVATION_METHODS = [
  (accountIndex: number, addressIndex: number) => `m/44'/972'/${accountIndex}'/0/${addressIndex}`,
  (accountIndex: number, addressIndex: number) => `m/44'/111111'/${accountIndex}'/0/${addressIndex}`,
  (accountIndex: number, addressIndex: number) => `m/44'/0'/${accountIndex}'/0/${addressIndex}`,
  (accountIndex: number, addressIndex: number) => `m/44'/1'/${accountIndex}'/0/${addressIndex}`,
  (accountIndex: number, addressIndex: number) => `m/44'/972'/${accountIndex}'/${addressIndex}`,
  (accountIndex: number, addressIndex: number) => `m/44'/972'/0/${addressIndex}`,
  (accountIndex: number, addressIndex: number) => `m/44'/972'/${addressIndex}`,
  (_accountIndex: number, addressIndex: number) => `m/0/${addressIndex}`,
  (_accountIndex: number, addressIndex: number) => `m/0'/0/${addressIndex}`,
  (_accountIndex: number, addressIndex: number) => `m/44'/${addressIndex}`,
];
const MAX_ACCOUNT_INDEX = 0;
const MAX_ADDRESS_INDEX = 10;

function normalizeMnemonic(mnemonic: string): string {
  return mnemonic
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function getAddressesForPrivateKey(privateKeyHex: string): { ecdsa: string; schnorr: string } {
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const publicKey = HoosatCrypto.getPublicKey(privateKey);
  const schnorrPublicKey = Buffer.from(publicKey.slice(1));

  return {
    ecdsa: HoosatCrypto.publicKeyToAddressECDSA(publicKey, DEFAULT_NETWORK),
    schnorr: HoosatCrypto.publicKeyToAddress(schnorrPublicKey, DEFAULT_NETWORK),
  };
}

async function getBalanceSafe(address: string, walletManager: WalletManager): Promise<bigint> {
  try {
    const balance = await walletManager.getBalance(address);
    return BigInt(balance);
  } catch {
    return 0n;
  }
}

async function saveImportedWallet(privateKeyHex: string, address: string, password: string): Promise<{ address: string }> {
  const encryptedPrivateKey = encryptPrivateKey(privateKeyHex, password);

  const walletData: WalletData = {
    address,
    encryptedPrivateKey,
    createdAt: Date.now(),
  };

  await addWallet(walletData);

  console.log('✅ Wallet imported:', address);

  return { address };
}

async function deriveWalletFromMnemonic(
  mnemonic: string,
  walletManager: WalletManager
): Promise<{ privateKeyHex: string; address: string; addressType: 'ecdsa' | 'schnorr' }> {
  const normalized = normalizeMnemonic(mnemonic);
  const words = normalized.split(' ');

  if (words.length !== 12 && words.length !== 24) {
    throw new Error('Mnemonic must be 12 or 24 words');
  }

  if (!bip39.validateMnemonic(normalized)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const seed = bip39.mnemonicToSeedSync(normalized);
  const root = HDKey.fromMasterSeed(seed);

  let fallback: { privateKeyHex: string; address: string; addressType: 'ecdsa' | 'schnorr' } | null = null;

  for (let accountIndex = 0; accountIndex <= MAX_ACCOUNT_INDEX; accountIndex++) {
    for (let addressIndex = 0; addressIndex <= MAX_ADDRESS_INDEX; addressIndex++) {
      for (const pathFor of DERIVATION_METHODS) {
        const path = pathFor(accountIndex, addressIndex);
        try {
          const child = root.derive(path);
          if (!child.privateKey || child.privateKey.length !== 32) {
            continue;
          }

          const privateKeyHex = Buffer.from(child.privateKey).toString('hex');
          const addresses = getAddressesForPrivateKey(privateKeyHex);

          if (!fallback) {
            fallback = { privateKeyHex, address: addresses.ecdsa, addressType: 'ecdsa' };
          }

          const schnorrBalance = await getBalanceSafe(addresses.schnorr, walletManager);
          if (schnorrBalance > 0n) {
            return { privateKeyHex, address: addresses.schnorr, addressType: 'schnorr' };
          }

          const ecdsaBalance = await getBalanceSafe(addresses.ecdsa, walletManager);
          if (ecdsaBalance > 0n) {
            return { privateKeyHex, address: addresses.ecdsa, addressType: 'ecdsa' };
          }
        } catch {
          // Skip invalid paths
        }
      }
    }
  }

  if (!fallback) {
    throw new Error('Failed to derive private key from mnemonic');
  }

  return fallback;
}

/**
 * Generate new wallet
 */
export async function handleGenerateWallet(
  data: { password: string },
  walletManager: WalletManager
): Promise<{ address: string; privateKey: string }> {
  const { password } = data;

  try {
    const keyPair = HoosatCrypto.generateKeyPair('mainnet');

    // Convert private key to hex string
    const privateKeyHex = keyPair.privateKey.toString('hex');
    const address = keyPair.address;

    // Encrypt private key
    const encryptedPrivateKey = encryptPrivateKey(privateKeyHex, password);

    // Create wallet data
    const walletData: WalletData = {
      address,
      encryptedPrivateKey,
      createdAt: Date.now(),
    };

    // Save to storage
    await addWallet(walletData);

    console.log('✅ Wallet generated:', address);

    return { address, privateKey: privateKeyHex };
  } catch (error: any) {
    console.error('❌ Failed to generate wallet:', error);
    throw new Error(error.message || 'Failed to generate wallet');
  }
}

/**
 * Import/Create wallet from private key
 */
export async function handleImportWallet(
  data: { privateKey: string; password: string },
  walletManager: WalletManager
): Promise<{ address: string }> {
  const { privateKey, password } = data;

  try {
    // Validate private key format (hex string)
    if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error('Invalid private key format. Must be 64-character hex string');
    }

    // Derive address from private key using HoosatCrypto
    const keyPair = HoosatCrypto.importKeyPair(privateKey);

    if (!keyPair || !keyPair.address) {
      throw new Error('Failed to derive address from private key');
    }

    const address = keyPair.address;

    // Encrypt private key
    const encryptedPrivateKey = encryptPrivateKey(privateKey, password);

    // Create wallet data
    const walletData: WalletData = {
      address,
      encryptedPrivateKey,
      createdAt: Date.now(),
    };

    // Save to storage
    await addWallet(walletData);

    console.log('✅ Wallet imported:', address);

    return { address };
  } catch (error: any) {
    console.error('❌ Failed to import wallet:', error);
    throw new Error(error.message || 'Failed to import wallet');
  }
}

/**
 * Import/Create wallet from mnemonic
 */
export async function handleImportWalletFromMnemonic(
  data: { mnemonic: string; password: string },
  walletManager: WalletManager
): Promise<{ address: string }> {
  const { mnemonic, password } = data;

  try {
    const derived = await deriveWalletFromMnemonic(mnemonic, walletManager);
    return await saveImportedWallet(derived.privateKeyHex, derived.address, password);
  } catch (error: any) {
    console.error('❌ Failed to import wallet from mnemonic:', error);
    throw new Error(error.message || 'Failed to import wallet');
  }
}

/**
 * Unlock wallet with password
 */
export async function handleUnlockWallet(
  data: { password: string },
  walletManager: WalletManager
): Promise<{ address: string }> {
  const { password } = data;

  try {
    const address = await walletManager.unlock(password);

    console.log('✅ Wallet unlocked via popup:', address);

    return { address };
  } catch (error: any) {
    console.error('❌ Failed to unlock wallet:', error);
    throw new Error(error.message || 'Invalid password');
  }
}

/**
 * Lock wallet
 */
export async function handleLockWallet(walletManager: WalletManager): Promise<{ success: boolean }> {
  walletManager.lock();

  console.log('🔒 Wallet locked via popup');

  return { success: true };
}

/**
 * Reset/Delete wallet
 */
export async function handleResetWallet(walletManager: WalletManager): Promise<{ success: boolean }> {
  try {
    // Clear all data
    await clearAllData();

    // Lock wallet
    walletManager.lock();

    console.log('🗑️ Wallet reset');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to reset wallet:', error);
    throw new Error('Failed to reset wallet');
  }
}

/**
 * Check if wallet exists
 */
export async function handleCheckWallet(): Promise<{ exists: boolean }> {
  const exists = await hasWallet();
  return { exists };
}

/**
 * Export private key (requires password verification)
 */
export async function handleExportPrivateKey(data: { password: string }): Promise<{ privateKey: string; address: string }> {
  const { password } = data;

  try {
    const wallet = await getCurrentWallet();

    if (!wallet) {
      throw new Error('No wallet found');
    }

    // Decrypt private key to verify password
    const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey, password);

    console.log('🔑 Private key exported (password verified)');

    return {
      privateKey,
      address: wallet.address,
    };
  } catch (error: any) {
    console.error('❌ Failed to export private key:', error);
    throw new Error('Invalid password');
  }
}

/**
 * Change wallet password (re-encrypt private key)
 */
export async function handleChangePassword(
  data: { currentPassword: string; newPassword: string },
  walletManager: WalletManager
): Promise<{ success: boolean }> {
  const { currentPassword, newPassword } = data;

  try {
    // Get current wallet
    const storedWallet = await loadWallet();

    if (!storedWallet || storedWallet.wallets.length === 0) {
      throw new Error('No wallet found');
    }

    // Get current wallet data
    const currentWallet = storedWallet.wallets[storedWallet.currentWalletIndex];

    // Verify current password by trying to decrypt
    let privateKey: string;
    try {
      privateKey = decryptPrivateKey(currentWallet.encryptedPrivateKey, currentPassword);
    } catch (error) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    if (!/[A-Z]/.test(newPassword)) {
      throw new Error('New password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(newPassword)) {
      throw new Error('New password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(newPassword)) {
      throw new Error('New password must contain at least one number');
    }

    // Re-encrypt private key with new password
    const newEncryptedPrivateKey = encryptPrivateKey(privateKey, newPassword);

    // Update wallet data
    currentWallet.encryptedPrivateKey = newEncryptedPrivateKey;

    // Save updated wallet
    await saveWallet(storedWallet);

    // If wallet is currently unlocked, update it in memory
    if (walletManager.isUnlocked()) {
      // Unlock with new password to update in-memory state
      await walletManager.unlock(newPassword);
    }

    console.log('✅ Password changed successfully');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to change password:', error);
    throw new Error(error.message || 'Failed to change password');
  }
}
