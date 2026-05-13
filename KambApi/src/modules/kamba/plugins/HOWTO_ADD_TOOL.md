# Como Adicionar uma Nova Ferramenta ao Kamba

## 1. Criar o ficheiro da ferramenta

Cria um ficheiro em `plugins/tools/` com o nome da ferramenta:

```javascript
// plugins/tools/minhaNovaFerramenta.js
const prisma = require('../../../../lib/prisma');

module.exports = {
  name: 'minhaNovaFerramenta',
  description: 'Descrição clara para o LLM saber quando usar esta ferramenta.',
  handler: async (params, context) => {
    // params: object with parameters from LLM
    // context: { usuarioId }
    
    // Lógica da ferramenta aqui
    const result = await prisma.someModel.findMany({ ... });
    
    return result;
  },
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Descrição do parâmetro' }
    }
  },
  category: 'financial' // 'financial' | 'knowledge' | 'general'
};
```

## 2. A ferramenta é carregada automaticamente

O sistema em `plugins/tools/index.js` detecta automaticamente qualquer ficheiro `.js` na pasta (excepto `index.js`) e regista-o no `toolRegistry`.

Não precisas de importar nada manualmente.

## 3. Actualizar a documentação para o LLM

Em `plugins/prompts/v1_tools.md`, adiciona a documentação da nova ferramenta para que o LLM saiba quando usá-la.

## 4. Formato do retorno

O `handler` deve retornar um objecto ou array serializável. Se não houver dados, retorna:
```javascript
return { erro: 'Mensagem de erro amigável', disponivel: true };
```

## Estrutura do objecto de configuração

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | sim | Nome único da ferramenta (usa camelCase) |
| `description` | string | sim | Descrição para o LLM saber quando usar |
| `handler` | function | sim | `async (params, context) => dados` |
| `parameters` | object | sim | Schema no formato OpenAI function calling |
| `category` | string | não | `financial`, `knowledge`, ou `general` |
| `requiresAuth` | boolean | não | Se precisa de autenticação extra |
| `cacheable` | boolean | não | Se o resultado pode ser cacheado |
| `cacheTTL` | number | não | TTL do cache em ms (default: 5min) |

## Exemplo completo

```javascript
const prisma = require('../../../../lib/prisma');

module.exports = {
  name: 'getSaldoTotal',
  description: 'Busca o saldo total de todas as contas do utilizador.',
  handler: async (_, context) => {
    const cartoes = await prisma.cartao.findMany({
      where: { usuarioId: context.usuarioId, ativo: true, excluido: false }
    });
    
    const saldoTotal = cartoes.reduce((acc, c) => acc + Number(c.saldoAtual), 0);
    
    return {
      saldoTotal,
      numContas: cartoes.length,
      contas: cartoes.map(c => ({ nome: c.nome, saldo: Number(c.saldoAtual) }))
    };
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial',
  cacheable: true,
  cacheTTL: 2 * 60 * 1000
};
```
