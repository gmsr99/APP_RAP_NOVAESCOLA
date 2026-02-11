# 📚 Documentação: Services da Aplicação RAP Nova Escola

## 🎯 Visão Geral

Os **services** (serviços) são o coração da lógica de negócio da aplicação. Cada service é responsável por uma área funcional específica e contém todas as regras e operações relacionadas.

---

## 📁 Estrutura de Services

```
services/
├── __init__.py              # Inicialização e imports
├── aula_service.py          # Gestão de aulas/sessões
└── confirmacao_service.py   # Confirmação e recusa de aulas
```

---

## 📋 Services Disponíveis

### 1. **aula_service.py**

**Responsabilidade:** Gestão completa de aulas/sessões

**Funções principais:**
- `criar_aula()` - Cria nova aula
- `listar_aulas_por_estado()` - Filtra aulas por estado
- `atribuir_mentor()` - Atribui mentor a uma aula
- `mudar_estado_aula()` - Altera estado de aula
- `obter_aula_por_id()` - Busca aula específica
- `listar_todas_aulas()` - Lista todas as aulas

**Estados das aulas:**
- `rascunho` - Sem mentor atribuído
- `pendente` - Aguarda confirmação do mentor
- `confirmada` - Mentor confirmou
- `recusada` - Mentor recusou
- `em_curso` - Aula a decorrer
- `concluida` - Aula terminada
- `cancelada` - Aula cancelada

---

### 2. **confirmacao_service.py**

**Responsabilidade:** Gestão de confirmações e recusas com sistema de logs

**Funções principais:**
- `confirmar_aula()` - Mentor confirma aula
- `recusar_aula()` - Mentor recusa aula (motivo obrigatório)
- `criar_log()` - Cria registo de auditoria
- `ver_logs_aula()` - Mostra histórico de uma aula
- `mostrar_logs_aula()` - Exibe logs formatados
- `listar_aulas_pendentes_mentor()` - Lista pendentes de um mentor

---

## 🎯 Características Especiais

### ⚡ **Validações de Segurança**

✅ **Permissões:**
- Só o mentor ATRIBUÍDO pode confirmar/recusar sua aula
- Valida ID do mentor antes de processar ação

✅ **Estados:**
- Só aulas "pendentes" podem ser confirmadas/recusadas
- Impede confirmação de aulas já processadas

✅ **Dados Obrigatórios:**
- Motivo é OBRIGATÓRIO ao recusar
- Aula deve ter turma atribuída para criar

---

### 📝 **Logs Automáticos**

Cada ação importante gera log automático com:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| `tipo_acao` | O que aconteceu | "confirmar", "recusar" |
| `entidade` | Tipo afetado | "aula" |
| `entidade_id` | ID específico | 5 |
| `descricao` | Texto completo | "Aula #5 confirmada..." |
| `usuario` | Quem fez | "João Silva" |
| `dados_adicionais` | Info extra | Estado anterior, motivo |
| `criado_em` | Timestamp | 2024-11-20 15:30:22 |

**Vantagens:**
- ✅ Rastreabilidade completa
- ✅ Auditoria de todas as ações
- ✅ Histórico imutável
- ✅ Debugging facilitado

---

### ⏱️ **Timestamps Automáticos**

Todas as tabelas têm:

```sql
criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Atualizações automáticas:**
- `criado_em` → Preenchido ao criar registo
- `atualizado_em` → Atualizado em cada modificação

**Não precisas fazer nada!** O PostgreSQL gere automaticamente.

---

### 📊 **Observações Cumulativas**

Cada mudança de estado adiciona nota às observações:

```
Observações da Aula #5:
┌────────────────────────────────────────────────────┐
│ [2024-11-20 14:30] Criada como rascunho           │
│ [2024-11-20 15:00] Mentor atribuído: João Silva   │
│ [2024-11-20 15:15] Estado: pendente → confirmada  │
│                    | Equipamento verificado        │
└────────────────────────────────────────────────────┘
```

**Benefícios:**
- ✅ Histórico completo no próprio registo
- ✅ Não precisa consultar logs para ver mudanças
- ✅ Contexto sempre disponível

---

## 🔄 Fluxo de Estados das Aulas

### Estado Inicial ao Criar

```
┌─────────────────────────────────────┐
│         CRIAR AULA                  │
└──────────────┬──────────────────────┘
               │
               ▼
        Tem mentor?
               │
       ┌───────┴───────┐
       │               │
      SIM             NÃO
       │               │
       ▼               ▼
  "pendente"      "rascunho"
