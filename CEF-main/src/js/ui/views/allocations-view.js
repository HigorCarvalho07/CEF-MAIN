import { delegate, escapeHtml } from '../../core/dom.js';
import { formatDate, isOverdue } from '../../core/format.js';
import { AllocationStatus, ViewId } from '../../domain/enums.js';
import { openAllocationForm } from '../components/allocation-form.js';
import { icon } from '../components/icons.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { printHtml } from '../print.js';

/**
 * Allocations tab: active loans, box detail and check-out/check-in flow.
 */
export class AllocationsView {
  #inventory;
  #reports;
  #root;
  #cleanups = [];

  constructor({ inventory, reports }) {
    this.#inventory = inventory;
    this.#reports = reports;
  }

  get id() {
    return ViewId.ALLOCATIONS;
  }

  mount(root) {
    this.#root = root;
    root.innerHTML = this.#template();
    this.#bind();
    this.render();
  }

  render() {
    const tbody = this.#root?.querySelector('#allocations-tbody');
    if (!tbody) {
      return;
    }

    const allocations = this.#inventory.listAllocations();
    tbody.innerHTML =
      allocations.length === 0
        ? '<tr><td colspan="7" class="empty-state">Nenhuma alocação ativa no momento.</td></tr>'
        : allocations.map((allocation) => this.#row(allocation)).join('');
  }

  destroy() {
    for (const cleanup of this.#cleanups) {
      cleanup();
    }
    this.#cleanups = [];
    this.#root = null;
  }

  #template() {
    return `
      <header class="page-header">
        <div>
          <h2 class="page-header__title">Alocações de Ferramentas</h2>
          <p class="page-header__subtitle">Gerencie empréstimos ativos e finalizados por serviço.</p>
        </div>
        <div class="page-header__actions">
          <button type="button" class="btn btn--primary" data-action="new-allocation">
            ${icon('plus')} Nova Alocação
          </button>
        </div>
      </header>

      <div class="card card--flush">
        <div class="table-scroll custom-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">ID OS</th>
                <th scope="col">Empresa / Solicitante</th>
                <th scope="col">Abertura</th>
                <th scope="col">Devolução Prevista</th>
                <th scope="col">Caixa de Ferramentas</th>
                <th scope="col">Status</th>
                <th scope="col" class="cell--right">Ações</th>
              </tr>
            </thead>
            <tbody id="allocations-tbody"></tbody>
          </table>
        </div>
      </div>`;
  }

  #row(allocation) {
    const overdue = allocation.status === AllocationStatus.ACTIVE && isOverdue(allocation.dataExpiracao);

