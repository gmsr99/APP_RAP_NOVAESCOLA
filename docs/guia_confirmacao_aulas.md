# 📖 Guia Completo: Sistema de Confirmação/Recusa de Aulas

## 🎯 O Que Foi Implementado

Sistema completo de gestão de confirmações com:

✅ **Confirmação de Aulas** - Mentor aceita dar a aula  
✅ **Recusa de Aulas** - Mentor recusa com motivo obrigatório  
✅ **Logs Automáticos** - Histórico completo de todas as ações  
✅ **Validações** - Verifica mentor, estado, e permissões  
✅ **Timestamps** - Regista quando cada ação aconteceu  

---

## 📁 Ficheiros Criados/Atualizados

### ✨ NOVOS:
1. **`services/confirmacao_service.py`** (~600 linhas)
   - Função `confirmar_aula()`
   - Função `recusar_aula()`
   - Função `criar_log()`
   - Função `ver_logs_aula()`
   - Função `listar_aulas_pendentes_mentor()`

### 🔄 ATUALIZADOS:
2. **`main.py`**
   - Novas interfaces de confirmação/recusa
   - Menu expandido (9 opções)
   - Interface de logs
   - Interface de pendentes por mentor

3. **`services/__init__.py`**
   - Importa `confirmacao_service`

---

## 🔄 Fluxo Completo de Uma Aula

```
1. CRIAR AULA
   ↓
   Estado: "pendente" (se tem mentor)
   ↓
   
2. MENTOR DECIDE
   ├─→ CONFIRMAR
   │   ├─ Estado muda para "confirmada"
   │   ├─ Adiciona observação
   │   ├─ Atualiza timestamp
   │   └─ Cria LOG automático
   │
   └─→ RECUSAR
       ├─ Estado muda para "recusada"
       ├─ OBRIGA a indicar motivo
       ├─ Guarda motivo nas observações
       ├─ Atualiza timestamp
       └─ Cria LOG automático
```

---

## 🚀 Como Usar (Passo-a-Passo)

### 📁 PASSO 1: Criar os Ficheiros

#### 1.1 - Criar `services/confirmacao_service.py`

1. **No Cursor**, pasta `services/`, cria: `confirmacao_service.py`
2. **Copia TODO o código** do artifact "services/confirmacao_service.py"
3. **Cola e grava** (Ctrl+S)

✅ Ficheiro criado!

---

#### 1.2 - Atualizar `services/__init__.py`

1. **Abre** `services/__init__.py`
2. **Substitui todo o conteúdo** pelo código do artifact "services/__init__.py - Atualizado"
3. **Grava**

✅ Services configurados!

---

#### 1.3 - Atualizar `main.py`

1. **Abre** `main.py`
2. **Substitui as funções**:
   - `menu_gestao_aulas()` → versão atualizada
   - `confirmar_aula_interface()` → versão atualizada
   - `recusar_aula_interface()` → versão atualizada
3. **Adiciona no final** as novas funções:
   - `ver_logs_aula_interface()`
   - `listar_pendentes_mentor_interface()`
4. **Grava**

✅ Main.py atualizado!

---

### 🧪 PASSO 2: Testar o Sistema

#### Cenário de Teste Completo:

```
📝 Setup inicial:
1. Ter pelo menos 1 instituição
2. Ter pelo menos 1 turma
3. Ter pelo menos 1 mentor
4. Criar 1 aula com estado "pendente"
```

---

### 🎬 Teste 1: Confirmar Uma Aula

1. **Executar app:**
```bash
python main.py
```

2. **Menu → Opção 4** (Planeamento de Sessões)

3. **Opção 4** (Confirmar Aula)

4. **Input:**
```
🆔 ID da Aula: 1

📋 Resumo da Aula:
   Turma: 10ºA
   Data/Hora: 2024-12-20 14:00:00
   Tema: Técnicas de gravação
   Mentor: João Silva

❓ Tens a certeza que queres CONFIRMAR? (s/n): s

📝 Observação (opcional): Equipamento verificado, tudo pronto
```

5. **Output esperado:**
```
⏳ A confirmar aula...
📝 Log #1 criado: confirmar - aula #1

✅ Aula #1 CONFIRMADA com sucesso!
   Mentor: João Silva
   Turma: 10ºA
   Data/Hora: 2024-12-20 14:00:00
   Observação: Equipamento verificado, tudo pronto

🎉 Sucesso! Log #1 criado.
```

