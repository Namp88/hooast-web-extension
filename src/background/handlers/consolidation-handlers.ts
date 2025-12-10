// Consolidation handlers
import { WalletManager } from '../wallet-manager';
import { getConsolidationSettings, saveConsolidationSettings, markConsolidationModalSeen } from '../../shared/storage';
import type { ConsolidationSettings, ConsolidationInfo } from '../../shared/types';

/**
 * Get consolidation information (UTXO count, fees, savings)
 */
export async function handleGetConsolidationInfo(walletManager: WalletManager): Promise<ConsolidationInfo> {
  try {
    const info = await walletManager.getConsolidationInfo();
    return info;
  } catch (error: any) {
    throw new Error(`Failed to get consolidation info: ${error.message}`);
  }
}

/**
 * Execute UTXO consolidation (may create multiple transactions for large UTXO sets)
 */
export async function handleConsolidateUtxos(walletManager: WalletManager): Promise<string[]> {
  try {
    const txIds = await walletManager.consolidateUtxos();
    return txIds;
  } catch (error: any) {
    console.error('❌ Consolidation failed:', error);
    throw new Error(`Consolidation failed: ${error.message}`);
  }
}

/**
 * Get consolidation settings
 */
export async function handleGetConsolidationSettings(): Promise<ConsolidationSettings> {
  try {
    return await getConsolidationSettings();
  } catch (error: any) {
    throw new Error(`Failed to get consolidation settings: ${error.message}`);
  }
}

/**
 * Update consolidation settings
 */
export async function handleUpdateConsolidationSettings(data: Partial<ConsolidationSettings>): Promise<void> {
  try {
    const currentSettings = await getConsolidationSettings();
    const updatedSettings: ConsolidationSettings = {
      ...currentSettings,
      ...data,
    };
    await saveConsolidationSettings(updatedSettings);
  } catch (error: any) {
    throw new Error(`Failed to update consolidation settings: ${error.message}`);
  }
}

/**
 * Mark consolidation modal as seen (user clicked "Later")
 */
export async function handleMarkConsolidationModalSeen(): Promise<void> {
  try {
    await markConsolidationModalSeen();
  } catch (error: any) {
    throw new Error(`Failed to mark modal as seen: ${error.message}`);
  }
}
