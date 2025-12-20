import { ICONS } from '../utils/icons';
import { addPasswordStrengthIndicator, validateAndCheckPasswordStrength } from '../utils';
import { t } from '../utils/i18n';
import { displayError, clearError, validatePasswordMatch } from '../utils/error-handler';
import { addEnterKeyHandler } from '../utils/keyboard';
import { executeWithButtonLoading } from '../utils/button-state';

/**
 * Show import wallet from mnemonic screen
 */
export function showImportMnemonicScreen(
  app: HTMLElement,
  onBack: () => void,
  onImport: (mnemonic: string, password: string, confirmPassword: string) => Promise<void>
): void {
  app.innerHTML = `
    <div class="create-import-hero">
      <!-- Static Background -->
      <div class="create-import-background">
        <div class="create-import-gradient-orb create-import-orb-1"></div>
        <div class="create-import-gradient-orb create-import-orb-2"></div>
        <div class="create-import-grid-pattern"></div>
      </div>

      <!-- Container -->
      <div class="create-import-container">
        <!-- Header -->
        <div class="create-import-header">
          <button id="backBtn" class="create-import-back-btn">${ICONS.back}</button>
          <div class="create-import-header-title">
            <img src="icons/icon48.png" class="create-import-header-icon" alt="Hoosat" />
            <h1>${t('importMnemonicTitle')}</h1>
          </div>
          <div class="hero-header-spacer"></div>
        </div>

        <!-- Content -->
        <div class="create-import-content">
          <!-- Form Card -->
          <div class="create-import-card">
            <div class="create-import-form-group">
              <label for="mnemonic">${t('mnemonicPhrase')}</label>
              <textarea id="mnemonic" rows="3" placeholder="${t('enterMnemonicPhrase')}" autocomplete="off"></textarea>
            </div>

            <div class="create-import-form-group">
              <label for="password">${t('password')}</label>
              <input type="password" id="password" placeholder="${t('createPassword')}" autocomplete="new-password" />
            </div>

            <div class="create-import-password-strength" id="passwordStrength"></div>

            <div class="create-import-form-group">
              <label for="confirmPassword">${t('confirmPassword')}</label>
              <input type="password" id="confirmPassword" placeholder="${t('confirmPasswordPlaceholder')}" autocomplete="new-password" />
            </div>

            <div class="create-import-password-requirements">
              <div class="create-import-requirements-title">${t('passwordRequirements')}</div>
              <ul>
                <li>${t('passwordReq8Chars')}</li>
                <li>${t('passwordReqUppercase')}</li>
                <li>${t('passwordReqLowercase')}</li>
                <li>${t('passwordReqNumber')}</li>
              </ul>
            </div>

            <div class="create-import-error" id="error"></div>

            <button id="importWalletBtn" class="btn btn-primary create-import-submit-btn">${t('importWalletButton')}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const normalizeMnemonic = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');

  const handleImport = async () => {
    const mnemonicRaw = (document.getElementById('mnemonic') as HTMLTextAreaElement).value;
    const mnemonic = normalizeMnemonic(mnemonicRaw);
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement).value;

    clearError('error');

    if (!mnemonic) {
      displayError('error', t('mnemonicRequired'));
      return;
    }

    const words = mnemonic.split(' ');
    if (words.length !== 12 && words.length !== 24) {
      displayError('error', t('invalidMnemonic'));
      return;
    }

    const bip39 = await import('bip39');
    if (!bip39.validateMnemonic(mnemonic)) {
      displayError('error', t('invalidMnemonic'));
      return;
    }

    if (!password || !confirmPassword) {
      displayError('error', t('passwordRequired'));
      return;
    }

    if (!validatePasswordMatch(password, confirmPassword, 'error')) {
      displayError('error', t('passwordsDoNotMatch'));
      return;
    }

    const validation = validateAndCheckPasswordStrength(password);
    if (!validation.valid) {
      displayError('error', validation.error!);
      return;
    }

    await executeWithButtonLoading(
      {
        buttonId: 'importWalletBtn',
        loadingText: `${ICONS.spinner} ${t('importing')}`,
        originalText: t('importWalletButton'),
        errorElementId: 'error',
        errorMessage: t('failedToImportWallet')
      },
      () => onImport(mnemonic, password, confirmPassword)
    );
  };

  document.getElementById('backBtn')!.addEventListener('click', onBack);
  document.getElementById('importWalletBtn')!.addEventListener('click', handleImport);

  addEnterKeyHandler('confirmPassword', handleImport);

  addPasswordStrengthIndicator('password', 'passwordStrength');
}
