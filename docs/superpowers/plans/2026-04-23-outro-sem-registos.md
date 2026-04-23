# Outro (Sem Registos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third session type "Outro (Sem Registos)" to /horarios — a standalone event with a free-text title, multi-user participant checkboxes, date/time, and observations, created directly as confirmed with in-app notifications.

**Architecture:** New `aula_participantes` table holds the many-to-many relationship between `aulas` (tipo='outro') and users. The existing `aulas` table is reused with `tema` for the title and `duracao_minutos` computed from start/end times. Backend service `criar_aula()` inserts participants and sends per-user notifications after commit. Frontend adds a third tab in the creation modal with checkboxes for all equipa members.

**Tech Stack:** FastAPI, psycopg2, SQLModel/Pydantic, PostgreSQL; React + TypeScript, TanStack Query, shadcn/ui (Tabs, Checkbox, Input, Textarea), Tailwind CSS.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `migrations/031_aula_participantes.sql` | Create | New `aula_participantes` table |
| `models/sqlmodel_models.py` | Modify | Add `participantes_ids` to AulaCreate/Read/ListItem |
| `services/aula_service.py` | Modify | criar_aula(): participants insert + notifications; listar_todas_aulas(): include participantes |
| `main.py` | Modify | Pass `participantes_ids` + `criador_user_id` to criar_aula |
| `frontend/src/types/index.ts` | Modify | Add `participantes_ids` to AulaAPI + AulaCreate |
| `frontend/src/pages/Horarios.tsx` | Modify | New tab + form state + handleSave branch + calendar rendering + detail modal + legend |
| `tests/test_outro_session.py` | Create | Model validation tests |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/031_aula_participantes.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 031_aula_participantes.sql
-- Tabela de participantes para sessões do tipo 'outro'

