import { HttpError } from './errors.js';

// Single place that defines the error body, so every error has the same shape.
function sendError(res, status, codigo, mensagem, detalhes = []) {
  res.status(status).json({ erro: { codigo, mensagem, detalhes } });
}

export function routeNotFound(req, res) {
  sendError(res, 404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.');
}

// Express recognizes an error handler by its four parameters.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  // Raised by express.json() while reading the request body.
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'CORPO_MUITO_GRANDE', 'O corpo da requisição é grande demais.');
  }

  // Other client errors raised by Express itself, e.g. a malformed percent-encoding in the URL.
  if (err.status >= 400 && err.status < 500) {
    return sendError(res, err.status, 'REQUISICAO_INVALIDA', 'Requisição inválida.');
  }

  // Unexpected: the details stay in the server log and the client gets a generic message.
  console.error(`[${req.id}] ${req.method} ${req.originalUrl} failed:`, err);
  return sendError(res, 500, 'ERRO_INTERNO', 'Erro interno do servidor.');
}
