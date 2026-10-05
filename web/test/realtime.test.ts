import { afterEach, describe, expect, it, vi } from "vitest";

import { JANELA_DE_AGRUPAMENTO_MS, agrupar } from "../src/realtime";

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
