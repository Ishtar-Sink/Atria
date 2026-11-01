// Contrato entre os harness de print e `apps/web/scripts/evidence-ui.mjs`: o harness publica as
// conferências na página e o script as lê. Só os harness de print carregam este arquivo; o app não
// o importa.

export interface EvidenceCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

declare global {
  interface Window {
    __atria_evidence?: EvidenceCheck[];
  }
}

/** Publica as conferências e avisa o script de que a página está pronta. */
export function publishEvidence(checks: EvidenceCheck[]): void {
  window.__atria_evidence = checks;
  document.documentElement.dataset['evidenceReady'] = 'true';
}

/** Compara duas medidas em pixels com uma tolerância. */
export function near(a: number, b: number, tolerance = 0.5): boolean {
  return Math.abs(a - b) <= tolerance;
}
