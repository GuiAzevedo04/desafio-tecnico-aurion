import { HttpError } from '../http/errors.js';

const STATUSES = ['aberta', 'em_andamento', 'concluida'];

const CREATE_FIELDS = ['titulo', 'descricao'];
const UPDATE_FIELDS = ['titulo', 'descricao', 'status', 'solucao'];

const MAX_TITULO_LENGTH = 200;
const MAX_LONG_TEXT_LENGTH = 5000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Field parsers return { value } with the normalized input,
// or { error } with a message that is safe to show to the client.

function parseText(input, maxLength) {
  if (typeof input !== 'string') {
    return { error: 'deve ser um texto' };
  }
  // PostgreSQL cannot store the NUL character in a text column.
  if (input.includes('\u0000')) {
    return { error: 'não pode conter o caractere nulo' };
  }
  const text = input.trim();
  if (text.length > maxLength) {
    return { error: `deve ter no máximo ${maxLength} caracteres` };
  }
  return { value: text };
}

function parseRequiredText(input, maxLength) {
  const result = parseText(input, maxLength);
  if (result.value === '') {
    return { error: 'deve conter ao menos um caractere além de espaços' };
  }
  return result;
}

function parseStatus(input) {
  if (!STATUSES.includes(input)) {
    return { error: `deve ser um de: ${STATUSES.join(', ')}` };
  }
  return { value: input };
}

// null and blank text both mean "no solution" and are stored as NULL, so the
// conclusion rule only has one representation of "missing" to deal with.
function parseSolucao(input) {
  if (input === null) {
    return { value: null };
  }
  const result = parseText(input, MAX_LONG_TEXT_LENGTH);
  if (result.value === '') {
    return { value: null };
  }
  return result;
}

const FIELD_PARSERS = {
  titulo: (input) => parseRequiredText(input, MAX_TITULO_LENGTH),
  descricao: (input) => parseRequiredText(input, MAX_LONG_TEXT_LENGTH),
  status: parseStatus,
  solucao: parseSolucao,
};

function invalidInput(message, details) {
  return new HttpError(400, 'ENTRADA_INVALIDA', message, details);
}

// Returns only the allowed fields, already normalized. Throws a 400 listing
// every problem found, including any field outside the contract.
function parseBody(body, allowedFields, requiredFields) {
  const isPlainObject = body !== null && typeof body === 'object' && !Array.isArray(body);
  if (!isPlainObject) {
    throw invalidInput(
      'O corpo da requisição deve ser um objeto JSON, enviado com Content-Type: application/json.',
    );
  }

  const values = {};
  const details = [];

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      details.push({ campo: field, mensagem: 'campo não permitido' });
      continue;
    }
    const { value, error } = FIELD_PARSERS[field](body[field]);
    if (error) {
      details.push({ campo: field, mensagem: error });
    } else {
      values[field] = value;
    }
  }

  for (const field of requiredFields) {
    if (!Object.hasOwn(body, field)) {
      details.push({ campo: field, mensagem: 'campo obrigatório' });
    }
  }

  if (details.length > 0) {
    throw invalidInput('Dados de entrada inválidos.', details);
  }
  return values;
}

export function parseCreateBody(body) {
  return parseBody(body, CREATE_FIELDS, CREATE_FIELDS);
}

export function parseUpdateBody(body) {
  const changes = parseBody(body, UPDATE_FIELDS, []);
  if (Object.keys(changes).length === 0) {
    throw invalidInput(`Informe ao menos um campo: ${UPDATE_FIELDS.join(', ')}.`);
  }
  return changes;
}

// Business rule from the brief: an order can only be "concluida" if it has a
// solution. Receives the state the order would have after the update.
export function assertConclusionRule(order) {
  const hasSolution = typeof order.solucao === 'string' && order.solucao.trim() !== '';
  if (order.status === 'concluida' && !hasSolution) {
    throw new HttpError(
      400,
      'REGRA_DE_CONCLUSAO',
      'Uma ordem só pode ficar concluída se tiver uma solução preenchida.',
    );
  }
}

export function assertValidId(id) {
  if (!UUID_PATTERN.test(id)) {
    throw new HttpError(400, 'ID_INVALIDO', 'O id informado não é um UUID válido.');
  }
}