    return `
      <tr>
        <td class="cell--mono">${escapeHtml(allocation.id)}</td>
        <td class="cell--strong">${escapeHtml(allocation.empresa)}</td>
        <td class="cell--muted">${escapeHtml(formatDate(allocation.dataAbertura))}</td>
        <td class="cell--muted ${overdue ? 'cell--danger-text' : ''}">
          ${escapeHtml(formatDate(allocation.dataExpiracao))}
        </td>
        <td>
          <button type="button" class="btn btn--sm btn--outline font-mono" data-action="view-box"
                  data-id="${escapeHtml(allocation.id)}" title="Ver itens da caixa">
            ${icon('package')} ${escapeHtml(allocation.codigoCaixa)}
          </button>
        </td>
        <td>${this.#statusBadge(overdue)}</td>
        <td class="cell--right">
          <div class="cell-actions">
           <button type="button" class="icon-button" data-action="edit-allocation" data-id="${escapeHtml(allocation.id)}"
                   title="Editar alocação" aria-label="Editar alocação ${escapeHtml(allocation.id)}">
             ${icon('pencil')}
           </button>
            <button type="button" class="icon-button" data-action="print-guide" data-id="${escapeHtml(allocation.id)}"
                    title="Imprimir guia" aria-label="Imprimir guia ${escapeHtml(allocation.id)}">
              ${icon('printer')}
            </button>
            <button type="button" class="btn btn--sm btn--success" data-action="finalize" data-id="${escapeHtml(allocation.id)}">
              ${icon('check')} Concluir
            </button>
          </div>
        </td>
      </tr>`;
  }

  #statusBadge(overdue) {
    if (overdue) {
      return `<span class="badge badge--danger">${icon('alert-triangle')} Em Atraso</span>`;
    }
    return `<span class="badge badge--success">${icon('dot')} Ativa</span>`;
  }

  #bind() {
    this.#cleanups.push(
      delegate(this.#root, 'click', '[data-action]', (event, target) => {
        const { action, id } = target.dataset;

        if (action === 'new-allocation') {
          openAllocationForm({ inventory: this.#inventory });
        } else if (action === 'view-box') {
          this.#openBoxDetail(id);
        } else if (action === 'edit-allocation') {
          this.#openEditAllocation(id);
        } else if (action === 'print-guide') {
          const allocation = this.#inventory.getAllocation(id);
          printHtml(this.#reports.allocationGuide(allocation));
        } else if (action === 'finalize') {
          this.#finalize(id);
        }
      }),
    );
  }

  #openBoxDetail(allocationId) {
    const allocation = this.#inventory.getAllocation(allocationId);

    const people =
      allocation.pessoas.length === 0
        ? '<span class="text-muted">Nenhuma pessoa registrada.</span>'
        : allocation.pessoas
            .map(
              (person) =>
                `<span class="tag">${escapeHtml(person.nome)}
                  <span class="tag__doc">(${escapeHtml(person.doc || 'N/A')})</span>
                </span>`,
            )
            .join('');

    const items =
      allocation.itens.length === 0
        ? '<p class="text-muted">Nenhum item alocado.</p>'
        : allocation.itens
            .map((item) => {
              const toolName = item.nome || (() => {
                const tool = this.#inventory.listTools().find((t) => t.id === item.ferramentaId);
                return tool ? tool.nome : 'Ferramenta desconhecida';
              })();
              return `<div class="detail-item">
                <span class="detail-item__name">${escapeHtml(toolName)}</span>
                <span class="detail-item__qty">Qtd: ${escapeHtml(item.quantidade)}</span>
              </div>`;
            })
            .join('');

    openModal({
      title: `${allocation.codigoCaixa} · ${allocation.nomeCaixa}`,
      size: 'md',
      body: `
        <div class="form">
          <div class="field">
            <span class="field__label">Pessoas Designadas</span>
            <div class="tag-list">${people}</div>
          </div>
          <div class="field">
            <span class="field__label">Ferramentas contidas nesta caixa</span>
            <div class="detail-list">${items}</div>
          </div>
        </div>`,
      footer: '<button type="button" class="btn btn--primary" data-modal-close>Fechar</button>',
    });
  }

  #openEditAllocation(id) {
    const allocation = this.#inventory.getAllocation(id);
    const body = `
      <form id="allocation-edit-form" class="form">
        <div class="field">
          <label class="field__label" for="edit-empresa">Empresa / Solicitante</label>
          <input class="input" id="edit-empresa" name="empresa" required value="${escapeHtml(allocation.empresa)}" />
        </div>
        <div class="form-grid form-grid--2">
          <div class="field">
            <label class="field__label" for="edit-data-abertura">Data de Abertura</label>
            <input class="input" type="date" id="edit-data-abertura" name="dataAbertura" required value="${escapeHtml(allocation.dataAbertura)}" />
          </div>
          <div class="field">
            <label class="field__label" for="edit-data-expiracao">Devolução Prevista</label>
            <input class="input" type="date" id="edit-data-expiracao" name="dataExpiracao" required value="${escapeHtml(allocation.dataExpiracao)}" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" data-modal-close>Cancelar</button>
          <button type="submit" class="btn btn--primary">Salvar</button>
        </div>
      </form>`;
    openModal({
      title: `Editar Alocação ${escapeHtml(allocation.id)}`,
      body,
      onMount: (bodyElement, modalController) => {
        const form = bodyElement.querySelector('#allocation-edit-form');
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const data = new FormData(form);
          try {
            this.#inventory.updateAllocation(id, {
              empresa: data.get('empresa'),
              dataAbertura: data.get('dataAbertura'),
              dataExpiracao: data.get('dataExpiracao'),
            });
            toast.success('Alocação atualizada.');
            modalController.close();
            this.render();
          } catch (error) {
            toast.error(error.message);
          }
        });
      },
    });
  }

  #finalize(id) {
    try {
      const record = this.#inventory.finalizeAllocation(id);
      toast.success(`Alocação ${record.id} concluída e movida para o histórico.`);
    } catch (error) {
      toast.error(error.message);
    }
  }
}
