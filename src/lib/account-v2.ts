/**
 * Minha conta v2 (UX item 21; Figma A1–A4, web W31): o cartão "Plano e uso", enxuto, sem preço nem benefícios.
 * Os medidores são os do Início v3 (planBandView); a ação muda com o estado. Dados: /billing/recommendation,
 * /usage e /billing/subscription. A regra da recomendação é do backend.
 * Puro, sem imports em tempo de execução: os testes do Node cobrem (tests/account-v2.test.cjs).
 */
import type { BandUsage, Meter, Rec } from "./home-v3";

export type Sub = { provider: "mercadopago" | "google_play"; kind: "recurring" | "prepaid"; auto_renew: boolean; current_period_end: string | null; access_until: string | null } | null;

export type AccountPlanView = {
  /** "Grátis, sem prazo.", "Renova em 9 dez no cartão.", "Vale até 9 dez · pago no Pix." ou o convite do explorar. */
  situation: string | null;
  meters: Meter[];
  /** A4: créditos esgotados. */
  notice: string | null;
  /** Só com plano recomendado e motivo real. */
  offer: string | null;
  primary: { label: string; to: "plans" | "packs" } | null;
  manage: "plans" | "play" | null;
  /** Explorar (A3): "Ver planos" como link. */
  link: { label: string; to: "plans" } | null;
};

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const day = (date: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? ""); return m ? `${Number(m[3])} ${MONTH_SHORT[Number(m[2]) - 1]}` : null; };

/** A linha de situação do plano no web (item 21: "Renova em {data} no cartão" ou "Vale até {data} · pago no Pix"). */
export function situationLine(free: boolean, sub: Sub): string | null {
  if (free) return "Grátis, sem prazo.";
  if (!sub) return null;
  const renew = day(sub.current_period_end), until = day(sub.access_until ?? sub.current_period_end);
  if (sub.provider === "google_play") return sub.auto_renew ? (renew ? `Renova em ${renew} pelo Google Play.` : null) : (until ? `Vale até ${until}, contratado no Google Play.` : null);
  if (sub.kind === "prepaid") return until ? `Vale até ${until} · pago no Pix.` : null;
  return sub.auto_renew ? (renew ? `Renova em ${renew} no cartão.` : null) : (until ? `Vale até ${until}, sem renovação.` : null);
}

export function accountPlanView(input: {
  rec: Rec; usage: BandUsage; sub: Sub; meters: Meter[];
  /** O texto do motivo, já montado pela faixa do Início (planBandView().offer). */
  offerText: string | null;
  recommendedLabel: string | null; exploring: boolean; canBuy: boolean; packs: boolean;
}): AccountPlanView {
  const { rec, usage, sub, exploring, canBuy } = input;
  const free = rec.current_plan === "free";
  const manage: AccountPlanView["manage"] = sub ? (sub.provider === "google_play" ? "play" : "plans") : null;
  const view: AccountPlanView = { situation: situationLine(free, sub), meters: input.meters, notice: null, offer: null, primary: null, manage, link: null };

  if (exploring) {
    return { ...view, situation: "Você pode explorar sem cadastrar plantas.", manage: null, link: canBuy && rec.plan_key ? { label: "Ver planos", to: "plans" } : null };
  }
  // A4: créditos esgotados. "Comprar créditos" é o principal só com pacote à venda.
  if (usage?.mode === "credits" && usage.exhausted) {
    const renews = day(usage.period.renews_at);
    return { ...view, notice: `Seus créditos acabaram.${renews ? ` Os do plano voltam em ${renews}.` : ""}`, primary: input.packs ? { label: "Comprar créditos", to: "packs" } : null };
  }
  const offer = canBuy && rec.plan_key && rec.reasons.length && input.recommendedLabel ? input.offerText : null;
  // E4 (item 23b): conversas do mês esgotadas, com quando voltam.
  const renewsQ = day(usage?.period.renews_at);
  if (usage?.exhausted && usage.mode !== "credits") view.notice = `As conversas com o Bobby deste mês acabaram.${renewsQ ? ` Voltam em ${renewsQ}.` : ""}`;
  if (offer) return { ...view, offer, primary: { label: free ? "Fazer upgrade" : `Ver o plano ${input.recommendedLabel}`, to: "plans" } };
  // A1: Free com plano à venda acima, sem motivo: "Fazer upgrade" é o principal (decisão do item 19).
  if (free && canBuy && rec.plan_key) return { ...view, primary: { label: "Fazer upgrade", to: "plans" } };
  return view;
}
