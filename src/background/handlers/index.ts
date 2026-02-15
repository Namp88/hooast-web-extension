// Export all handlers
export {
  handleGenerateWallet,
  handleImportWallet,
  handleImportWalletFromMnemonic,
  handleUnlockWallet,
  handleLockWallet,
  handleResetWallet,
  handleCheckWallet,
  handleExportPrivateKey,
  handleChangePassword,
} from './wallet-handlers';

export { handleGetBalance, handleEstimateFee, handleSendTransaction } from './transaction-handlers';

export { handleRPCRequest, handleConnectionApproval, handleTransactionApproval, handleSignMessageApproval, getPendingRequest } from './rpc-handlers';

export {
  handleGetConsolidationInfo,
  handleConsolidateUtxos,
  handleGetConsolidationSettings,
  handleUpdateConsolidationSettings,
  handleMarkConsolidationModalSeen,
} from './consolidation-handlers';

export { handleGetAutoLockSettings, handleUpdateAutoLockSettings } from './auto-lock-handlers';
