# 🦊 Hoosat Wallet - Browser Extension

<div align="center">

![Hoosat Wallet](src/icons/icon128.png)

**A secure, non-custodial browser extension wallet for the Hoosat blockchain**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.2-blue)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)](https://chrome.google.com/webstore)
[![SDK Version](https://img.shields.io/badge/hoosat--sdk--web-0.1.4-blue)](https://www.npmjs.com/package/hoosat-sdk-web)

[Features](#features) • [Installation](#installation) • [Development](#development) • [DApp Integration](#-dapp-integration) • [Security](#security)

</div>

---

## 📋 Overview

Hoosat Wallet is a powerful browser extension that allows you to securely manage your HTN (Hoosat) tokens directly from your browser. Built with TypeScript and powered by [hoosat-sdk-web](https://www.npmjs.com/package/hoosat-sdk-web), it provides a seamless interface for interacting with the Hoosat blockchain and decentralized applications.

## ✨ Features

### 🔐 Security
- **AES-256 Encryption** - Military-grade private key encryption
- **Password Protection** - Strong password requirements enforced
- **Auto-lock** - Automatic wallet locking after 30 minutes of inactivity
- **Grace Period** - 2-minute grace period for quick re-access
- **Message Signing** - ECDSA signatures with BLAKE3 hashing

### 💼 Wallet Management
- **Create Wallet** - Generate new wallets with secure random keys
- **Import Wallet** - Import existing wallets via private key
- **Import from Mnemonic** - Restore wallets using 12 or 24 word phrases
- **Password Management** - Change password with validation
- **Private Key Export** - Secure key backup with password verification

### 💸 Transactions
- **Send HTN** - Easy transaction creation with fee customization
- **Receive HTN** - Generate QR codes for receiving payments
- **Fee Estimation** - Automatic and manual fee control
- **UTXO Selection** - Uses only required inputs to avoid oversized transactions
- **Balance Display** - Real-time balance updates
- **Custom Fees** - Adjust transaction fees (with warnings for high fees)
- **UTXO Consolidation** - Smart UTXO management to reduce transaction fees
  - Automatic detection when UTXOs reach threshold (30+)
  - One-click consolidation with fee breakdown
  - Optional auto-consolidation for hands-free management
  - Real-time UTXO count and savings estimation

### 🌐 DApp Integration
- **Connection Management** - Approve/reject DApp connections
- **Connected Sites** - View and manage connected DApps
- **Disconnect Feature** - DApps can programmatically disconnect from wallet
- **Transaction Signing** - Approve transactions from DApps
- **Message Signing** - Sign messages for authentication and off-chain actions
- **Real-time Requests** - Instant notification when DApps make requests
- **Request Timestamps** - Track when requests were made (with warnings for old requests)

### 🎨 User Experience
- **Modern UI** - Clean, intuitive interface with smooth animations
- **Compact Design** - Optimized spacing and layout
- **Hover States** - Visual feedback on all interactive elements
- **Loading States** - Clear indication of ongoing operations
- **Error Handling** - User-friendly error messages
- **Responsive Design** - Works seamlessly in popup window
- **Multi-language Support** - Available in 10 languages:
  - English, Russian, Chinese (Simplified), Spanish, Finnish
  - Japanese, Korean, Turkish, German, Bulgarian
- **Language Switcher** - Change language in Settings without reload

## 🚀 Installation

### From Chrome Web Store

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue?logo=google-chrome)](https://chromewebstore.google.com/detail/djcpncochmpbipoiblkafkjfbfolnkom)

[Install Hoosat Wallet](https://chromewebstore.google.com/detail/djcpncochmpbipoiblkafkjfbfolnkom) directly from the Chrome Web Store.

### Manual Installation (Developer Mode)

1. Download the latest release from [Releases](https://github.com/Namp88/hoosat-web-extension/releases)
2. Extract the ZIP file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (top right corner)
5. Click "Load unpacked"
6. Select the extracted `dist` folder

## 🛠️ Development

### Prerequisites

- Node.js 20+ and npm
- TypeScript knowledge
- Chrome/Chromium browser

### Setup

```bash
# Clone repository
git clone https://github.com/Namp88/hoosat-web-extension.git
cd hoosat-web-extension

# Install dependencies
npm install

# Build for production
npm run build

# Build for development (with watch mode)
npm run dev
```

### Building

```bash
# Production build
npm run build

# Development build with watch
npm run dev

# Clean build directory
npm run clean
```

### Loading in Browser

1. Build the extension: `npm run build`
2. Open Chrome: `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

### Testing with DApps

The repository includes a comprehensive test DApp (`test-dapp.html`) that demonstrates all wallet features:

1. Build and load the extension
2. Open `test-dapp.html` in your browser
3. Test connection, transactions, message signing, and more
4. View detailed console logs for debugging

## 🌐 DApp Integration

### For DApp Developers

The extension injects a `window.hoosat` provider into web pages, providing a standard Web3-like API:

#### Quick Start

```javascript
// Check if Hoosat Wallet is installed
if (window.hoosat) {
  console.log('Hoosat Wallet detected!');
}

// Wait for provider initialization
window.addEventListener('hoosat#initialized', () => {
  console.log('Hoosat provider ready');
});
```

#### Connection

```javascript
// Request connection to wallet (shows approval popup)
try {
  const accounts = await window.hoosat.requestAccounts();
  console.log('Connected:', accounts[0]);
  // Returns: ["hoosat:qp..."]
} catch (error) {
  console.error('Connection rejected:', error);
}

// Alternative method
const accounts = await window.hoosat.connect();

// Get connected accounts (no popup)
const accounts = await window.hoosat.getAccounts();
// Returns: ["hoosat:qp..."] or [] if not connected

// Disconnect from wallet
try {
  await window.hoosat.disconnect();
  console.log('Disconnected successfully');
  // Site is removed from Connected Sites in the wallet
} catch (error) {
  console.error('Disconnect failed:', error);
}
```

**When to use disconnect:**
- User logs out from your DApp
- User switches to a different wallet
- Session expires or becomes invalid
- User explicitly requests to disconnect

**Benefits:**
- Keeps the wallet's Connected Sites list clean
- Better user privacy and security
- Clear connection state management
- Professional UX (similar to MetaMask, WalletConnect)

#### Balance

```javascript
// Get balance for address
const balance = await window.hoosat.getBalance(address);
console.log('Balance:', balance, 'sompi');

// Convert to HTN
const balanceHTN = parseInt(balance) / 100000000;
console.log('Balance:', balanceHTN, 'HTN');
```

#### Send Transaction

```javascript
// Send transaction (shows approval popup)
try {
  const txId = await window.hoosat.sendTransaction({
    to: 'hoosat:qp...',      // Recipient address
    amount: 150000000,        // Amount in sompi (1.5 HTN)
    fee: '1000'              // Optional: Custom fee in sompi
  });

  console.log('Transaction sent:', txId);
  // Returns: "2a3b4c5d..."
} catch (error) {
  console.error('Transaction failed:', error);
  // User rejected or insufficient funds
}
```

#### Sign Message

```javascript
// Sign message for authentication or off-chain actions
try {
  const signature = await window.hoosat.signMessage('Hello World');
  console.log('Signature:', signature);
  // Returns: "3045022100ab12cd34ef..." (128 hex chars)

  // Use signature for authentication
  await fetch('/api/auth', {
    method: 'POST',
    body: JSON.stringify({
      message: 'Hello World',
      signature: signature,
      address: accounts[0]
    })
  });
} catch (error) {
  console.error('Signing rejected:', error);
}
```

#### Network Info

```javascript
// Get current network
const network = await window.hoosat.getNetwork();
console.log('Network:', network); // "mainnet" or "testnet"
```

### API Reference

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `requestAccounts()` | - | `Promise<string[]>` | Request connection (shows popup) |
| `connect()` | - | `Promise<string[]>` | Alias for requestAccounts |
| `getAccounts()` | - | `Promise<string[]>` | Get connected accounts (no popup) |
| `disconnect()` | - | `Promise<void>` | Disconnect from wallet (removes from Connected Sites) |
| `getBalance(address)` | `address: string` | `Promise<string>` | Get balance in sompi |
| `sendTransaction(params)` | `{to, amount, fee?}` | `Promise<string>` | Send transaction, returns TX ID |
| `signMessage(message)` | `message: string` | `Promise<string>` | Sign message, returns signature |
| `getNetwork()` | - | `Promise<string>` | Get current network |

### Events

```javascript
// Listen for provider initialization
window.addEventListener('hoosat#initialized', () => {
  console.log('Provider ready');
});
```

### Error Handling

```javascript
try {
  const result = await window.hoosat.sendTransaction({...});
} catch (error) {
  // Standard error format
  console.error(error.code);    // Error code (e.g., 4001)
  console.error(error.message); // Human-readable message

  // Common error codes:
  // 4001 - User rejected request
  // 4100 - Unauthorized (not connected)
  // 4900 - Disconnected
  // 4901 - Chain disconnected
}
```

### Message Signing Use Cases

Message signing enables various off-chain authentication scenarios:

1. **"Sign in with Hoosat"** - Passwordless authentication
2. **Proof of ownership** - Prove you control an address
3. **DAO voting** - Off-chain governance signatures
4. **Marketplace listings** - Sign item listings without gas fees
5. **Session tokens** - Create verifiable session credentials

Example authentication flow:

```javascript
// Frontend
const challenge = await fetch('/api/auth/challenge').then(r => r.json());
const signature = await window.hoosat.signMessage(challenge.message);
const token = await fetch('/api/auth/verify', {
  method: 'POST',
  body: JSON.stringify({ challenge, signature, address })
}).then(r => r.json());

// Backend (using hoosat-sdk)
import { HoosatSigner } from 'hoosat-sdk';
const isValid = HoosatSigner.verifyMessage(signature, message, publicKey);
```

## 🔐 Security

### Encryption & Key Management

- **AES-256-GCM** - Private keys encrypted with industry-standard algorithm
- **PBKDF2** - Password-based key derivation (100,000 iterations)
- **Local Storage** - Keys never leave your device
- **Session Management** - Automatic locking after inactivity
- **No Analytics** - Zero data collection or tracking

### Message Signing Security

- **Message Prefixing** - Prevents transaction replay attacks
- **BLAKE3 Hashing** - Fast, secure cryptographic hashing
- **ECDSA Signatures** - secp256k1 curve (same as Bitcoin/Ethereum)
- **Deterministic Signing** - RFC6979 compliance for reproducibility
- **Signature Malleability Protection** - BIP-62 lowS enforcement

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Best Practices

⚠️ **IMPORTANT SECURITY NOTES:**

- **NEVER share your private key** with anyone
- **BACKUP your private key** in a secure, offline location
- **Use a strong, unique password** to encrypt your wallet
- **Keep your password safe** - it cannot be recovered if lost
- **Verify all transactions** and messages before signing
- **Check DApp origin** - Only connect to websites you trust
- **Review connected sites** regularly in Settings
- **Be cautious of old requests** - Look for timestamp warnings

## 📦 Dependencies

### Core Libraries

- [hoosat-sdk-web](https://www.npmjs.com/package/hoosat-sdk-web) ^0.1.4 - Hoosat blockchain SDK
  - Transaction building and signing
  - BLAKE3 cryptography
  - Address validation
  - Message signing (ECDSA + secp256k1)
- [crypto-js](https://www.npmjs.com/package/crypto-js) ^4.2.0 - AES encryption
- [buffer](https://www.npmjs.com/package/buffer) ^6.0.3 - Node.js Buffer polyfill

### Development Tools

- TypeScript 5.4+
- Webpack 5
- ts-loader
- Chrome Extension Manifest V3

## 🗺️ Roadmap

### ✅ Completed (v0.3.4)

- [x] **UTXO Consolidation** - Smart UTXO management with automatic detection
  - Automatic notification when UTXOs ≥ 30
  - Fee breakdown and savings estimation
  - Manual consolidation via Settings
  - Optional auto-consolidation feature
- [x] **Multi-language Support** - Full internationalization (i18n)
  - 9 languages supported
  - Language switcher in Settings
  - Smooth language switching without reload
- [x] **Enhanced Modals** - Styled alert/confirm dialogs matching wallet theme
- [x] **Fee Calculation API** - Integration with proxy.hoosat.net for accurate fees

### ✅ Completed (v0.3.0)

- [x] **hoosat-sdk-web integration** - Refactored message signing to use official SDK
- [x] **Message signing** (ECDSA + BLAKE3) - Full implementation with security best practices
- [x] **Connected Sites management** - View and disconnect from connected DApps
- [x] **Programmatic disconnect** - DApps can disconnect themselves via API
- [x] **Request timestamps** with age warnings - Security warnings for old requests
- [x] **Real-time request detection** - Instant DApp request notifications
- [x] **UI/UX improvements** - Compact layout, hover states, smooth animations
- [x] **Error handling** - Robust handling of extension context invalidation
- [x] **DApp connection flow** - Allow connection without wallet unlock requirement

### ✅ Completed (v0.2.x)

- [x] Basic wallet functionality (create/import/export)
- [x] Send/Receive transactions with fee customization
- [x] DApp integration API
- [x] Connection management
- [x] Transaction approval flow

### 🚧 In Progress

- [ ] Transaction history
- [ ] Multi-account support
- [ ] Address book

### 📋 Planned

- [ ] ENS-like name resolution
- [ ] Mobile browser support
- [ ] Dark mode
- [ ] HD Wallet import (.kpk file support)

## 🧪 Testing

The project includes a comprehensive test DApp that demonstrates all features:

- ✅ Connection flow
- ✅ Disconnect functionality
- ✅ Balance queries
- ✅ Transaction sending
- ✅ Message signing
- ✅ Authentication flows
- ✅ Error handling
- ✅ Edge cases (special characters, empty messages, etc.)

Open `test-dapp.html` in your browser to test all functionality.

### 🐞 Debugging from VS Code

You can run and debug the extension directly from VS Code while working inside WSL.

1. Run the `webpack: build` task (`Terminal > Run Task…`) to populate `dist/` before debugging; the Webpack config now emits `cheap-module-source-map` when `npm run dev` is run manually, so you can also start the `webpack: watch` task in another terminal if you want live recompilation while you interact with the extension.
2. Open the Run and Debug panel (`Ctrl+Shift+D`) and pick `Chrome: Debug Hoosat extension`. The launch configuration:
   * Starts Windows Chrome with a clean profile (`userDataDir` points to `%TEMP%\hoosat-vscode-profile`).
   * Enables remote debugging on port `9222`.
   * Loads your built extension from `\\wsl$\<distro>\home\<user>\hoosat-web-extension\dist`—adjust the path or set `${env:WSL_DISTRO_NAME}`/`${env:USER}` if you use a different distro or account.
   * Opens `chrome://extensions/` so you can enable **Developer mode**, keep the “Hoosat Wallet” extension loaded, and inspect its service worker via the “Service worker” link.
3. With the extension loaded, use Chrome DevTools (triggered from VS Code via the launch config or manually from `chrome://extensions`) to inspect the service worker, popup, and content scripts, set breakpoints, and step through your TypeScript (source maps map you back to `src/`).
4. If Chrome launches from a different location on your machine, edit `.vscode/launch.json` to update `runtimeExecutable`. If you need a different extension folder, update the `--load-extension` argument accordingly.

Reload the extension page after each rebuild. If you rely on `webpack: watch` for live updates, keep that task running in a separate terminal and reload Chrome after the watcher finishes a rebuild; otherwise rerun `webpack: build` before debugging to produce the latest `dist/` assets. When the service worker is active, VS Code’s debugger can pause inside `background.ts` or any module you attach to.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Hoosat blockchain](https://github.com/Hoosat-Oy) team for the excellent SDK
- [@noble/secp256k1](https://github.com/paulmillr/noble-secp256k1) for cryptographic primitives
- Open source community
- All contributors and testers

## 📞 Support

- **GitHub Issues**: [Report a bug](https://github.com/Namp88/hoosat-web-extension/issues)
- **Documentation**: [Wiki](https://github.com/Namp88/hoosat-web-extension/wiki)
- **Hoosat Community**: [Discord](https://discord.gg/hoosat) | [Telegram](https://t.me/hoosat)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. Follow the existing code style
2. Write meaningful commit messages
3. Test your changes thoroughly
4. Update documentation as needed
5. Use TypeScript strict mode

## ⚠️ Disclaimer

This wallet is provided "as is" without warranty of any kind. Always do your own research and use at your own risk. Never invest more than you can afford to lose.

**Security Notes:**
- This is beta software - use at your own risk
- Always backup your private keys
- Test with small amounts first
- Verify all transactions before confirming

---

<div align="center">

Made with ❤️ for the Hoosat community

**Version 0.3.4** | [Changelog](CHANGELOG.md) | [GitHub](https://github.com/Namp88/hoosat-web-extension)

</div>