CREATE TABLE IF NOT EXISTS aula_participantes (
    id SERIAL PRIMARY KEY,
    aula_id INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aula_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_aula_participantes_aula_id ON aula_participantes(aula_id);
CREATE INDEX IF NOT EXISTS idx_aula_participantes_user_id ON aula_participantes(user_id);
```

- [ ] **Step 2: Execute in Supabase SQL editor**

Paste the SQL above into the Supabase dashboard → SQL Editor → Run.

- [ ] **Step 3: Verify table was created**

Run in Supabase SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'aula_participantes'
ORDER BY ordinal_position;
```

Expected output: columns `id`, `aula_id`, `user_id`, `criado_em`.

- [ ] **Step 4: Commit migration file**

```bash
cd "/Users/gmsr44/Desktop/Outros Projetos/Rap Nova Escola/BPM_RAP_Nova_Escola-main"
git add migrations/031_aula_participantes.sql
git commit -m "feat: add aula_participantes migration for outro session type"
```

---

## Task 2: Backend Model Updates

**Files:**
- Modify: `models/sqlmodel_models.py:128-237`
- Create: `tests/test_outro_session.py`

- [ ] **Step 1: Write failing model test**

Create `tests/test_outro_session.py`:

```python
import pytest
from models.sqlmodel_models import AulaCreate, AulaListItem, AulaRead


def test_aula_create_accepts_participantes_ids():
    aula = AulaCreate(
        data_hora="2026-04-23 10:00",
        duracao_minutos=60,
        tipo="outro",
        participantes_ids=["uuid-1", "uuid-2"],
    )
    assert aula.participantes_ids == ["uuid-1", "uuid-2"]


def test_aula_create_defaults_participantes_ids_to_empty():
    aula = AulaCreate(
        data_hora="2026-04-23 10:00",
        duracao_minutos=60,
        tipo="pratica_escrita",
    )
    assert aula.participantes_ids == []


def test_aula_list_item_includes_participantes_ids():
    item = AulaListItem(
        id=1,
        tipo="outro",
        data_hora="2026-04-23T10:00:00",
        duracao_minutos=60,
        estado="confirmada",
        participantes_ids=["uuid-1"],
    )
    assert item.participantes_ids == ["uuid-1"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/gmsr44/Desktop/Outros Projetos/Rap Nova Escola/BPM_RAP_Nova_Escola-main"
python -m pytest tests/test_outro_session.py -v
```

Expected: FAIL — `AulaCreate` has no `participantes_ids` field.

- [ ] **Step 3: Add `participantes_ids` to AulaCreate**

In `models/sqlmodel_models.py`, after line 148 (`tarefa_id: Optional[int] = None`), add:

```python
    participantes_ids: List[str] = []
```

So the end of `AulaCreate` becomes:
```python
    musica_id: Optional[int] = None
    tarefa_id: Optional[int] = None
    participantes_ids: List[str] = []
```

- [ ] **Step 4: Add `participantes_ids` to AulaRead**

In `models/sqlmodel_models.py`, at the end of `class AulaRead` (after the `tarefa_id` field near line 200), add:

```python
    participantes_ids: List[str] = []
```

- [ ] **Step 5: Add `participantes_ids` to AulaListItem**

In `models/sqlmodel_models.py`, at the end of `class AulaListItem` (after `obs_termino` and `tarefa_id` fields near line 237), add:

```python
    participantes_ids: List[str] = []
```

- [ ] **Step 6: Run test to verify it passes**

```bash
python -m pytest tests/test_outro_session.py -v
```

Expected: PASS — all 3 tests green.

- [ ] **Step 7: Commit**

```bash
git add models/sqlmodel_models.py tests/test_outro_session.py
git commit -m "feat: add participantes_ids field to Aula models"
```

---

## Task 3: Backend Service — criar_aula()

**Files:**
- Modify: `services/aula_service.py:125-221`

- [ ] **Step 1: Update function signature** (line 125)

Replace the signature of `criar_aula` to add two new parameters after `tarefa_id`:

```python
def criar_aula(
    turma_id,
    data_hora,
    tipo="pratica_escrita",
    duracao_minutos=90,
    mentor_id=None,
    local=None,
    tema=None,
    objetivos=None,
    projeto_id=None,
    observacoes=None,
    atividade_uuid=None,
    is_autonomous=False,
    is_realized=False,
    tipo_atividade=None,
    responsavel_user_id=None,
    musica_id=None,
    sumario=None,
    codigo_sessao=None,
    tarefa_id=None,
    participantes_ids=None,
    criador_user_id=None,
):
```

- [ ] **Step 2: Add `is_outro` flag and update validation guard** (lines 146-150)

Replace:
```python
    is_interno = tipo == "trabalho_interno"

    if not is_autonomous and not is_interno and not turma_id:
```

With:
```python
    is_interno = tipo == "trabalho_interno"
    is_outro = tipo == "outro"

    if not is_autonomous and not is_interno and not is_outro and not turma_id:
```

- [ ] **Step 3: Update initial estado logic** (lines 159-164)

Replace:
```python
    if is_interno:
        estado_inicial = "confirmada"
    elif is_autonomous:
        estado_inicial = "autonomo"
    else:
        estado_inicial = ESTADO_PENDENTE if mentor_id else ESTADO_RASCUNHO
```

With:
```python
    if is_interno or is_outro:
        estado_inicial = "confirmada"
    elif is_autonomous:
        estado_inicial = "autonomo"
    else:
        estado_inicial = ESTADO_PENDENTE if mentor_id else ESTADO_RASCUNHO
```

- [ ] **Step 4: Add participants insert + notifications block**

After line 215 (end of the existing mentor notification `except` block), before `return _to_aula_read_dict(nova_aula)`, add:

```python
        if is_outro and participantes_ids:
            try:
                from services import notification_service
                conn = get_db_connection()
                cur = conn.cursor()
                for uid in participantes_ids:
                    cur.execute(
                        "INSERT INTO aula_participantes (aula_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (nova_aula.id, uid),
                    )
                    if uid != criador_user_id:
                        notification_service.criar_notificacao(
                            user_id=uid,
                            tipo="sessao_outro",
                            titulo=f"Nova sessão: {tema or 'Outro'}",
                            mensagem=f'Foste adicionado a "{tema or "Outro"}" em {data_hora_dt.strftime("%d/%m %H:%M")}.',
                            link="/horarios",
                            metadados={"aula_id": nova_aula.id},
                        )
                conn.commit()
                logger.info("Participantes inseridos para aula #%s", nova_aula.id)
            except Exception as e:
                logger.warning("Erro ao inserir participantes: %s", e)
                if 'conn' in locals() and conn:
                    conn.rollback()
            finally:
                if 'cur' in locals() and cur:
                    cur.close()
                if 'conn' in locals() and conn:
                    conn.close()
```

- [ ] **Step 5: Verify backend starts without import errors**

```bash
cd "/Users/gmsr44/Desktop/Outros Projetos/Rap Nova Escola/BPM_RAP_Nova_Escola-main"
python -c "from services.aula_service import criar_aula; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add services/aula_service.py
git commit -m "feat: criar_aula() supports tipo='outro' with participants and notifications"
```

---

## Task 4: Backend Service — listar_todas_aulas()

**Files:**
- Modify: `services/aula_service.py:676-735`

- [ ] **Step 1: Add batch participants fetch**

In `listar_todas_aulas()`, after line 688 (`rows = session.exec(statement).all()`), add a block to fetch participants for 'outro' aulas:

```python
        # Batch fetch participants for 'outro' aulas
        outro_aula_ids = [a.id for a, *_ in rows if a.tipo == 'outro']
        participantes_map: Dict[int, List[str]] = {}
        if outro_aula_ids:
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                placeholders = ','.join(['%s'] * len(outro_aula_ids))
                cur.execute(
                    f"SELECT aula_id, user_id FROM aula_participantes WHERE aula_id IN ({placeholders})",
                    outro_aula_ids,
                )
                for aula_id, user_id in cur.fetchall():
                    participantes_map.setdefault(aula_id, []).append(user_id)
            except Exception as e:
                logger.warning("Erro ao buscar participantes: %s", e)
            finally:
                if 'cur' in locals() and cur:
                    cur.close()
                if 'conn' in locals() and conn:
                    conn.close()
```

Note: `Dict` and `List` are already imported at the top of the file via `from typing import Any, Dict, List, Union`.

- [ ] **Step 2: Add `participantes_ids` to the payload dict**

In the `for aula, turma, estabelecimento, mentor in rows:` loop, inside the `payload = {...}` dict (after the last existing field `"tarefa_id": aula.tarefa_id`), add:

```python
                "participantes_ids": participantes_map.get(aula.id, []),
```

The end of the payload dict should look like:
```python
                "avaliacao": aula.avaliacao,
                "obs_termino": aula.obs_termino,
                "tarefa_id": aula.tarefa_id,
                "participantes_ids": participantes_map.get(aula.id, []),
```

- [ ] **Step 3: Verify backend starts without errors**

```bash
python -c "from services.aula_service import listar_todas_aulas; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add services/aula_service.py
git commit -m "feat: listar_todas_aulas returns participantes_ids for outro sessions"
```

---

## Task 5: Backend API Route

**Files:**
- Modify: `main.py:228-259`

- [ ] **Step 1: Pass `participantes_ids` and `criador_user_id` to criar_aula**

In `main.py`, in the `create_aula` endpoint function (lines 228-259), update the call to `aula_service.criar_aula(...)` to add two new arguments after `tarefa_id=...`:

```python
        tarefa_id=getattr(aula, 'tarefa_id', None),
        participantes_ids=aula.participantes_ids or [],
        criador_user_id=user.get('sub') if user else None,
```

The full updated call becomes:
```python
    nova_aula = aula_service.criar_aula(
        turma_id=aula.turma_id,
        data_hora=aula.data_hora,
        tipo=aula.tipo,
        duracao_minutos=aula.duracao_minutos,
        mentor_id=aula.mentor_id,
        local=aula.local,
        tema=aula.tema,
        objetivos=aula.objetivos,
        projeto_id=aula.projeto_id,
        observacoes=aula.observacoes,
        atividade_uuid=aula.atividade_uuid,
        is_autonomous=aula.is_autonomous,
        is_realized=aula.is_realized,
        tipo_atividade=aula.tipo_atividade,
        responsavel_user_id=aula.responsavel_user_id,
        musica_id=aula.musica_id,
        sumario=aula.sumario,
        codigo_sessao=aula.codigo_sessao,
        tarefa_id=getattr(aula, 'tarefa_id', None),
        participantes_ids=aula.participantes_ids or [],
        criador_user_id=user.get('sub') if user else None,
    )
```

- [ ] **Step 2: Verify backend starts**

```bash
python -c "import main; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Manual API test — create an 'outro' session**

Start the backend (`uvicorn main:app --reload`) and run:

```bash
curl -X POST http://localhost:8000/api/aulas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "data_hora": "2026-04-24 10:00",
    "duracao_minutos": 60,
    "tipo": "outro",
    "tema": "Reunião de equipa",
    "participantes_ids": []
  }'
