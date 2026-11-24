"use client";

/**
 * "Adicionar Hub" na web (Figma 27 · H1–H7, o mesmo fluxo do mobile hooks/useHubProvisioning.ts). Diferença: o
 * navegador não lista aparelhos, então "Procurar Hub" abre o seletor do navegador (Web Bluetooth) e a etapa de
 * busca mostra só o que deu errado (navegador sem Bluetooth, seletor fechado, conexão falhou).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { planLimitMessage } from "@/shared/lib/errors";
import {
  acceptStatus, needsNewCode, progressIndex, statusError, type HubInfo, type HubState, type HubStatus,
  type ProvisionError, type WifiNetwork,
} from "@/shared/lib/hubProvisioning";
import { HubSession, requestHub, webBleSupport, type ChosenHub, type WebBleSupport } from "./hub-ble";
import { useHubClaimCode, type HubClaimCodeResponse } from "./sensors";

export type ProvisionStep = "intro" | "scan" | "wifi" | "password" | "progress" | "done" | "error";
/** Etapa de busca: navegador sem Web Bluetooth, página sem HTTPS, sem adaptador, seletor fechado, Bluetooth negado. */
export type ScanProblem = Exclude<WebBleSupport, "ok"> | "cancelled" | "denied";
export interface ChosenNetwork { ssid: string; sec: boolean; manual: boolean }

