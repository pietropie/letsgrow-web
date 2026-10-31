/**
 * Dados das páginas públicas (/privacidade, /excluir-conta) num só lugar.
 */

/**
 * E-mail de privacidade e do encarregado (DPO). Enquanto for null, as páginas remetem à Política de privacidade.
 * O usuário vai informar o endereço; preencha aqui e em content/privacidade.md (§1 e §8).
 */
export const PRIVACY_EMAIL: string | null = null;

/**
 * Prazo para desistir da exclusão, em dias. Vem de app_settings.account_deletion_grace_days no backend
 * (padrão 7, editável no admin › Configurações). O texto público usa este número; quem entrou vê o valor da API
 * (GET /account/deletion-policy, que exige sessão). Se mudar no admin, mude aqui.
 */
export const DELETION_GRACE_DAYS = 7;