---

### 🎬 Teste 2: Recusar Uma Aula

1. **Menu → Opção 5** (Recusar Aula)

2. **Input:**
```
🆔 ID da Aula: 2

📋 Resumo da Aula:
   Turma: 11ºB
   Data/Hora: 2024-12-22 10:00:00
   Tema: História do Hip-Hop
   Mentor: Maria Santos

⚠️  MOTIVO DA RECUSA (obrigatório):
   → Conflito de horário com outra atividade

❓ Tens a certeza que queres RECUSAR? (s/n): s
```

3. **Output esperado:**
```
⏳ A recusar aula...
📝 Log #2 criado: recusar - aula #2

⚠️  Aula #2 RECUSADA!
   Mentor: Maria Santos
   Turma: 11ºB
   Data/Hora: 2024-12-22 10:00:00
   Motivo: Conflito de horário com outra atividade

💡 Próximos passos:
   - Atribuir outro mentor
   - Ou remarcar a aula para outra data

📋 Log #2 criado.
```

---

### 🎬 Teste 3: Ver Logs de Uma Aula

1. **Menu → Opção 8** (Ver Histórico de Logs)

2. **Input:**
```
🆔 ID da Aula: 1
```

3. **Output esperado:**
```
📜 HISTÓRICO DE LOGS - Aula #1
======================================================================

1. CONFIRMAR
   Data: 2024-11-20 16:45:22
   Descrição: Aula #1 confirmada (Tema: Técnicas de gravação) | Turma: 10ºA | Data: 2024-12-20 14:00:00
   Por: João Silva
   Detalhes: Estado anterior: pendente | Observação: Equipamento verificado, tudo pronto
----------------------------------------------------------------------
```

---

### 🎬 Teste 4: Listar Aulas Pendentes de um Mentor

1. **Menu → Opção 9** (Aulas Pendentes de um Mentor)

2. **Input:**
```
👤 ID do Mentor: 1
```

3. **Output esperado:**
```
📋 2 aula(s) pendente(s) de confirmação

--------------------------------------------------------------------------------
ID    Data/Hora         Turma                     Tema                
--------------------------------------------------------------------------------
3     2024-12-25 15:00  10ºA                      Produção de beats   
5     2024-12-27 11:00  10ºC                      Rimas e flow        
--------------------------------------------------------------------------------

📌 Total: 2 aula(s) aguardando confirmação

💡 Usa as opções 4 (Confirmar) ou 5 (Recusar) para processar
```

---

## 🔍 Verificar no Supabase

### Ver Logs Criados:

```sql
-- Ver todos os logs
SELECT * FROM logs ORDER BY criado_em DESC;

-- Ver logs de aulas
SELECT * FROM logs WHERE entidade = 'aula' ORDER BY criado_em DESC;

-- Ver logs de uma aula específica
SELECT * FROM logs WHERE entidade = 'aula' AND entidade_id = 1;
```

### Ver Aulas Confirmadas/Recusadas:

```sql
-- Aulas confirmadas
SELECT id, turma_id, estado, tema, data_hora 
FROM aulas 
WHERE estado = 'confirmada';

-- Aulas recusadas
SELECT id, turma_id, estado, tema, observacoes 
FROM aulas 
WHERE estado = 'recusada';
```

---

## ⚡ Funcionalidades Implementadas

### 1. **Confirmar Aula**

**O que faz:**
- ✅ Verifica se aula existe
- ✅ Verifica se está "pendente"
- ✅ Verifica se o mentor que confirma é o mentor atribuído
- ✅ Muda estado para "confirmada"
- ✅ Adiciona nota com timestamp e observação
- ✅ Cria log automático
- ✅ Mostra confirmação ao utilizador

**Validações:**
- ❌ Aula não encontrada → erro
- ❌ Aula não está "pendente" → erro
- ❌ Mentor errado → erro

---

### 2. **Recusar Aula**

**O que faz:**
- ✅ Tudo que a confirmação faz +
- ✅ **OBRIGA** a indicar motivo
- ✅ Guarda motivo nas observações
- ✅ Sugere próximos passos

**Regra Especial:**
- ⚠️ Motivo é **OBRIGATÓRIO**
- ⚠️ Se deixares vazio → operação cancela

