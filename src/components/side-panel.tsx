"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Figma W22 (padrões web): as folhas do mobile (seletores, definir local) viram um painel à direita de 400,
 * altura total, no tablet e no desktop; no celular continuam folha embaixo. Usa <dialog> nativo: foco preso,
 * Esc fecha e o fundo escurece a 40 %.
 */
export function SidePanel({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // O <dialog> foca o primeiro botão (Fechar); um campo marcado com data-autofocus recebe o foco no lugar.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="side-panel-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[20px] bg-surface p-0 text-text backdrop:bg-black/40 md:mt-0 md:ml-auto md:h-dvh md:max-h-none md:w-[400px] md:rounded-none">
      <div className="pb-safe flex h-full flex-col gap-3 overflow-y-auto p-5">
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <h2 id="side-panel-title" className="text-lg leading-6 font-semibold text-text-primary">{title}</h2>
            {subtitle && <p className="text-sm leading-5 text-text-secondary">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-bg cursor-pointer">
            {/* close-small.svg do Figma é claro (para fundo escuro); aqui o traço é display. */}
            <svg width={16} height={16} viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3 3L9 9M9 3L3 9" strokeWidth={1.4} strokeLinecap="round" stroke="var(--color-display)" /></svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Opção das folhas do Início (H3, H4, H7): cartão com borda; a atual ou recomendada em state/calm. */
export function PanelOption({ title, body, selected, disabled, onClick }: { title: string; body?: string; selected?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className={`flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left hover:border-input-border disabled:opacity-60 cursor-pointer disabled:cursor-default ${selected ? "border-input-border bg-source-highlight" : "border-stroke bg-surface"}`}>
      <span className="text-base leading-[22px] font-semibold text-text-primary">{title}</span>
      {body && <span className="text-[13px] leading-[18px] text-text-secondary">{body}</span>}
    </button>
  );
}
