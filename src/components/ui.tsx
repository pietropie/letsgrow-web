"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

/**
 * Equivalentes web de letsgrow-mobile/components/ui/DesignSystem.tsx: mesmas medidas (botão e campo
 * com 52 px, raio 12, coluna de 20 px) e os mesmos textos. Mudou lá, mude aqui.
 */

/** Figma header: folha + wordmark. Alturas: mobile 24/39, lateral web 24/32, auth web 28/40. */
export function Brand({ className = "", size = 39, leaf = size >= 40 ? 28 : 24 }: { className?: string; size?: number; leaf?: number }) {
  return (
    <span role="img" aria-label="LetsGrow" className={`inline-flex items-start gap-[5px] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/brand-leaf.svg" alt="" height={leaf} width={Math.round(leaf * 273 / 312)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/wordmark.svg" alt="" height={size} width={Math.round(size * 125 / 39)} />
    </span>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[28px] leading-9 font-bold text-text">{children}</h1>;
}

export function PageSubtitle({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-5 text-text-muted">{children}</p>;
}

const buttonBase = "flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 py-[14px] text-center text-base leading-[22px] font-semibold transition-opacity active:opacity-80 disabled:opacity-50 cursor-pointer disabled:cursor-default";
const buttonKind = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-surface text-text border border-border py-[13px] hover:bg-surface-high",
};

export function Button({ label, onClick, secondary = false, loading = false, disabled = false, type = "button" }: { label: string; onClick?: () => void; secondary?: boolean; loading?: boolean; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} className={`${buttonBase} ${buttonKind[secondary ? "secondary" : "primary"]}`}>
      {label}
    </button>
  );
}

export function ButtonLink({ label, href, secondary = false, replace = false }: { label: string; href: string; secondary?: boolean; replace?: boolean }) {
  return <Link href={href} replace={replace} className={`${buttonBase} ${buttonKind[secondary ? "secondary" : "primary"]}`}>{label}</Link>;
}

export function TextField({ label, hint, error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const note = error || hint;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm leading-5 font-semibold text-text">{label}</label>
      <input id={id} aria-invalid={!!error || undefined} aria-describedby={note ? `${id}-note` : undefined} {...props}
        className={`min-h-[52px] rounded-xl border bg-white px-[14px] py-3 text-base leading-6 text-text placeholder:text-text-muted outline-none focus:border-2 focus:border-primary focus:px-[13px] focus:py-[11px] ${error ? "border-error" : "border-input-border"} ${className ?? ""}`} />
      {!!note && <p id={`${id}-note`} className={`text-sm leading-5 ${error ? "text-error" : "text-text-muted"}`}>{note}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return message ? <p role="alert" aria-live="polite" className="text-sm leading-5 text-error whitespace-pre-line">{message}</p> : null;
}

export function Notice({ title, body, meta, white = false, children }: { title: string; body?: string; meta?: string; white?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl p-4 ${white ? "bg-white" : "bg-surface-bobby"}`}>
      <p className="text-lg leading-6 font-semibold text-text">{title}</p>
      {!!body && <p className="text-base leading-6 text-text">{body}</p>}
      {children}
      {!!meta && <p className="text-sm leading-5 text-text-muted">{meta}</p>}
    </div>
  );
}

/** Figma frames que ainda não têm versão web: diz o que falta, sem simular o resultado. */
export function UnavailableNotice({ body = "Esta área ainda não chegou à versão web. Enquanto isso, use o app no celular." }: { body?: string }) {
  return <Notice white title="Ainda não disponível na web" body={body} />;
}

export function ActionRow({ title, body, href, onClick }: { title: string; body: string; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex flex-1 flex-col gap-1 text-left">
        <span className="text-base leading-6 font-semibold text-text">{title}</span>
        <span className="text-sm leading-5 text-text-muted">{body}</span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/chevron-right.svg" alt="" />
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-surface-high active:opacity-80 cursor-pointer";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/** "Voltar": histórico do navegador quando houver, senão o `fallback`. */
export function BackLink({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.replace(fallback))}
      className="flex min-h-11 items-center gap-2 self-start px-1 py-2 text-sm leading-5 font-semibold text-text cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/chevron-right.svg" alt="" className="rotate-180" />
      Voltar
    </button>
  );
}

/** Senha com "mostrar": no teclado do desktop, conferir o que foi digitado evita erro de login. */
export function PasswordField(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; hint?: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextField {...props} type={visible ? "text" : "password"} className="pr-24" />
      <button type="button" onClick={() => setVisible(v => !v)} aria-pressed={visible}
        className="absolute right-2 top-[30px] min-h-11 rounded-lg px-3 text-sm font-semibold text-primary cursor-pointer">
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
