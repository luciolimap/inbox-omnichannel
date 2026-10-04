const ESTILO: Record<string, { rotulo: string; classe: string }> = {
  OPEN: { rotulo: "Aberta", classe: "text-bg-primary" },
  PENDING: { rotulo: "Pendente", classe: "text-bg-warning" },
  RESOLVED: { rotulo: "Resolvida", classe: "text-bg-success" },
};

export function StatusBadge({ status }: { status: string }) {
  const estilo = ESTILO[status] ?? { rotulo: status, classe: "text-bg-light" };
  return <span className={`badge ${estilo.classe}`}>{estilo.rotulo}</span>;
}
