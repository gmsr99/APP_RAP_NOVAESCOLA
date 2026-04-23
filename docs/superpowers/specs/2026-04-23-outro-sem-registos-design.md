# Design: Sessão "Outro (Sem Registos)"

**Data:** 2026-04-23  
**Estado:** Aprovado

## Objetivo

Adicionar um terceiro tipo de sessão ao módulo `/horarios`, chamado **"Outro (Sem Registos)"**, para eventos transversais à equipa (ex: reuniões) que não geram registos de sessão nem estão associados a projeto/turma/estabelecimento.

---

## Modelo de Dados

### Nova tabela: `aula_participantes`

```sql
CREATE TABLE aula_participantes (
    id SERIAL PRIMARY KEY,
    aula_id INTEGER REFERENCES aulas(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,  -- UUID Supabase auth
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aula_id, user_id)
);
```

`ON DELETE CASCADE` garante limpeza automática ao apagar a aula.

### Tabela `aulas` — sem colunas novas

Campos reutilizados para `tipo='outro'`:

| Campo | Valor |
|-------|-------|
| `tipo` | `'outro'` (novo valor válido) |
| `tema` | Título livre (ex: "Reunião de equipa X") |
| `data_hora` | Hora de início |
| `duracao_minutos` | Calculado de (hora_fim - hora_inicio) |
| `observacoes` | Campo livre opcional |
| `estado` | `'confirmada'` (criado diretamente) |
| `is_autonomous` | `FALSE` |
| `turma_id` | `NULL` |
| `mentor_id` | `NULL` |
| `projeto_id` | `NULL` |

---

## Backend

### Models (`models/sqlmodel_models.py`)

- `AulaCreate` — adicionar `participantes_ids: Optional[List[str]] = []`
- `AulaListItem` / `AulaRead` — adicionar `participantes_ids: List[str] = []`

### `services/aula_service.py` — `criar_aula()`

Após inserir a aula, se `tipo='outro'` e `participantes_ids` não vazio:
1. Inserir cada `(aula_id, user_id)` em `aula_participantes`
2. Chamar `criar_notificacao()` para cada participante:
   - `tipo='sessao_outro'`
   - `titulo=f"Nova sessão: {tema}"`
   - `mensagem` com data/hora formatados
   - `link='/horarios'`

### `services/aula_service.py` — `listar_todas_aulas()`

Para aulas com `tipo='outro'`, fazer LEFT JOIN a `aula_participantes` e agregar `user_id` como array no resultado (`participantes_ids`).

### Endpoints

Nenhum endpoint novo — criação/edição/eliminação reutilizam os existentes (`POST /api/aulas`, `PUT /api/aulas/{id}`, `DELETE /api/aulas/{id}`).

---

## Frontend

### Horarios.tsx — novo tab "Outro" no modal de criação

Campos por ordem:
1. **Título** — `<Input>` livre → `tema`
2. **Quem** — checkboxes com todos os users de `/api/equipa` (nome + role), com opção "Selecionar todos"
3. **Data** — `<input type="date">`
4. **Hora de início / Hora de fim** — `<TimePicker5Min>` (componente existente)
5. **Observações** — `<Textarea>` → `observacoes`

Validação mínima: título obrigatório, pelo menos 1 participante, data obrigatória.

### Calendário

Aulas com `tipo='outro'` renderizadas com cores rosa pastel:
- `bg-pink-200 border-pink-400 text-pink-900`

Ao clicar: modal de detalhe mostra título + lista de participantes (nomes completos).

### Dashboard

Sessões `tipo='outro'` aparecem nas widgets de "próximas sessões" existentes como qualquer sessão confirmada. Cada membro vê apenas as sessões onde `participantes_ids` inclui o seu `currentUserId`.

### Tipos TypeScript (`frontend/src/types/index.ts`)

```typescript
// AulaAPI — adicionar campo
participantes_ids?: string[];
```

---

## Notificações

Ao criar uma sessão `tipo='outro'`, o sistema notifica cada participante selecionado via `criar_notificacao()` (in-app + push). O criador da sessão não recebe notificação (já sabe).

---

## Fora de Âmbito

- Edição de participantes após criação (não pedido)
- Exportação/estatísticas para este tipo (sem registos por definição)
- Confirmação/rejeição (criado diretamente como `confirmada`)
