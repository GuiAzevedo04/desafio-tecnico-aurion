# API de ordens de serviço

API RESTful para cadastrar, consultar, atualizar e excluir ordens de serviço, feita para o desafio técnico backend da Aurion.

- **Stack:** JavaScript (Node.js 24, sem TypeScript), Express 5 e PostgreSQL 17.
- **Execução:** Docker e Docker Compose, a partir de um clone limpo.
- **Testes:** 95 testes HTTP contra um banco de teste isolado.

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Como executar](#como-executar)
- [Como encerrar e limpar](#como-encerrar-e-limpar)
- [Como rodar os testes](#como-rodar-os-testes)
- [Referência da API](#referência-da-api)
- [Escolha do banco](#escolha-do-banco)
- [Decisões técnicas](#decisões-técnicas)
- [Limitações e próximos passos](#limitações-e-próximos-passos)
- [Uso de IA](#uso-de-ia)

## Pré-requisitos

- Docker com o plugin Docker Compose (`docker compose`).

Não é preciso instalar Node.js nem PostgreSQL na máquina.

## Configuração

As variáveis ficam em um arquivo `.env`, que não é versionado. O repositório traz o `.env.example` com valores para desenvolvimento local:

```bash
cp .env.example .env
```

| Variável            | Padrão             | Uso                                            |
| ------------------- | ------------------ | ---------------------------------------------- |
| `API_PORT`          | `3000`             | Porta da API na máquina (`localhost`).         |
| `POSTGRES_USER`     | `ordens`           | Usuário do banco, usado pelo banco e pela API. |
| `POSTGRES_PASSWORD` | `ordens_dev_local` | Senha do banco.                                |
| `POSTGRES_DB`       | `ordens`           | Nome do banco.                                 |

O `docker-compose.yml` tem os mesmos valores como padrão, então `docker compose up --build` funciona mesmo sem o `.env`. Esses valores servem só para desenvolvimento local. Em qualquer outro ambiente, defina credenciais próprias no `.env` ou nas variáveis de ambiente.

Se você trocar as credenciais depois de já ter subido o ambiente, apague o volume do banco (`docker compose down -v`), porque o PostgreSQL só cria o usuário na primeira inicialização.

## Como executar

```bash
docker compose up --build
```

O Compose sobe o banco, espera ele ficar saudável e só então inicia a API. Ao iniciar, a API aplica o schema (`db/schema.sql`) e passa a atender em:

- API: <http://localhost:3000/ordens>
- Documentação interativa (Swagger UI): <http://localhost:3000/docs>
- Documento OpenAPI: <http://localhost:3000/openapi.yaml>
- Verificação de saúde: <http://localhost:3000/health>

A porta é publicada apenas em `127.0.0.1`, porque a API não tem autenticação. O banco não expõe porta na máquina.

## Como encerrar e limpar

```bash
# Para a API e o banco. Os dados ficam no volume.
docker compose down

# Para tudo e apaga os dados.
docker compose down -v

# Faz o mesmo e remove também o banco de teste, se os testes foram executados.
docker compose --profile test down -v
```

Se o ambiente estiver em primeiro plano, `Ctrl+C` encerra a API de forma limpa: ela para de aceitar conexões, termina as requisições em andamento e fecha o pool do banco.

## Como rodar os testes

```bash
docker compose --profile test run --rm --build test
```

Esse comando constrói a imagem de teste, sobe um PostgreSQL separado (`db-test`) e roda a suíte. O código de saída é diferente de zero se algum teste falhar.

Isolamento do banco de teste:

- É outro contêiner, com usuário, senha e nome de banco próprios (`ordens_test`).
- Guarda os dados em memória (`tmpfs`) e não usa o volume do ambiente de desenvolvimento.
- A suíte se recusa a rodar se o nome do banco não terminar em `_test`.
- Antes de cada arquivo de teste o schema é recriado, e antes de cada teste a tabela é esvaziada. Os testes não dependem da ordem de execução.

Para rodar o lint (ESLint e Prettier):

```bash
docker compose --profile test run --rm --build test npm run lint
```

## Referência da API

Os exemplos abaixo são saídas reais de uma execução local. O JSON foi apenas indentado para leitura. A especificação completa está em [`openapi.yaml`](openapi.yaml) e em `/docs`.

### Recurso

| Campo           | Tipo             | Descrição                                                           |
| --------------- | ---------------- | ------------------------------------------------------------------- |
| `id`            | UUID             | Gerado pelo servidor. Não pode ser enviado nem alterado.            |
| `titulo`        | texto            | Obrigatório. De 1 a 200 caracteres, sem contar espaços nas pontas.  |
| `descricao`     | texto            | Obrigatório. De 1 a 5000 caracteres.                                |
| `status`        | texto            | `aberta`, `em_andamento` ou `concluida`. Toda ordem nasce `aberta`. |
| `solucao`       | texto ou `null`  | Opcional. Até 5000 caracteres.                                      |
| `criado_em`     | data e hora, UTC | Definido pelo servidor na criação.                                  |
| `atualizado_em` | data e hora, UTC | Atualizado pelo servidor a cada `PATCH`.                            |

### Rotas

| Rota                 | Corpo aceito                                               | Sucesso         |
| -------------------- | ---------------------------------------------------------- | --------------- |
| `POST /ordens`       | `titulo` e `descricao`, ambos obrigatórios                 | `201` e a ordem |
| `GET /ordens`        | nenhum                                                     | `200` e a lista |
| `GET /ordens/:id`    | nenhum                                                     | `200` e a ordem |
| `PATCH /ordens/:id`  | ao menos um de `titulo`, `descricao`, `status` e `solucao` | `200` e a ordem |
| `DELETE /ordens/:id` | nenhum                                                     | `204` sem corpo |

### Criar uma ordem

```bash
curl -s -X POST http://localhost:3000/ordens \
  -H 'Content-Type: application/json' \
  -d '{"titulo":"Inspeção da válvula VLV-OS-7F3A","descricao":"Verificar vedação e registrar o resultado da inspeção."}'
```

Resposta `201`:

```json
{
  "id": "690996cc-c387-4c22-8293-f255b62a2540",
  "titulo": "Inspeção da válvula VLV-OS-7F3A",
  "descricao": "Verificar vedação e registrar o resultado da inspeção.",
  "status": "aberta",
  "solucao": null,
  "criado_em": "2026-11-17T00:06:28.432Z",
  "atualizado_em": "2026-11-17T00:06:28.432Z"
}
```

### Listar as ordens

```bash
curl -s http://localhost:3000/ordens
```

Resposta `200`, da mais antiga para a mais recente:

```json
[
  {
    "id": "690996cc-c387-4c22-8293-f255b62a2540",
    "titulo": "Inspeção da válvula VLV-OS-7F3A",
    "descricao": "Verificar vedação e registrar o resultado da inspeção.",
    "status": "aberta",
    "solucao": null,
    "criado_em": "2026-11-17T00:06:28.432Z",
    "atualizado_em": "2026-11-17T00:06:28.432Z"
  }
]
```

Sem ordens cadastradas, a resposta é `200` com `[]`.

### Consultar uma ordem

```bash
curl -s http://localhost:3000/ordens/690996cc-c387-4c22-8293-f255b62a2540
```

Resposta `200` com o mesmo objeto retornado na criação.

### Atualizar uma ordem

```bash
curl -s -X PATCH http://localhost:3000/ordens/690996cc-c387-4c22-8293-f255b62a2540 \
  -H 'Content-Type: application/json' \
  -d '{"status":"em_andamento"}'
```

Resposta `200`:

```json
{
  "id": "690996cc-c387-4c22-8293-f255b62a2540",
  "titulo": "Inspeção da válvula VLV-OS-7F3A",
  "descricao": "Verificar vedação e registrar o resultado da inspeção.",
  "status": "em_andamento",
  "solucao": null,
  "criado_em": "2026-11-17T00:06:28.432Z",
  "atualizado_em": "2026-11-17T00:06:28.510Z"
}
```

### Concluir uma ordem

Sem solução, a conclusão é rejeitada:

```bash
curl -s -X PATCH http://localhost:3000/ordens/690996cc-c387-4c22-8293-f255b62a2540 \
  -H 'Content-Type: application/json' \
  -d '{"status":"concluida"}'
```

Resposta `400`:

```json
{
  "erro": {
    "codigo": "REGRA_DE_CONCLUSAO",
    "mensagem": "Uma ordem só pode ficar concluída se tiver uma solução preenchida.",
    "detalhes": []
  }
}
```

Com solução, é aceita. Os espaços nas pontas são removidos:

```bash
curl -s -X PATCH http://localhost:3000/ordens/690996cc-c387-4c22-8293-f255b62a2540 \
  -H 'Content-Type: application/json' \
  -d '{"status":"concluida","solucao":"  Vedação substituída e válvula testada.  "}'
```

Resposta `200`:

```json
{
  "id": "690996cc-c387-4c22-8293-f255b62a2540",
  "titulo": "Inspeção da válvula VLV-OS-7F3A",
  "descricao": "Verificar vedação e registrar o resultado da inspeção.",
  "status": "concluida",
  "solucao": "Vedação substituída e válvula testada.",
  "criado_em": "2026-11-17T00:06:28.432Z",
  "atualizado_em": "2026-11-17T00:06:28.546Z"
}
```

Apagar a solução de uma ordem concluída também é rejeitado (`{"solucao":"   "}` devolve o mesmo `400` com `REGRA_DE_CONCLUSAO`), e a ordem continua como estava.

### Excluir uma ordem

```bash
curl -s -i -X DELETE http://localhost:3000/ordens/690996cc-c387-4c22-8293-f255b62a2540
```

Resposta `204`, sem corpo. Uma nova consulta ao mesmo ID devolve `404`.

### Erros

Todo erro tem o mesmo formato. `detalhes` lista os problemas de validação por campo e fica vazio nos outros casos.

| Status | `codigo`               | Quando                                                               |
| ------ | ---------------------- | -------------------------------------------------------------------- |
| `400`  | `JSON_INVALIDO`        | O corpo não é um JSON válido.                                        |
| `400`  | `ID_INVALIDO`          | O `:id` não é um UUID.                                               |
| `400`  | `ENTRADA_INVALIDA`     | Corpo que não é objeto, campo ausente, inválido ou fora do contrato. |
| `400`  | `REGRA_DE_CONCLUSAO`   | A ordem ficaria `concluida` sem solução.                             |
| `400`  | `REQUISICAO_INVALIDA`  | Outros erros de requisição, como URL com codificação inválida.       |
| `404`  | `ORDEM_NAO_ENCONTRADA` | UUID válido sem ordem correspondente.                                |
| `404`  | `ROTA_NAO_ENCONTRADA`  | Rota ou método que não existe.                                       |
| `413`  | `CORPO_MUITO_GRANDE`   | Corpo acima de 100 kB.                                               |
| `500`  | `ERRO_INTERNO`         | Falha inesperada. O detalhe fica só no log do servidor.              |

Campo fora do contrato e valor inválido, na mesma requisição:

```bash
curl -s -X PATCH http://localhost:3000/ordens/690996cc-c387-4c22-8293-f255b62a2540 \
  -H 'Content-Type: application/json' \
  -d '{"id":"x","status":"cancelada"}'
```

Resposta `400`:

```json
{
  "erro": {
    "codigo": "ENTRADA_INVALIDA",
    "mensagem": "Dados de entrada inválidos.",
    "detalhes": [
      { "campo": "id", "mensagem": "campo não permitido" },
      { "campo": "status", "mensagem": "deve ser um de: aberta, em_andamento, concluida" }
    ]
  }
}
```

Criação com campo em branco, campo não permitido e campo ausente:

```bash
curl -s -X POST http://localhost:3000/ordens \
  -H 'Content-Type: application/json' \
  -d '{"titulo":"   ","status":"concluida"}'
```

Resposta `400`:

```json
{
  "erro": {
    "codigo": "ENTRADA_INVALIDA",
    "mensagem": "Dados de entrada inválidos.",
    "detalhes": [
      { "campo": "titulo", "mensagem": "deve conter ao menos um caractere além de espaços" },
      { "campo": "status", "mensagem": "campo não permitido" },
      { "campo": "descricao", "mensagem": "campo obrigatório" }
    ]
  }
}
```

ID malformado:

```bash
curl -s http://localhost:3000/ordens/123
```

Resposta `400`:

```json
{
  "erro": {
    "codigo": "ID_INVALIDO",
    "mensagem": "O id informado não é um UUID válido.",
    "detalhes": []
  }
}
```

ID válido que não existe:

```bash
curl -s http://localhost:3000/ordens/00000000-0000-4000-8000-000000000000
```

Resposta `404`:

```json
{
  "erro": {
    "codigo": "ORDEM_NAO_ENCONTRADA",
    "mensagem": "Ordem de serviço não encontrada.",
    "detalhes": []
  }
}
```

JSON malformado:

```bash
curl -s -X POST http://localhost:3000/ordens \
  -H 'Content-Type: application/json' \
  -d '{"titulo": "x", '
```

Resposta `400`:

```json
{
  "erro": {
    "codigo": "JSON_INVALIDO",
    "mensagem": "O corpo da requisição não é um JSON válido.",
    "detalhes": []
  }
}
```

## Escolha do banco

Escolhi o **PostgreSQL** por três motivos:

- **O dado é estruturado e tem schema fixo.** Uma ordem tem sempre os mesmos campos e tipos. Não há documentos de formato variável que justifiquem o MongoDB.
- **As regras do domínio cabem em constraints.** `NOT NULL` e `CHECK` garantem no próprio banco o status válido, os textos não vazios e a regra de conclusão. Assim o dado continua correto mesmo que um bug ou um acesso manual passe por fora da API.
- **A regra de conclusão precisa de leitura e escrita consistentes.** O `PATCH` lê a ordem, valida o estado resultante e grava. Transação com bloqueio de linha (`SELECT ... FOR UPDATE`) resolve isso de forma direta.

## Decisões técnicas

### Estrutura do código

```text
src/
  server.js              inicialização e encerramento limpo
  app.js                 monta o app Express, sem abrir porta
  config.js              leitura das variáveis de ambiente
  db/pool.js             pool de conexões e helper de transação
  db/schema.js           aplica db/schema.sql
  http/errors.js         classe de erro que pode ser mostrada ao cliente
  http/error-handler.js  formato único de erro, 404 e 500
  orders/routes.js       rotas HTTP
  orders/validation.js   validação de entrada e regra de conclusão
  orders/repository.js   SQL
db/schema.sql            tabela, constraints e índice
test/                    testes HTTP
openapi.yaml             contrato da API
```

Cada camada tem um papel: as rotas cuidam de HTTP, a validação é feita por funções puras e o repositório é o único lugar com SQL. Não criei uma camada de serviço porque ela só repassaria chamadas.

### SQL puro com `pg`, sem ORM

São seis consultas em uma tabela. Com SQL escrito à mão, cada consulta fica visível e a proteção contra SQL Injection é fácil de conferir: todo valor vindo da requisição vai como parâmetro (`$1`, `$2`), nunca concatenado no texto do SQL. O `UPDATE` também é um texto fixo, sem nomes de coluna montados em tempo de execução.

### Inicialização do schema

O schema é um único arquivo idempotente, `db/schema.sql` (`CREATE ... IF NOT EXISTS`), aplicado pela própria API ao iniciar, antes de abrir a porta.

Preferi isso a montar o arquivo em `/docker-entrypoint-initdb.d` porque o diretório de inicialização do PostgreSQL só roda com o volume vazio. Aplicado pela API, o schema também é criado em um banco que já existia, não depende de montar arquivo da máquina no contêiner, e os testes usam o mesmo arquivo para recriar o banco deles. O custo dessa escolha está em [Limitações](#limitações-e-próximos-passos).

### Regra de conclusão no PATCH

A regra é avaliada sobre o **estado resultante**: a ordem armazenada com os campos do `PATCH` aplicados por cima.

| Ordem armazenada | Corpo do `PATCH`                           | Resultado                   |
| ---------------- | ------------------------------------------ | --------------------------- |
| sem solução      | `{"status":"concluida"}`                   | `400`                       |
| com solução      | `{"status":"concluida"}`                   | `200`                       |
| qualquer         | `{"status":"concluida","solucao":"feito"}` | `200`                       |
| qualquer         | `{"status":"concluida","solucao":"   "}`   | `400`                       |
| `concluida`      | `{"solucao":"   "}` ou `{"solucao":null}`  | `400`, a ordem não muda     |
| `concluida`      | `{"status":"aberta"}`                      | `200`, a solução é mantida  |
| `concluida`      | `{"status":"aberta","solucao":null}`       | `200`, a solução é removida |

O desafio não define transições proibidas entre status, então não criei uma máquina de estados. Qualquer mudança de status é aceita, desde que o estado resultante respeite a regra.

Ordem das verificações no `PATCH`:

1. JSON malformado ou corpo grande demais: `400` ou `413`, ainda no parser do Express.
2. ID malformado: `400`.
3. Corpo inválido (tipo, campo fora do contrato, valor inválido, corpo vazio): `400`.
4. Ordem inexistente: `404`.
5. Regra de conclusão sobre o estado resultante: `400`.

Os passos 1 a 3 não tocam o banco. A regra de conclusão vem depois da busca porque depende da ordem armazenada.

### Atualização atômica

O `PATCH` roda em uma transação: `SELECT ... FOR UPDATE` bloqueia a linha, a API junta a ordem com as alterações, verifica a regra e faz o `UPDATE`.

Sem o bloqueio, duas requisições simultâneas poderiam validar com base em um estado que a outra está mudando. Exemplo: uma conclui a ordem enquanto a outra apaga a solução. Cada uma é válida sozinha, mas juntas deixariam a ordem concluída sem solução, ou uma sobrescreveria a outra. Com o bloqueio, a segunda espera a primeira terminar e decide com o estado já gravado. Há um teste que força exatamente essa situação.

Avaliei fazer tudo em um único `UPDATE` com a regra no `WHERE`. Descartei porque, quando nenhuma linha é alterada, seria preciso outra consulta para saber se o motivo foi o ID inexistente (`404`) ou a regra (`400`), e a regra ficaria escrita em SQL em vez de em uma função simples.

### Tratamento da solução

- `solucao` é gravada sem espaços nas pontas.
- Texto em branco e `null` significam a mesma coisa, "sem solução", e são gravados como `NULL`. Assim só existe uma representação de "sem solução" no banco.
- Por isso `{"solucao":""}` ou `{"solucao":null}` limpam a solução de uma ordem que não está concluída, e são rejeitados em uma ordem concluída.

### Validação

A validação é escrita à mão em `src/orders/validation.js`, sem biblioteca. São quatro campos, e o código inteiro pode ser lido em poucos minutos.

- O corpo precisa ser um objeto JSON. Array, texto, número e `null` são rejeitados.
- `titulo` e `descricao` aceitam apenas texto, com ao menos um caractere depois de remover os espaços das pontas. O valor é gravado já sem esses espaços.
- Limites: 200 caracteres em `titulo`, 5000 em `descricao` e em `solucao`. O corpo da requisição é limitado a 100 kB.
- `status` precisa ser exatamente um dos três valores.
- Qualquer campo fora do contrato devolve `400`, incluindo `id`, `criado_em` e `atualizado_em`. No `POST`, `status` e `solucao` também são rejeitados.
- O caractere nulo (`\u0000`) é rejeitado, porque o PostgreSQL não o armazena em colunas de texto.
- O `:id` é validado como UUID antes de qualquer consulta.
- A resposta lista todos os problemas encontrados de uma vez.

### Formato de erro e logs

Todos os erros saem de uma única função, no formato `{ "erro": { "codigo", "mensagem", "detalhes" } }`. O `codigo` é estável e serve para o cliente tratar o erro. A `mensagem` é para pessoas.

Erros inesperados devolvem um `500` genérico. O erro real, com stack trace, vai para o log do servidor junto com um ID de requisição, que também é devolvido no cabeçalho `X-Request-Id`. Nada de SQL, nomes de coluna ou stack trace chega ao cliente.

### UUID como ID

O `id` é um UUID gerado pelo banco (`gen_random_uuid()`). Ele não revela quantas ordens existem nem permite adivinhar o ID das outras, e o formato pode ser validado antes de consultar o banco.

### Constraints no banco

A API é a validação principal e devolve erros `400` claros. As constraints são uma segunda barreira:

- `NOT NULL` em tudo, exceto `solucao`.
- `CHECK` de `titulo` e `descricao` não vazios.
- `CHECK` do `status` com os três valores permitidos.
- `CHECK` de que uma ordem `concluida` tem `solucao` com texto.

As constraints são de propósito um pouco mais permissivas que a API (por exemplo, não repetem os limites de tamanho). Assim, tudo que a API aceita o banco também aceita, e uma violação de constraint indica um bug, tratado como `500`.

### Índices

| Índice                                    | Consulta que justifica                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| chave primária em `id`                    | `WHERE id = $1` em `GET`, `PATCH` e `DELETE /ordens/:id` |
| `ordens_criado_em_id_idx (criado_em, id)` | `SELECT ... ORDER BY criado_em, id` em `GET /ordens`     |

Com 100 mil linhas de teste, o `EXPLAIN` da listagem mostra `Index Scan using ordens_criado_em_id_idx`, sem etapa de ordenação. Com poucas linhas o PostgreSQL prefere ler a tabela inteira e ordenar em memória, o que é esperado. O mesmo índice atende uma paginação futura por `(criado_em, id)`.

Não criei índice em `status` porque a API não tem consulta que filtre por ele.

### Segurança

- `helmet` com a configuração padrão, e o cabeçalho `X-Powered-By` desativado.
- **CORS desativado.** Nenhuma origem externa é permitida. O Swagger UI funciona porque é servido pela própria API, na mesma origem.
- Credenciais vêm só de variáveis de ambiente. O `.env` está no `.gitignore` e no `.dockerignore`.
- O contêiner da API roda com o usuário `node`, sem privilégios de root, e só tem as dependências de produção.
- O banco de teste tem usuário e senha fixos no `docker-compose.yml`. Não são segredos: o banco fica em memória, não expõe porta e só existe durante os testes.

### Testes

Usei `node:test` com `supertest`: o executor de testes já vem com o Node, então a suíte não precisa de configuração nem de mais dependências.

Os testes passam pelas rotas HTTP reais e por um PostgreSQL real, sem mock do banco. A única exceção é o teste do `500`, que simula uma falha do banco para conferir que o detalhe vai para o log e não para a resposta. Os arquivos rodam em sequência porque compartilham o mesmo banco.

### Itens além do contrato mínimo

- `criado_em` e `atualizado_em` no recurso, para ordenar a listagem de forma estável.
- Cabeçalho `Location` no `201`.
- `GET /health`, usado pelo healthcheck do contêiner.
- `GET /docs` e `GET /openapi.yaml`.
- `413` para corpo acima de 100 kB. O desafio pede `400` para entrada inválida; mantive o `413` por ser o status HTTP específico para esse caso.

## Limitações e próximos passos

- **Sem paginação nem filtros.** `GET /ordens` devolve todas as ordens. O próximo passo seria paginação por cursor em `(criado_em, id)` e um filtro `?status=`, com um índice para ele.
- **Sem autenticação e autorização**, que estão fora do escopo. Também não há limite de requisições por cliente.
- **Sem ferramenta de migrations.** O schema é um arquivo idempotente aplicado na inicialização. Ele cria o que falta, mas não altera uma tabela que já existe. Para mudar uma constraint em desenvolvimento é preciso recriar o volume (`docker compose down -v`). Em produção eu usaria migrations versionadas (por exemplo, `node-pg-migrate`), executadas em um passo separado do deploy e com um usuário de banco diferente do usuário da aplicação.
- **Sem controle de concorrência otimista.** Dois `PATCH` simultâneos são aplicados em sequência e nenhum se perde, mas o cliente não é avisado de que a ordem mudou desde a última leitura. Daria para resolver com `ETag` e `If-Match`.
- **Método não suportado devolve `404`**, não `405`.
- **Logs simples**, em texto no `stdout`. Em produção eu usaria logs estruturados em JSON.
- **Cache e fila não foram implementados.** Preferi entregar o escopo principal bem testado. Para o cache, eu guardaria `GET /ordens/:id` no Redis e apagaria a chave em todo `PATCH` e `DELETE`. Para a fila, publicaria um evento quando uma ordem fosse concluída, por exemplo para notificar alguém, com um worker fazendo novas tentativas com intervalo crescente e uma fila de mensagens mortas para reprocessamento.

## Uso de IA

Usei IA (Claude Code, da Anthropic) como apoio neste desafio, nestas etapas:

- **Estrutura do projeto:** Dockerfile, Docker Compose e configuração de lint.
- **Implementação:** a IA escreveu a primeira versão do código a partir dos requisitos e das decisões que eu defini, como o uso de PostgreSQL com SQL puro, a ordem das verificações do `PATCH` e a regra avaliada sobre o estado resultante.
- **Testes:** escrita dos casos de teste a partir da lista de cenários que eu queria cobrir.
- **Documentação:** rascunho deste README e do `openapi.yaml`.

Eu revisei o código, executei o ambiente e os testes, e consigo explicar, testar e alterar qualquer parte da solução.
