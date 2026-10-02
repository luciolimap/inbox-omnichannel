import { buildServer } from "./server.js";
import { env } from "./env.js";

// Ponto de entrada separado do server.ts para o teste importar buildServer sem
// abrir porta. Detectar "sou o entrypoint" por import.meta.url erra no Windows,
// onde o caminho chega com barra invertida.
const server = buildServer();
server.listen({ port: env.port, host: "0.0.0.0" }).catch((erro) => {
  server.log.error(erro);
  process.exit(1);
});