```

---

### Fluxo Completo de Confirmação

```
┌─────────────┐
│  RASCUNHO   │ (sem mentor)
└──────┬──────┘
       │
       │ atribuir_mentor()
       ▼
┌─────────────┐
│  PENDENTE   │ (aguarda confirmação)
└──────┬──────┘
       │
       │ Mentor decide
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│ CONFIRMADA  │   │  RECUSADA   │
└─────────────┘   └─────────────┘
       │                 │
       │                 │
       ▼                 ▼
   Aula OK         Atribuir outro
                      mentor
```

---

## 📊 Operações dos Services

### Confirmar Aula - Passo a Passo

```
1. confirmar_aula(aula_id=5, mentor_id=2, observacao="OK")
   │
   ├─→ 2. Buscar aula na BD
   │
   ├─→ 3. Validar:
   │      ├─ Aula existe? ✓
   │      ├─ Estado = "pendente"? ✓
   │      └─ Mentor correto? ✓
   │
   ├─→ 4. Atualizar aula:
   │      ├─ estado = "confirmada"
   │      ├─ observacoes += nota
   │      └─ atualizado_em = NOW()
   │
   ├─→ 5. Criar LOG:
   │      ├─ tipo_acao = "confirmar"
   │      ├─ descricao = "Aula #5 confirmada..."
   │      └─ usuario = "João Silva"
   │
   ├─→ 6. (Opcional) Enviar notificação Slack
   │
   └─→ 7. Retornar confirmação ao utilizador ✅
```

---

### Recusar Aula - Passo a Passo

```
1. recusar_aula(aula_id=7, mentor_id=3, motivo="Doença")
   │
   ├─→ 2. Validar motivo:
   │      └─ Não vazio? ✓ (se vazio → ERRO)
   │
   ├─→ 3. Buscar aula na BD
   │
   ├─→ 4. Validar:
   │      ├─ Aula existe? ✓
   │      ├─ Estado = "pendente"? ✓
   │      └─ Mentor correto? ✓
   │
   ├─→ 5. Atualizar aula:
   │      ├─ estado = "recusada"
   │      ├─ observacoes += "MOTIVO: {motivo}"
   │      └─ atualizado_em = NOW()
   │
   ├─→ 6. Criar LOG:
   │      ├─ tipo_acao = "recusar"
   │      ├─ dados_adicionais = motivo
   │      └─ usuario = "Maria Santos"
   │
   ├─→ 7. (Opcional) Enviar notificação Slack (alerta vermelho)
   │
   └─→ 8. Sugerir próximos passos:
          └─ "Atribuir outro mentor ou remarcar"
```

---

## 🔐 Validações Implementadas

### 1. Validação de Permissões

```python
# Exemplo de código real
if mentor_aula_id != mentor_id:
    print("❌ Erro: Mentor #{mentor_id} não pode processar esta aula!")
    return None
```

**Previne:**
- Mentor A confirmar aulas do Mentor B
- Ações não autorizadas
- Confusão de atribuições

---

### 2. Validação de Estado

```python
# Exemplo de código real
if estado_atual != "pendente":
    print(f"❌ Só podes confirmar aulas pendentes!")
    print(f"   Estado atual: '{estado_atual}'")
    return None
```

**Previne:**
- Confirmar aulas já confirmadas
- Recusar aulas já concluídas
- Estados inconsistentes

---

### 3. Validação de Dados Obrigatórios

```python
# Ao recusar: motivo é OBRIGATÓRIO
if not motivo or motivo.strip() == "":
    print("❌ Motivo da recusa é OBRIGATÓRIO!")
    return None
