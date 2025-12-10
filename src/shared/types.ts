// Shared types for Hoosat Wallet Extension

import { Buffer } from 'buffer';

export interface WalletData {
  address: string;
  encryptedPrivateKey: string;
  createdAt: number;
}

export interface StoredWallet {
  wallets: WalletData[];
  currentWalletIndex: number;
}

export interface UnlockedWallet {
  address: string;
  privateKey: Buffer;
}

export interface DAppRequest {
  id: string;
  origin: string;
  method: string;
  params: any;
  timestamp: number;
}

export interface TransactionRequest {
  to: string;
  amount: number | string;
  fee?: string; // Optional custom fee in sompi
  payload?: string; // Optional transaction payload (will use subnetwork 0x03)
}

export interface ConnectedSite {
  origin: string;
  connectedAt: number;
  permissions: string[];
}

// Transaction history
export interface TransactionHistory {
  txId: string;
  type: 'sent' | 'received';
  amount: string; // sompi
  to?: string;
  from?: string;
  timestamp: number;
  fee?: string; // actual fee paid in sompi
}

// Fee estimate
export interface FeeEstimate {
  fee: string; // sompi
  inputs: number;
  outputs: number;
}

// UTXO Consolidation
export const DEFAULT_CONSOLIDATION_THRESHOLD = 30;

export interface ConsolidationSettings {
  hasSeenModal: boolean; // User has seen the consolidation modal
  autoConsolidate: boolean; // Auto-consolidate when threshold is reached
  threshold: number; // UTXO count threshold
}

// Auto-Lock Settings
export const AUTO_LOCK_TIMEOUTS = [5, 10, 15, 30, 60] as const; // Available timeout options in minutes
export const DEFAULT_AUTO_LOCK_TIMEOUT = 30; // Default: 30 minutes

export interface AutoLockSettings {
  timeoutMinutes: number; // Auto-lock timeout in minutes
}

export interface ConsolidationInfo {
  utxoCount: number;
  currentFee: string; // Fee for normal transaction (sompi)
  consolidationFee: string; // Fee to consolidate all UTXOs (sompi)
  estimatedSavings: string; // Estimated future savings (sompi)
  shouldConsolidate: boolean; // Whether consolidation is recommended
}

// RPC Methods that DApps can call
export enum RPCMethod {
  REQUEST_ACCOUNTS = 'hoosat_requestAccounts',
  GET_ACCOUNTS = 'hoosat_accounts',
  GET_BALANCE = 'hoosat_getBalance',
  SEND_TRANSACTION = 'hoosat_sendTransaction',
  SIGN_MESSAGE = 'hoosat_signMessage',
  GET_NETWORK = 'hoosat_getNetwork',
  DISCONNECT = 'hoosat_disconnect',
}

// Messages between content script, background, and popup
export interface ExtensionMessage {
  type: string;
  data?: any;
}

export enum MessageType {
  // From DApp to Extension
  RPC_REQUEST = 'RPC_REQUEST',

  // From Extension to DApp
  RPC_RESPONSE = 'RPC_RESPONSE',

  // Internal messages
  WALLET_UNLOCKED = 'WALLET_UNLOCKED',
  WALLET_LOCKED = 'WALLET_LOCKED',
  TRANSACTION_APPROVED = 'TRANSACTION_APPROVED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  CONNECTION_APPROVED = 'CONNECTION_APPROVED',
  CONNECTION_REJECTED = 'CONNECTION_REJECTED',
  MESSAGE_SIGN_APPROVED = 'MESSAGE_SIGN_APPROVED',
  MESSAGE_SIGN_REJECTED = 'MESSAGE_SIGN_REJECTED',
}

export interface RPCError {
  code: number;
  message: string;
}

// Standard error codes
export enum ErrorCode {
  USER_REJECTED = 4001,
  UNAUTHORIZED = 4100,
  UNSUPPORTED_METHOD = 4200,
  DISCONNECTED = 4900,
  CHAIN_DISCONNECTED = 4901,
}
