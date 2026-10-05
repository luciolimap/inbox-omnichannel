import { afterEach, describe, expect, it, vi } from "vitest";

import { JANELA_DE_AGRUPAMENTO_MS, TETO_DE_ESPERA_MS, agrupar } from "../src/realtime";

afterEach(() => {
  vi.useRealTimers();
});

describe("eventos do gateway agrupados", () => {
  it("rajada de tres eventos vira uma recarga", () => {
    vi.useFakeTimers();
    let recargas = 0;
    const recarregar = agrupar(() => { recargas += 1; });

    recarregar();
    recarregar();
    recarregar();

    expect(recargas).toBe(0);
    vi.advanceTimersByTime(JANELA_DE_AGRUPAMENTO_MS);
    expect(recargas).toBe(1);
  });

  it("evento depois da janela recarrega de novo", () => {
    vi.useFakeTimers();
    let recargas = 0;
    const recarregar = agrupar(() => { recargas += 1; });

    recarregar();
    vi.advanceTimersByTime(JANELA_DE_AGRUPAMENTO_MS);
    recarregar();
    vi.advanceTimersByTime(JANELA_DE_AGRUPAMENTO_MS);

    expect(recargas).toBe(2);
  });

  it("rajada sem pausa ainda recarrega dentro do teto de espera", () => {
    // Evento a cada 50ms reinicia a janela de 100ms para sempre: sem teto, a
    // lista e a conversa aberta congelam pelo tempo inteiro da rajada.
    vi.useFakeTimers();
    let recargas = 0;
    const recarregar = agrupar(() => { recargas += 1; });

    for (let i = 0; i < 20; i += 1) {
      recarregar();
      vi.advanceTimersByTime(JANELA_DE_AGRUPAMENTO_MS / 2);
    }

    expect(recargas).toBeGreaterThanOrEqual(1);
    expect(TETO_DE_ESPERA_MS).toBeGreaterThan(JANELA_DE_AGRUPAMENTO_MS);
  });

  it("cancelar descarta a recarga pendente", () => {
    // O socket fecha no unmount com evento ainda na janela: sem o cancelar, a
    // recarga roda depois e mexe no estado de uma tela que saiu.
    vi.useFakeTimers();
    let recargas = 0;
    const recarregar = agrupar(() => { recargas += 1; });

    recarregar();
    recarregar.cancelar();
    vi.advanceTimersByTime(JANELA_DE_AGRUPAMENTO_MS);

    expect(recargas).toBe(0);
  });
});