```

Expected: 200 response with `"estado": "confirmada"` and `"tipo": "outro"`.

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "feat: POST /api/aulas passes participantes_ids and criador_user_id for outro type"
```

---

## Task 6: Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts:165-251`

- [ ] **Step 1: Add `participantes_ids` to `AulaAPI`**

In `frontend/src/types/index.ts`, inside `interface AulaAPI` (lines 165-197), after the `tarefa_titulo?: string | null;` line, add:

```typescript
  // Outro (Sem Registos)
  participantes_ids?: string[];
```

- [ ] **Step 2: Add `participantes_ids` to `AulaCreate`**

In `frontend/src/types/index.ts`, inside `interface AulaCreate` (lines 231-251), after `tarefa_id?: number | null;`, add:

```typescript
  participantes_ids?: string[];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/gmsr44/Desktop/Outros Projetos/Rap Nova Escola/BPM_RAP_Nova_Escola-main/frontend"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new type errors related to `participantes_ids`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add participantes_ids to AulaAPI and AulaCreate types"
```

---

## Task 7: Frontend Horarios.tsx — Tab, Form State, handleSave

**Files:**
- Modify: `frontend/src/pages/Horarios.tsx`

- [ ] **Step 1: Update `modalTab` type and add `outroForm` state**

Find line 438:
```typescript
  const [modalTab, setModalTab] = useState<'aula' | 'autonomo'>('aula');
```