export function useHubProvisioning(growId: string) {
  const claim = useHubClaimCode();
  const [step, setStep] = useState<ProvisionStep>("intro");
  const [support, setSupport] = useState<WebBleSupport | null>(null);
  const [scanProblem, setScanProblem] = useState<ScanProblem | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hub, setHub] = useState<ChosenHub | null>(null);
  const [info, setInfo] = useState<HubInfo | null>(null);
  const [nets, setNets] = useState<WifiNetwork[]>([]);
  const [netsLoading, setNetsLoading] = useState(false);
  const [network, setNetwork] = useState<ChosenNetwork | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<ProvisionError | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);

  const session = useRef<HubSession | null>(null);
  const unwatch = useRef<(() => void) | null>(null);
  const code = useRef<HubClaimCodeResponse | null>(null);
  const password = useRef("");
  const stepRef = useRef(step);
  const lastState = useRef<HubState | null>(null);
  const attempt = useRef({ written: false, sawProgress: false, writtenAt: 0 });
  useEffect(() => { stepRef.current = step; }, [step]);

  // O H1 já avisa quando o navegador não consegue: "Procurar Hub" nem chega a abrir o seletor.
  useEffect(() => { void webBleSupport().then(setSupport); }, []);

  const closeSession = useCallback(() => {
    unwatch.current?.();
    unwatch.current = null;
    const s = session.current;
    session.current = null;
    s?.close();
  }, []);
  useEffect(() => () => closeSession(), [closeSession]);

  const fail = useCallback((err: ProvisionError, detail: string | null = null) => {
    setError(err); setErrorDetail(detail); setStep("error");
  }, []);

  const loadNetworks = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    setNetsLoading(true);
    try { setNets(await s.scanWifi()); } catch { if (session.current) setNets([]); } finally { setNetsLoading(false); }
  }, []);

  const onStatus = useCallback((status: HubStatus) => {
    const a = attempt.current;
    if (stepRef.current !== "progress" || !acceptStatus(status, { ...a, msSinceWrite: Date.now() - a.writtenAt })) return;
    lastState.current = status.state;
    if (status.state === "wifi_connecting" || status.state === "activating") a.sawProgress = true;
    const err = statusError(status);
    if (err) {
      if (err === "code_invalid" || err === "code_expired") code.current = null;
      fail(err);
      return;
    }
    setProgress(progressIndex(status.state));
    if (status.state === "done") { setDoneAt(Date.now()); setStep("done"); closeSession(); }
  }, [closeSession, fail]);

  const onDisconnect = useCallback(() => {
    unwatch.current = null;
    session.current = null;
    if (stepRef.current === "done" || stepRef.current === "intro") return;
    // Em "activating" o backend já pode ter ativado e o Hub reiniciado antes do notify de "done".
    if (stepRef.current === "progress" && lastState.current === "activating") {
      setProgress(3); setDoneAt(Date.now()); setStep("done");
      return;
    }
    fail("ble_disconnected");
  }, [fail]);

  /** "Procurar Hub": precisa vir direto do clique, senão o navegador recusa abrir o seletor. */
  const findHub = useCallback(async () => {
    closeSession();
    setError(null);
    setScanProblem(null);
    const sup = support ?? await webBleSupport();
    if (sup !== "ok") { setScanProblem(sup); setStep("scan"); return; }
    let chosen: ChosenHub | null;
    try {
      chosen = await requestHub();
    } catch (e) {
      setScanProblem((e as Error)?.name === "NotAllowedError" || (e as Error)?.name === "SecurityError" ? "denied" : "no_adapter");
      setStep("scan");
      return;
    }
    if (!chosen) { setScanProblem("cancelled"); setStep("scan"); return; }
    setStep("scan");
    setConnecting(true);
    try {
      const s = await HubSession.connect(chosen);
      session.current = s;
      s.onDisconnect(onDisconnect);
      setInfo(await s.readInfo());
      setHub(chosen);
      setNets([]);
      setStep("wifi");
      void loadNetworks();
      if (needsNewCode(code.current)) claim.mutateAsync(growId).then(c => { code.current = c; }, () => {});
    } catch {
      closeSession();
      fail("ble_disconnected");
    } finally {
      setConnecting(false);
    }
  }, [support, claim, growId, closeSession, fail, loadNetworks, onDisconnect]);

  const chooseNetwork = useCallback((net: WifiNetwork) => { setNetwork({ ssid: net.ssid, sec: net.sec, manual: false }); setStep("password"); }, []);
  const chooseManual = useCallback(() => { setNetwork({ ssid: "", sec: true, manual: true }); setStep("password"); }, []);

  const send = useCallback(async (override?: ChosenNetwork) => {
    const s = session.current;
    const net = override ?? network;
    if (!s || !net) { fail("ble_disconnected"); return; }
    setError(null); setErrorDetail(null); setProgress(0);
    lastState.current = null;
    attempt.current = { written: false, sawProgress: false, writtenAt: 0 };
    setStep("progress");
    try {
      if (needsNewCode(code.current)) code.current = await claim.mutateAsync(growId);
    } catch (e) {
      fail("claim_failed", planLimitMessage(e));
      return;
    }
    if (!unwatch.current) unwatch.current = s.watchStatus(onStatus);
    try {
      await s.writeConfig({ ssid: net.ssid, pass: net.sec ? password.current : "", growId, code: code.current!.code });
      attempt.current = { written: true, sawProgress: false, writtenAt: Date.now() };
    } catch {
      if (session.current) fail("unknown");
    }
  }, [claim, growId, network, fail, onStatus]);

  const connectHub = useCallback((ssid: string, pass: string) => {
    if (!network) return;
    password.current = pass;
    const net = { ...network, ssid: ssid.trim() };
    setNetwork(net);
    void send(net);
  }, [network, send]);

  /** Botões do H7. Sem link vivo, tudo volta para a busca. */
  const act = useCallback((action: "password" | "network" | "retry" | "rescan") => {
    // Vem do clique no botão: o seletor do navegador pode abrir direto daqui.
    if (action === "rescan" || !session.current) { void findHub(); return; }
    if (action === "password") setStep("password");
    else if (action === "network") { setStep("wifi"); void loadNetworks(); }
    else void send();
  }, [findHub, loadNetworks, send]);

  const back = useCallback(() => {
    if (step === "password") setStep("wifi");
    else if (step === "wifi" || step === "scan") { closeSession(); setStep("intro"); }
  }, [step, closeSession]);

  const cancel = useCallback(() => { closeSession(); setStep("intro"); }, [closeSession]);

  return {
    step, support, scanProblem, connecting, hub, info, nets, netsLoading, network, progress, error, errorDetail, doneAt,
    findHub, loadNetworks, chooseNetwork, chooseManual, connectHub, act, back, cancel,
  };
}