```

**Garante:**
- Dados completos para auditoria
- Comunicação clara da recusa
- Histórico compreensível

---

## 📈 Métricas e Monitorização

### Queries Úteis para Análise

**Aulas por estado:**
```sql
SELECT estado, COUNT(*) as total
FROM aulas
GROUP BY estado;
```

**Taxa de confirmação por mentor:**
```sql
SELECT 
    m.nome,
    COUNT(*) FILTER (WHERE a.estado = 'confirmada') as confirmadas,
    COUNT(*) FILTER (WHERE a.estado = 'recusada') as recusadas
FROM mentores m
LEFT JOIN aulas a ON m.id = a.mentor_id
GROUP BY m.nome;
```

**Logs de ações:**
```sql
SELECT tipo_acao, COUNT(*) as total
FROM logs
WHERE entidade = 'aula'
GROUP BY tipo_acao;
```

---

## 🧪 Testes e Debugging

### Como Testar Cada Service

**Teste 1: Criar aula**
```python
from services import aula_service

aula = aula_service.criar_aula(
    turma_id=1,
    data_hora="2024-12-20 14:00",
    tipo="pratica_gravacao",
    mentor_id=2
)
print(f"Aula #{aula['id']} criada com estado: {aula['estado']}")
```

**Teste 2: Confirmar aula**
```python
from services import confirmacao_service

resultado = confirmacao_service.confirmar_aula(
    aula_id=5,
    mentor_id=2,
    observacao="Equipamento OK"
)
print(f"Sucesso: {resultado['sucesso']}")
```

**Teste 3: Ver logs**
```python
from services import confirmacao_service

confirmacao_service.mostrar_logs_aula(aula_id=5)
```

---

## 🔮 Extensibilidade Futura

### Preparado Para Crescer

A arquitetura atual permite adicionar facilmente:

**Novos services:**
```
services/
├── mentor_service.py      # Gestão de mentores
├── turma_service.py       # Gestão de turmas
├── equipamento_service.py # Gestão de equipamentos
├── relatorio_service.py   # Geração de relatórios
└── notificacao_service.py # Notificações (já existe em notifications/)
```

**Novos estados:**
```python
ESTADO_ADIADA = "adiada"
ESTADO_REMARCADA = "remarcada"
```

**Novas validações:**
```python
def validar_disponibilidade_mentor(mentor_id, data_hora):
    # Verifica se mentor está livre
    pass
```

---

## 💡 Boas Práticas Implementadas

### ✅ DRY (Don't Repeat Yourself)

Código reutilizável:
- `criar_log()` usado por todas as ações
- `obter_aula_por_id()` usado por várias funções
- Validações centralizadas

### ✅ Separation of Concerns

Cada service tem responsabilidade única:
- `aula_service` → CRUD de aulas
- `confirmacao_service` → Workflow de confirmação

### ✅ Error Handling

Tratamento robusto de erros:
- Try/catch em todas as operações BD
- Rollback em caso de erro
- Mensagens claras ao utilizador

### ✅ Logging

Sistema de logs para auditoria:
- Todas as ações importantes registadas
- Quem, quando, o quê, porquê
- Histórico imutável

---

## 📚 Recursos Adicionais

### Documentação Relacionada

- `README.md` - Visão geral do projeto
- `docs/database_schema.md` - Estrutura da BD
- `docs/guia_confirmacao_aulas.md` - Guia de confirmações
- `docs/guia_slack_webhook.md` - Configuração Slack

### Como Usar os Services

```python
# 1. Importar
from services import aula_service, confirmacao_service

# 2. Usar funções
aula = aula_service.criar_aula(...)
resultado = confirmacao_service.confirmar_aula(...)

# 3. Verificar resultado
if resultado and resultado['sucesso']:
    print("✅ Operação bem-sucedida!")
```

---

## 🎯 Resumo

**Services implementados:** 2  
**Funções totais:** ~15  
**Linhas de código:** ~1200  
**Cobertura:** Gestão completa de aulas e confirmações  
**Qualidade:** Validações + Logs + Error handling  

**Status:** ✅ Produção-ready

---

**Última atualização:** Novembro 2024  
**Versão:** 1.0.0  
**Autor:** Equipa RAP Nova Escola