Replace with:
```typescript
  const [modalTab, setModalTab] = useState<'aula' | 'autonomo' | 'outro'>('aula');
  const [outroForm, setOutroForm] = useState({
    titulo: '',
    participantes_ids: [] as string[],
    date: '',
    hora_inicio: '',
    hora_fim: '',
    observacoes: '',
  });
```

- [ ] **Step 2: Reset `outroForm` in `resetForm()`**

In the `resetForm()` function (around line 917), after `setAutonomousForm({...})`, add:

```typescript
    setOutroForm({
      titulo: '',
      participantes_ids: [],
      date: '',
      hora_inicio: '',
      hora_fim: '',
      observacoes: '',
    });
```

- [ ] **Step 3: Add 'outro' branch in `handleSave()`**

In `handleSave()`, before the existing `if (modalTab === 'autonomo')` block (line 997), add:

```typescript
    if (modalTab === 'outro') {
      if (!outroForm.titulo.trim()) {
        toast.error('O título é obrigatório.');
        return;
      }
      if (outroForm.participantes_ids.length === 0) {
        toast.error('Seleciona pelo menos um participante.');
        return;
      }
      if (!outroForm.date || !outroForm.hora_inicio || !outroForm.hora_fim) {
        toast.error('Data, hora de início e hora de fim são obrigatórios.');
        return;
      }
      const [hStart, mStart] = outroForm.hora_inicio.split(':').map(Number);
      const [hEnd, mEnd] = outroForm.hora_fim.split(':').map(Number);
      const duracao = (hEnd * 60 + mEnd) - (hStart * 60 + mStart);
      if (duracao <= 0) {
        toast.error('A hora de fim tem de ser posterior à hora de início.');
        return;
      }
      const payload: AulaCreate = {
        data_hora: `${outroForm.date} ${outroForm.hora_inicio}`,
        duracao_minutos: duracao,
        tipo: 'outro',
        tema: outroForm.titulo.trim(),
        observacoes: outroForm.observacoes || '',
        participantes_ids: outroForm.participantes_ids,
      };
      createSessionMutation.mutate(payload);
      return;
    }
```

