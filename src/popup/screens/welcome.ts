import { t } from '../utils/i18n';
import { ICONS } from '../utils/icons';

/**
 * Show welcome screen with Create/Import wallet options
 */
export function showWelcomeScreen(
  app: HTMLElement,
  onCreateNew: () => void,
  onImport: () => void,
  onImportMnemonic: () => void
): void {
  app.innerHTML = `
    <div class="welcome-hero">
      <!-- Animated Background -->
      <div class="welcome-background">
        <div class="welcome-gradient-orb welcome-orb-1"></div>
        <div class="welcome-gradient-orb welcome-orb-2"></div>
        <div class="welcome-grid-pattern"></div>
        <div class="welcome-particle welcome-particle-1"></div>
        <div class="welcome-particle welcome-particle-2"></div>
        <div class="welcome-particle welcome-particle-3"></div>
        <div class="welcome-particle welcome-particle-4"></div>
        <div class="welcome-particle welcome-particle-5"></div>
        <div class="welcome-particle welcome-particle-6"></div>
      </div>

      <!-- Main Content -->
      <div class="welcome-container">
        <!-- Brand Section -->
        <div class="welcome-brand">
          <img src="icons/icon48.png" class="welcome-logo" alt="Hoosat" />
          <h1 class="welcome-title">
            <span class="text-gradient">${t('appName')}</span>
          </h1>
          <p class="welcome-subtitle">${t('welcomeDescription')}</p>
        </div>

        <!-- Wallet Options -->
        <div class="welcome-options">
          <button id="createNewBtn" class="welcome-option-btn">
            <div class="welcome-option-icon">${ICONS.wand}</div>
            <div class="welcome-option-content">
              <div class="welcome-option-title">${t('createNewWallet')}</div>
              <div class="welcome-option-desc">${t('createNewWalletDesc')}</div>
            </div>
            <div class="welcome-option-arrow">${ICONS.chevronRight}</div>
          </button>

          <button id="importBtn" class="welcome-option-btn">
            <div class="welcome-option-icon">${ICONS.download}</div>
            <div class="welcome-option-content">
              <div class="welcome-option-title">${t('importExistingWallet')}</div>
              <div class="welcome-option-desc">${t('importExistingWalletDesc')}</div>
            </div>
            <div class="welcome-option-arrow">${ICONS.chevronRight}</div>
          </button>

          <button id="importMnemonicBtn" class="welcome-option-btn">
            <div class="welcome-option-icon">${ICONS.key}</div>
            <div class="welcome-option-content">
              <div class="welcome-option-title">${t('importExistingWallet')}</div>
              <div class="welcome-option-desc">${t('importMnemonicWalletDesc')}</div>
            </div>
            <div class="welcome-option-arrow">${ICONS.chevronRight}</div>
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('createNewBtn')!.addEventListener('click', onCreateNew);
  document.getElementById('importBtn')!.addEventListener('click', onImport);
  document.getElementById('importMnemonicBtn')!.addEventListener('click', onImportMnemonic);
}
