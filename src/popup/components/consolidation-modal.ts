import { t } from '../utils/i18n';
import { HoosatUtils } from 'hoosat-sdk-web';
import { showAlertDialog } from './modal';
import { ICONS } from '../utils/icons';

/**
 * Show consolidation modal with UTXO info
 */
export async function showConsolidationModal(
  app: HTMLElement,
  onConsolidate: () => Promise<void>,
  onLater: () => void
): Promise<void> {
  // Get consolidation info
  const response = await chrome.runtime.sendMessage({
    type: 'GET_CONSOLIDATION_INFO',
  });

  if (!response.success) {
    console.error('Failed to get consolidation info:', response.error);
    return;
  }

  const info = response.data;
  const { utxoCount, currentFee, consolidationFee, estimatedSavings } = info;

  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content consolidation-modal">
      <div class="modal-header">
        <div class="modal-icon">${ICONS.warning}</div>
        <h2>${t('consolidationRecommended')}</h2>
      </div>

      <div class="modal-body">
        <p class="utxo-count">${t('yourWalletHasUtxos', [utxoCount.toString()])}</p>

        <div class="fee-info">
          <div class="fee-row">
            <span>${t('currentTransactionFee', [HoosatUtils.sompiToAmount(currentFee)])}</span>
          </div>
          <div class="fee-row">
            <span>${t('consolidationFee', [HoosatUtils.sompiToAmount(consolidationFee)])}</span>
          </div>
          <div class="fee-row savings">
            <span>${t('futureSavings', [HoosatUtils.sompiToAmount(estimatedSavings)])}</span>
          </div>
        </div>

        <p class="description">${t('consolidationDescription')}</p>
      </div>

      <div class="modal-actions">
        <button id="laterBtn" class="btn btn-secondary">${t('later')}</button>
        <button id="consolidateBtn" class="btn btn-primary">${t('consolidateNow')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animate in
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);

  // Event listeners
  const consolidateBtn = document.getElementById('consolidateBtn')!;
  const laterBtn = document.getElementById('laterBtn')!;

  consolidateBtn.addEventListener('click', async () => {
    try {
      // Show loading state
      (consolidateBtn as HTMLButtonElement).disabled = true;
      consolidateBtn.textContent = t('consolidating');

      await onConsolidate();

      // Remove modal
      modal.remove();
    } catch (error) {
      console.error('Consolidation failed:', error);
      (consolidateBtn as HTMLButtonElement).disabled = false;
      consolidateBtn.textContent = t('consolidateNow');
      await showAlertDialog(t('error'), t('consolidationFailed') + ': ' + (error as Error).message, 'error');
    }
  });

  laterBtn.addEventListener('click', () => {
    modal.remove();
    onLater();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      onLater();
    }
  });
}

/**
 * Show consolidation progress modal
 */
export function showConsolidationProgress(app: HTMLElement, utxoCount: number, fee: string): HTMLElement {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content consolidation-progress">
      <div class="modal-header">
        <h2>${t('consolidating')}</h2>
      </div>

      <div class="modal-body">
        <div class="progress-info">
          <p>${t('combiningUtxos', [utxoCount.toString()])}</p>
          <p>${t('consolidationFee', [HoosatUtils.sompiToAmount(fee)])}</p>
          <div class="loading-spinner"></div>
          <p class="status">${t('buildingTransaction')}</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animate in
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);

  return modal;
}

/**
 * Show consolidation success modal
 */
export function showConsolidationSuccess(
  app: HTMLElement,
  utxoCount: number,
  fee: string,
  txCount: number,
  onDone: () => void
): void {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';

  const batchInfo = txCount > 1
    ? `<p class="batch-info">${t('consolidatedInBatches', [txCount.toString()])}</p>`
    : '';

  modal.innerHTML = `
    <div class="modal-content consolidation-success">
      <div class="modal-header">
        <h2>✅ ${t('consolidationComplete')}</h2>
      </div>

      <div class="modal-body">
        <div class="success-info">
          <p class="utxos-reduced">${t('utxosReduced', [utxoCount.toString()])}</p>
          ${batchInfo}
          <p>${t('feePaid', [HoosatUtils.sompiToAmount(fee)])}</p>
          <p class="success-message">${t('futureTransactionsCheaper')} ${ICONS.party}</p>
        </div>
      </div>

      <div class="modal-actions">
        <button id="doneBtn" class="btn btn-primary">${t('done')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animate in
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);

  const doneBtn = document.getElementById('doneBtn')!;
  doneBtn.addEventListener('click', () => {
    modal.remove();
    onDone();
  });
}