- [ ] **Step 4: Update TabsList to `grid-cols-3` and add "Outro" trigger**

Find the `TabsList` component (around line 1262):
```tsx
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="aula">Aula / Evento</TabsTrigger>
                      <TabsTrigger value="autonomo" className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        Autónomo
                      </TabsTrigger>
                    </TabsList>
```

Replace with:
```tsx
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="aula">Aula / Evento</TabsTrigger>
                      <TabsTrigger value="autonomo" className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        Autónomo
                      </TabsTrigger>
                      <TabsTrigger value="outro" className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Outro
                      </TabsTrigger>
                    </TabsList>
```

Note: `Users` icon — verify it's already imported from `lucide-react` at the top of Horarios.tsx. If not, add `Users` to the lucide import line.

- [ ] **Step 5: Add "Outro" TabsContent with form fields**

After the closing `</TabsContent>` of the "autonomo" tab (around line 1850+), add a new `TabsContent` block:

```tsx
                    {/* ── Tab: Outro (Sem Registos) ── */}
                    <TabsContent value="outro">
                      <div className="grid gap-4 py-4">

                        {/* Título */}
                        <div className="space-y-2">
                          <Label htmlFor="outro-titulo">Título <span className="text-destructive">*</span></Label>
                          <Input
                            id="outro-titulo"
                            placeholder="Ex: Reunião de equipa"
                            value={outroForm.titulo}
                            onChange={(e) => setOutroForm({ ...outroForm, titulo: e.target.value })}
                          />
                        </div>

                        {/* Quem */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Quem <span className="text-destructive">*</span></Label>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground underline"
                              onClick={() => {
                                const allIds = (equipa ?? []).map(p => p.id);
                                const allSelected = allIds.every(id => outroForm.participantes_ids.includes(id));
                                setOutroForm({
                                  ...outroForm,
                                  participantes_ids: allSelected ? [] : allIds,
                                });
                              }}
                            >
                              {((equipa ?? []).every(p => outroForm.participantes_ids.includes(p.id))) ? 'Desselecionar todos' : 'Selecionar todos'}
                            </button>
                          </div>
                          <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                            {(equipa ?? []).map((p) => (
                              <div key={p.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`outro-p-${p.id}`}
                                  checked={outroForm.participantes_ids.includes(p.id)}
                                  onCheckedChange={(checked) => {
                                    setOutroForm({
                                      ...outroForm,
                                      participantes_ids: checked
                                        ? [...outroForm.participantes_ids, p.id]
                                        : outroForm.participantes_ids.filter(id => id !== p.id),
                                    });
                                  }}
                                />
                                <label htmlFor={`outro-p-${p.id}`} className="text-sm cursor-pointer flex-1">
                                  {p.full_name}
                                  <span className="ml-1.5 text-xs text-muted-foreground capitalize">({p.role})</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Data */}
                        <div className="space-y-2">
                          <Label htmlFor="outro-date">Data <span className="text-destructive">*</span></Label>
                          <input
                            id="outro-date"
                            type="date"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            value={outroForm.date}
                            onChange={(e) => setOutroForm({ ...outroForm, date: e.target.value })}
                          />
                        </div>

                        {/* Hora início / fim */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Início <span className="text-destructive">*</span></Label>
                            <TimePicker5Min
                              value={outroForm.hora_inicio}
                              onChange={(v) => setOutroForm({ ...outroForm, hora_inicio: v })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Fim <span className="text-destructive">*</span></Label>
                            <TimePicker5Min
                              value={outroForm.hora_fim}
                              onChange={(v) => setOutroForm({ ...outroForm, hora_fim: v })}
                            />
                          </div>
                        </div>

                        {/* Observações */}
                        <div className="space-y-2">
                          <Label htmlFor="outro-obs">Observações</Label>
                          <Textarea
                            id="outro-obs"
                            placeholder="Notas opcionais..."
                            value={outroForm.observacoes}
                            onChange={(e) => setOutroForm({ ...outroForm, observacoes: e.target.value })}
                          />
                        </div>

                      </div>
                    </TabsContent>
```