---

### 3. **Criar Log Automático**

**O que regista:**
- 📝 Tipo de ação (confirmar/recusar)
- 📝 Quem fez (nome do mentor)
- 📝 Quando (timestamp automático)
- 📝 O quê (descrição detalhada)
- 📝 Dados extra (estado anterior, motivo, etc.)

**Exemplo de log criado:**

| Campo | Valor |
|-------|-------|
| tipo_acao | confirmar |
| entidade | aula |
| entidade_id | 1 |
| descricao | Aula #1 confirmada (Tema: Gravação)... |
| usuario | João Silva |
| dados_adicionais | Estado anterior: pendente \| Observação: ... |
| criado_em | 2024-11-20 16:45:22 |

---

### 4. **Ver Histórico de Logs**

Mostra todo o histórico de uma aula:
- ✅ Quando foi criada
- ✅ Quem confirmou/recusou
- ✅ Mudanças de estado
- ✅ Observações adicionadas
- ✅ Tudo em ordem cronológica

---

### 5. **Listar Pendentes por Mentor**

Para cada mentor ver:
- ✅ Quais aulas aguardam decisão
- ✅ Quando são
- ✅ Para que turmas
- ✅ Que temas

---

## 🎯 Estados das Aulas (Atualizado)

```
RASCUNHO → (sem mentor)
    ↓
    atribuir mentor
    ↓
PENDENTE → (aguarda confirmação)
    ↓
    ├─→ CONFIRMAR → CONFIRMADA ✅
    │
    └─→ RECUSAR → RECUSADA ❌
```

---

## 📊 Estrutura de Ficheiros Final

```
rap_nova_escola/
├── main.py                          ✅ ATUALIZADO (9 opções no menu aulas)
├── services/
│   ├── __init__.py                  ✅ ATUALIZADO
│   ├── aula_service.py             ✅ Existe
│   └── confirmacao_service.py      ✅ NOVO!
├── database/
│   └── connection.py               ✅ Existe
├── config/
│   └── settings.py                 ✅ Existe
└── .env                             ✅ Configurado
```

---

## 🎓 Conceitos Importantes

### 🔐 Validação de Permissões

```python
# Só o mentor ATRIBUÍDO pode confirmar/recusar
if mentor_aula_id != mentor_id:
    return erro  # Mentor errado!
```

**Porquê?** Evita que qualquer mentor confirme aulas de outros.

---

### 📝 Logs como Auditoria

**Todos os logs têm:**
- Quem fez
- O quê fez
- Quando fez
- Porquê fez (dados adicionais)

**Vantagens:**
- ✅ Rastreabilidade completa
- ✅ Histórico de mudanças
- ✅ Debugging fácil
- ✅ Transparência

---

### ⏱️ Timestamps Automáticos

```sql
atualizado_em = CURRENT_TIMESTAMP
```

**Automático!** Não tens que calcular manualmente.

---

## 💡 Casos de Uso Reais

### Caso 1: Mentor Confirma Sessão
```
1. Mentor João recebe lista de pendentes
2. Vê aula #5 para 2024-12-20
3. Confirma com observação "Tudo OK"
4. Sistema cria log
5. Aula fica "confirmada" ✅
```

### Caso 2: Mentor Recusa por Doença
```
1. Mentor Maria vê aula #7
2. Está doente, não pode dar
3. Recusa com motivo "Doença"
4. Sistema cria log
5. Coordenador vê recusa
6. Atribui outro mentor
```

### Caso 3: Auditar Histórico
```
1. Coordenador quer saber o que aconteceu com aula #3
2. Menu → Ver Logs
3. Vê cronologia completa:
   - Criada em 15/11
   - Mentor atribuído em 16/11
   - Confirmada em 17/11
4. Tudo documentado!
```

---

## 🎉 Resumo

**Sistema Completo de Confirmação Implementado!**

✅ Mentor pode confirmar aulas  
✅ Mentor pode recusar com motivo  
✅ Logs automáticos de tudo  
✅ Validações de segurança  
✅ Histórico auditável  
✅ Interface amigável  

**Próximos Módulos Possíveis:**
- Gestão de Mentores
- Gestão de Turmas
- Gestão de Equipamentos
- Relatórios e Estatísticas

---

**Testa o sistema e avisa-me como correu! 🚀**
