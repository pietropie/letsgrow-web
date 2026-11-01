"use client";

import { useEffect, useState } from "react";

/**
 * Altura do teclado na tela (0 quando fechado). No Safari do iPhone o teclado não encolhe a página (layout viewport),
 * só a área visível (visualViewport): um elemento fixo embaixo ficaria escondido atrás dele. A conversa do Bobby
 * usa este valor para manter o composer logo acima do teclado.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);
  // Menos de 80 px é a barra do Safari mudando de tamanho, não um teclado.
  return inset > 80 ? inset : 0;
}