- [ ] **Step 6: Verify `Textarea` is imported**

Check that `Textarea` is imported from `@/components/ui/textarea` in Horarios.tsx. If not, add:
```typescript
import { Textarea } from '@/components/ui/textarea';
```

- [ ] **Step 7: Run TypeScript check**

```bash
cd "/Users/gmsr44/Desktop/Outros Projetos/Rap Nova Escola/BPM_RAP_Nova_Escola-main/frontend"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Horarios.tsx
git commit -m "feat: add Outro tab to session creation modal with participant checkboxes"
```

---

## Task 8: Calendar Rendering for tipo='outro'

**Files:**
- Modify: `frontend/src/pages/Horarios.tsx:89-116` (constants) and `1117-1178` (renderDayEvents)

- [ ] **Step 1: Add pink constant for outro sessions**

Near line 100 (after `autonomousRealizedClass`), add:

```typescript
const outroClass = 'bg-pink-200 border-pink-400 text-pink-900';
```

- [ ] **Step 2: Update `renderDayEvents` event class logic**

Find the `eventClass` assignment (around line 1120):
```typescript
      const eventClass = isAutonomous
        ? (isRealized ? autonomousRealizedClass : autonomousPlannedClass)
        : (statusColors[event.estado as SessionStatus] || 'bg-secondary');
```

Replace with:
```typescript
      const isOutro = event.tipo === 'outro';
      const eventClass = isOutro
        ? outroClass
        : isAutonomous
          ? (isRealized ? autonomousRealizedClass : autonomousPlannedClass)
          : (statusColors[event.estado as SessionStatus] || 'bg-secondary');
```

- [ ] **Step 3: Update event title attribute for outro**

Find the `title` prop of the event `<div>` (around line 1137):
```typescript
          title={isAutonomous
            ? `${format(event.start, 'HH:mm')} — ${event.tipo_atividade ?? 'Trabalho Autónomo'}`
            : `${format(event.start, 'HH:mm')} - ${event.turma_nome}`
          }
```

Replace with:
```typescript
          title={isOutro
            ? `${format(event.start, 'HH:mm')} — ${event.tema ?? 'Outro'}`
            : isAutonomous
              ? `${format(event.start, 'HH:mm')} — ${event.tipo_atividade ?? 'Trabalho Autónomo'}`
              : `${format(event.start, 'HH:mm')} - ${event.turma_nome}`
          }
```

- [ ] **Step 4: Add outro render branch inside the event block**

Find the event content render (around line 1151):
```tsx
          {isAutonomous ? (
            <>...</>
          ) : (
            <>...</>
          )}
```

Replace with:
```tsx
          {isOutro ? (
            <>
              <div className={cn('truncate font-semibold flex items-center gap-1', compact ? 'text-xs' : 'text-[10px]')}>
                <Users className={cn(iconSize, 'flex-shrink-0')} />
                {event.tema ?? 'Outro'}
              </div>
              <div className={cn('truncate opacity-90 mt-0.5', subTextSize)}>
                {(event.participantes_ids?.length ?? 0)} participante{(event.participantes_ids?.length ?? 0) !== 1 ? 's' : ''}
              </div>
            </>
          ) : isAutonomous ? (
            <>
              <div className={cn('truncate font-semibold flex items-center gap-1', compact ? 'text-xs' : 'text-[10px]')}>
                <Briefcase className={cn(iconSize, 'flex-shrink-0')} />
                {event.tipo_atividade ?? 'Trabalho Autónomo'}
              </div>
              <div className={cn('truncate opacity-90 mt-0.5 flex items-center gap-1', subTextSize)}>
                <User className={iconSize} />
                {equipa?.find(p => p.id === event.responsavel_user_id)?.full_name?.split(' ')[0] ?? '?'}
              </div>
              {isRealized && <div className={cn('mt-0.5 opacity-80', subTextSize)}>✓ Realizado</div>}
            </>
          ) : (
            <>
              <div className={cn('truncate font-semibold', compact ? 'text-xs' : 'text-[10px]')}>
                {event.turma_nome}
                <span className="opacity-75 font-normal ml-1">({event.estabelecimento_nome})</span>
              </div>
              <div className={cn('truncate opacity-90 mt-0.5 flex items-center gap-1', subTextSize)}>
                <User className={iconSize} />
                {event.mentor_nome?.split(' ')[0] ?? 'S/ Mentor'}
              </div>
            </>
          )}
```

- [ ] **Step 5: Update mini-month event pill (around line 2515-2520)**

Find the mini-month event pill (inside the list view / month view), which has a similar `statusColors` usage:

```tsx
                            session.is_autonomous
                              ? (session.is_realized ? '...' : '...')
                              : (statusColors[session.estado as SessionStatus] || 'bg-secondary')
```

Update to also handle `tipo='outro'`:
```tsx
                            session.tipo === 'outro'
                              ? outroClass
                              : session.is_autonomous
                                ? (session.is_realized ? 'bg-[#4EA380]/20 text-[#2d7a5c] border border-[#4EA380]' : 'bg-muted text-muted-foreground border border-dashed border-muted-foreground/40')
                                : (statusColors[session.estado as SessionStatus] || 'bg-secondary')
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Horarios.tsx
git commit -m "feat: render outro sessions in pink pastel on calendar"
```

---

## Task 9: Detail Modal + Legend

**Files:**
- Modify: `frontend/src/pages/Horarios.tsx:2630-2730` (detail modal) and `2342-2351` (legend)

- [ ] **Step 1: Add 'outro' branch in detail modal badge**

Find the badge in the detail modal (around line 2637):
```tsx
              {viewSession && (
                viewSession.is_autonomous ? (
                  <Badge ...>...</Badge>
                ) : (
                  <Badge className={statusColors[viewSession.estado as SessionStatus]}>
                    {viewSession.estado}
                  </Badge>
                )
              )}
```

Replace with:
```tsx
              {viewSession && (
                viewSession.tipo === 'outro' ? (
                  <Badge className="bg-pink-200 text-pink-900 border-pink-400">Outro</Badge>
                ) : viewSession.is_autonomous ? (
                  <Badge className={viewSession.is_realized ? 'bg-green-100 text-green-800 border-green-300' : 'bg-muted text-muted-foreground border-dashed'}>
                    {viewSession.is_realized ? 'Trabalho Realizado' : 'Trabalho Planeado'}
                  </Badge>
                ) : (
                  <Badge className={statusColors[viewSession.estado as SessionStatus]}>
                    {viewSession.estado}
                  </Badge>
                )
              )}
```

- [ ] **Step 2: Add 'outro' content branch in detail modal body**

Find the content section (around line 2666):
```tsx
              {viewSession.is_autonomous ? (
                <div className="space-y-1">
                  ...autonomous content...
                </div>
              ) : (
                <>
                  ...regular session content...
                </>
              )}
```

Replace with:
```tsx
              {viewSession.tipo === 'outro' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium uppercase">Título</p>
                    <p className="font-semibold text-base">{viewSession.tema || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-1">
                      <Users className="w-3 h-3" /> Participantes
                    </p>
                    <div className="p-2 bg-secondary/30 rounded-md space-y-1">
                      {(viewSession.participantes_ids ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum participante</p>
                      ) : (
                        (viewSession.participantes_ids ?? []).map(uid => {
                          const member = equipa?.find(p => p.id === uid);
                          return (
                            <div key={uid} className="flex items-center gap-2">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm">{member?.full_name ?? uid}</span>
                              {member && <span className="text-xs text-muted-foreground capitalize">({member.role})</span>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  {viewSession.observacoes && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium uppercase">Observações</p>
                      <p className="text-sm">{viewSession.observacoes}</p>
                    </div>
                  )}
                </div>
              ) : viewSession.is_autonomous ? (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase">Trabalho Autónomo</p>
                  <div className="p-2 bg-secondary/30 rounded-md space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold">Tipo de Atividade:</span>
                      <span className="text-sm">{viewSession.tipo_atividade || '-'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium uppercase">Turma & Local</p>
                    <div className="p-2 bg-secondary/30 rounded-md">
                      <p className="font-bold text-base">{viewSession.turma_nome}</p>
                      <p className="text-sm text-muted-foreground">{viewSession.estabelecimento_nome}</p>
                      {viewSession.local && (
                        <p className="text-xs mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {viewSession.local}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium uppercase">Currículo</p>
                    <div className="p-2 bg-secondary/30 rounded-md space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold">Disciplina:</span>
                        <span className="text-sm">{viewSession.disciplina_nome || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold">Atividade:</span>
                        <span className="text-sm">{viewSession.atividade_nome || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold">Nº Sessão:</span>
                        <span className="text-sm">{viewSession.tema || '-'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
```

- [ ] **Step 3: Add "Outro" entry to legend**

Find the legend area (around line 2342):
```tsx
        {/* Legenda — Trabalho Autónomo */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border-2 border-dashed border-muted-foreground/60 bg-muted/50" />
          <span className="text-sm text-muted-foreground">Trabalho Planeado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border-2 border-[#4EA380] bg-[#4EA380]/20" />
          <span className="text-sm text-muted-foreground">Trabalho Realizado</span>
        </div>
```

After the "Trabalho Realizado" legend entry, add:
```tsx
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border-2 border-pink-400 bg-pink-200" />
          <span className="text-sm text-muted-foreground">Outro</span>
        </div>
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/gmsr44/Desktop/Outros Projetos/Rap Nova Escola/BPM_RAP_Nova_Escola-main/frontend"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5: Run the dev server and verify manually**

```bash
cd "/Users/gmsr44/Desktop/Outros Projetos/Rap Nova Escola/BPM_RAP_Nova_Escola-main/frontend"
npm run dev
```

Open http://localhost:5173/horarios and:
1. Click "Nova Sessão" — verify 3 tabs appear (Aula/Evento, Autónomo, Outro)
2. Click "Outro" tab — verify form shows Título, Quem (checkboxes), Data, Início/Fim, Observações
3. Fill in form and submit — verify pink block appears on calendar
4. Click pink block — verify detail modal shows title + participant list

- [ ] **Step 6: Final commit**

```bash
git add frontend/src/pages/Horarios.tsx
git commit -m "feat: outro session detail modal, legend, and complete Horarios integration"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|---|---|
| New table `aula_participantes` | Task 1 |
| `tipo='outro'` reuses `aulas` table | Tasks 2-5 |
| `tema` stores title | Tasks 3, 7 |
| `estado='confirmada'` on create | Task 3 |
| `is_autonomous=FALSE`, no turma/mentor | Task 3 |
| `participantes_ids` in API response | Tasks 2, 4 |
| Notifications per participant (skip creator) | Task 3 |
| `AulaCreate` + `AulaListItem` + `AulaRead` updated | Task 2 |
| Frontend: 3rd tab with all 5 fields | Task 7 |
| Checkboxes from `/api/equipa` | Task 7 |
| Select-all toggle | Task 7 |
| Validation (title, ≥1 participant, date/time) | Task 7 |
| Pink pastel calendar rendering | Task 8 |
| Detail modal shows title + participant names | Task 9 |
| Legend entry | Task 9 |
| Dashboard (via existing "próximas sessões" widgets) | Covered by Task 4 — `listar_todas_aulas` returns 'outro' aulas like any other confirmed session |

### Notes
- Dashboard appearance: existing dashboard components query `/api/aulas` and filter by `estado='confirmada'` — 'outro' sessions appear automatically once the backend returns them correctly (Task 4).
- The `tarefa_titulo` field was present in `AulaAPI` per the existing code; `participantes_ids` is added after it in Task 6.
- `Users` icon from lucide-react: verify it's in the existing import list in Horarios.tsx. If missing, add to the lucide import line.
