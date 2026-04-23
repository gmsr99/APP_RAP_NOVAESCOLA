# Digitalização de Registos de Sessão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow mentors to upload a photo/scan of the session register when ending a session. The upload is mandatory (configurable per project). Directors/IT can export compiled PDFs with filters.

**Architecture:** `aula_registos` table stores the storage path per session. Supabase Storage bucket `registos-sessoes` holds the files. The client compresses+converts to PDF before upload (<1MB). "Terminar Sessão" becomes a 2-step wizard. Project setting `requer_digitalizacao` is toggled in `/wiki`. Compiled PDF export lives in `/estatisticas`.

**Design spec:** `docs/superpowers/specs/2026-04-23-digitalizacao-registos-design.md`

**Tech Stack:** FastAPI, psycopg2, SQLModel, PostgreSQL, pypdf; React + TypeScript, TanStack Query, shadcn/ui, Tailwind; browser-image-compression, jspdf; Supabase Storage.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `migrations/032_aula_registos.sql` | Create | `projetos.requer_digitalizacao` column + `aula_registos` table |
| `models/sqlmodel_models.py` | Modify | Add `requer_digitalizacao` to `Projeto`, add `AulaRegisto` model |
| `services/registo_service.py` | Create | CRUD for `aula_registos` + PDF export compilation |
| `main.py` | Modify | New endpoints: POST/GET /api/aula-registos, GET /api/aula-registos/export, PATCH /api/projetos/{id}/config |
| `services/aula_service.py` | Modify | Validate `requer_digitalizacao` in `terminar_aula()` |
| `frontend/src/types/index.ts` | Modify | Add `AulaRegisto` type, add `requer_digitalizacao` to Projeto |
| `frontend/src/utils/registoUpload.ts` | Create | Image compression → PDF conversion → Supabase Storage upload utility |
| `frontend/src/pages/Horarios.tsx` | Modify | 2-step "Terminar Sessão" wizard (Step 1: upload; Step 2: rating+obs) |
| `frontend/src/pages/Wiki.tsx` | Modify | "Configurações do Projeto" button + settings modal with toggle |
| `frontend/src/pages/Estatisticas.tsx` | Modify | "Exportar Registos" button + filter modal |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/032_aula_registos.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 032_aula_registos.sql
-- Adiciona configuração de digitalização obrigatória aos projetos
-- e tabela para armazenar os registos de sessão uploadados

ALTER TABLE projetos ADD COLUMN IF NOT EXISTS requer_digitalizacao BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS aula_registos (
    id SERIAL PRIMARY KEY,
    aula_id INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    criado_por TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aula_id)
);

CREATE INDEX IF NOT EXISTS idx_aula_registos_aula_id ON aula_registos(aula_id);
```

- [ ] **Step 2: Commit the migration file**

```bash
git add migrations/032_aula_registos.sql
git commit -m "feat: add aula_registos migration for session scan uploads"
```

**Note for executor:** The migration must be run in the Supabase SQL Editor before deploying. Add a note at the end of the commit message or in a DEPLOY.md if one exists.

**Acceptance criteria:**
- Migration file exists and is syntactically valid SQL
- `projetos` gets `requer_digitalizacao BOOLEAN DEFAULT FALSE`
- `aula_registos` table has columns: `id`, `aula_id` (FK→aulas, CASCADE), `storage_path`, `criado_por`, `criado_em`, UNIQUE on `aula_id`
- Index on `aula_id`

---

## Task 2: Backend Models

**Files:**
- Modify: `models/sqlmodel_models.py`

**Context:** Current `Projeto` model (line ~15) has: `id`, `nome`, `descricao`, `data_inicio`, `data_fim`, `estado`, `observacoes`. No `requer_digitalizacao`.

- [ ] **Step 1: Add `requer_digitalizacao` to `Projeto` SQLModel**

Add after `observacoes`:
```python
requer_digitalizacao: bool = Field(default=False)
```

- [ ] **Step 2: Add `AulaRegisto` table model and `AulaRegistoCreate` Pydantic model**

```python
class AulaRegisto(SQLModel, table=True):
    __tablename__ = "aula_registos"

    id: Optional[int] = Field(default=None, primary_key=True)
    aula_id: int = Field(foreign_key="aulas.id")
    storage_path: str
    criado_por: str
    criado_em: Optional[datetime] = Field(default=None)


class AulaRegistoCreate(SQLModel):
    aula_id: int
    storage_path: str
```

- [ ] **Step 3: Commit**

**Acceptance criteria:**
- `Projeto.requer_digitalizacao` field exists, defaults to `False`
- `AulaRegisto` table model maps to `aula_registos`
- `AulaRegistoCreate` has `aula_id` and `storage_path`

---

## Task 3: Registo Service

**Files:**
- Create: `services/registo_service.py`

**Context:** Backend uses psycopg2 (`get_db_connection()`) for raw queries and SQLModel for ORM. Both patterns are used in `aula_service.py`. Use SQLModel session here for simplicity. Supabase Storage access uses the `supabase` Python client already available (check `main.py` or `services/` for existing import pattern).

Install dependency if not present: `pypdf` (for PDF compilation).

- [ ] **Step 1: Create `services/registo_service.py`**

Implement the following functions:

```python
def criar_registo(aula_id: int, storage_path: str, criador_user_id: str) -> dict:
    """Inserts a new aula_registos row. Returns {ok, id} or {ok, erro}."""

def obter_registo_por_aula(aula_id: int) -> Optional[dict]:
    """Returns the registo for a given aula_id, or None if not found."""

def compilar_pdf_registos(
    projeto_id: int,
    data_inicio: Optional[str],
    data_fim: Optional[str],
    estabelecimento_id: Optional[int],
    disciplina: Optional[str],
    mentor_id: Optional[str],
) -> bytes:
    """
    Queries aula_registos JOIN aulas with filters, generates signed URLs,
    downloads each PDF from Supabase Storage, compiles into a multi-page PDF
    using pypdf, with a footer per page (data, mentor, instituição, disciplina).
    Returns the compiled PDF as bytes.
    """
```

**Implementation notes for `compilar_pdf_registos`:**
- Build a raw SQL query joining `aula_registos ar` → `aulas a` → `turmas t` → `estabelecimentos e`, `mentores m`, filtering by the provided params
- For each result, generate a signed URL using the Supabase Storage API (TTL 60s). Check how the existing codebase accesses the Supabase admin/service client.
- Download the PDF bytes via `requests.get(signed_url)` or `httpx`
- Use `pypdf.PdfWriter` to merge all pages
- Add a footer text per page with: data, mentor nome, instituição, disciplina
- Return the final PDF as bytes

**Acceptance criteria:**
- `criar_registo` inserts row and returns `{"ok": True, "id": ...}`
- `obter_registo_por_aula` returns `{"aula_id", "storage_path", "criado_por", "criado_em"}` or `None`
- `compilar_pdf_registos` returns bytes of a valid PDF (can be tested with a stub that returns 1 page if no results)
- File has single clear responsibility, no route code

---

## Task 4: Backend Routes + Aula Validation

**Files:**
- Modify: `main.py`
- Modify: `services/aula_service.py`

### Part A — New endpoints in `main.py`

Add the following after the existing `DELETE /api/projetos/{id}/estabelecimentos/{estab_id}` block:

**1. `POST /api/aula-registos`** — Save storage path after upload
```python
class AulaRegistoPayload(BaseModel):
    aula_id: int
    storage_path: str

@app.post("/api/aula-registos", tags=["Registos"])
async def create_aula_registo(data: AulaRegistoPayload, user=Depends(get_current_user_required)):
    res = registo_service.criar_registo(data.aula_id, data.storage_path, user["sub"])
    if not res.get("ok"):
        raise HTTPException(400, res.get("erro", "Erro ao guardar registo"))
    return res
```

**2. `GET /api/aula-registos/{aula_id}`** — Check if session has a registo
```python
@app.get("/api/aula-registos/{aula_id}", tags=["Registos"])
async def get_aula_registo(aula_id: int, user=Depends(get_current_user_required)):
    registo = registo_service.obter_registo_por_aula(aula_id)
    if not registo:
        raise HTTPException(404, "Registo não encontrado")
    return registo
```

**3. `GET /api/aula-registos/export`** — Download compiled PDF

**IMPORTANT:** This route must be registered BEFORE `/api/aula-registos/{aula_id}` to prevent FastAPI from treating "export" as an aula_id path param.

```python
@app.get("/api/aula-registos/export", tags=["Registos"])
async def export_aula_registos(
    projeto_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    estabelecimento_id: Optional[int] = None,
    disciplina: Optional[str] = None,
    mentor_id: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    role = user.get("user_metadata", {}).get("role")
    if role not in ["direcao", "it_support"]:
        raise HTTPException(403, "Acesso negado")
    pdf_bytes = registo_service.compilar_pdf_registos(
        projeto_id, data_inicio, data_fim, estabelecimento_id, disciplina, mentor_id
    )
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=registos.pdf"})
```

**4. `PATCH /api/projetos/{id}/config`** — Update project settings
```python
class ProjetoConfig(BaseModel):
    requer_digitalizacao: bool

@app.patch("/api/projetos/{id}/config", tags=["Projetos"])
async def update_projeto_config(id: int, data: ProjetoConfig, user=Depends(get_current_user_required)):
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(403, "Acesso negado")
    # Update projetos SET requer_digitalizacao = %s WHERE id = %s
    # Use projeto_service or inline psycopg2
    ...
    return {"message": "Configurações atualizadas"}
```

For the PATCH implementation, either add a `atualizar_config_projeto(id, requer_digitalizacao)` to `projeto_service.py`, or use a direct psycopg2 call inline.

### Part B — `terminar_aula()` validation in `services/aula_service.py`

Inside `terminar_aula()`, after the `aula.is_autonomous` check, add:

```python
# Check if project requires digitalizacao
if aula.projeto_id:
    from models.sqlmodel_models import Projeto
    projeto = session.get(Projeto, aula.projeto_id)
    if projeto and projeto.requer_digitalizacao:
        from services import registo_service
        registo = registo_service.obter_registo_por_aula(aula_id)
        if not registo:
            return {"ok": False, "erro": "Este projeto requer a digitalização do registo antes de terminar a sessão."}
```

This check must happen inside the `with Session(engine) as session:` block, before the state change.

**Acceptance criteria:**
- `POST /api/aula-registos` returns `{ok: true, id: N}` for valid payload
- `GET /api/aula-registos/export` returns 403 for non-direcao/it_support
- `GET /api/aula-registos/export` is registered before `GET /api/aula-registos/{aula_id}` in file order
- `PATCH /api/projetos/{id}/config` updates `requer_digitalizacao` and returns 200
- `terminar_aula()` returns `{ok: false, erro: "..."}` when project requires digitalizacao and none uploaded

---

## Task 5: Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add `requer_digitalizacao` to the existing `Projeto` interface** (wherever it is defined in index.ts)

- [ ] **Step 2: Add `AulaRegisto` type**

```typescript
export interface AulaRegisto {
  id: number;
  aula_id: number;
  storage_path: string;
  criado_por: string;
  criado_em: string;
}
```

**Acceptance criteria:**
- `Projeto` type has `requer_digitalizacao?: boolean`
- `AulaRegisto` type exported from `types/index.ts`

---

## Task 6: Frontend Upload Utility + Dependencies

**Files:**
- Create: `frontend/src/utils/registoUpload.ts`
- Modify: `frontend/package.json` (via npm install)

**Context:** The upload pipeline is: capture image → compress (browser-image-compression) → convert to single-page PDF (jspdf) → validate <1MB → upload to Supabase Storage bucket `registos-sessoes` (using existing `@supabase/supabase-js` client) → return storage path.

Storage path format: `{projeto_id}/{aula_id}/registo.pdf`

- [ ] **Step 1: Install dependencies**
```bash
cd frontend && npm install browser-image-compression jspdf
```

- [ ] **Step 2: Create `frontend/src/utils/registoUpload.ts`**

```typescript
import imageCompression from 'browser-image-compression';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase'; // use existing supabase client import

const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const BUCKET = 'registos-sessoes';

export interface UploadResult {
  ok: boolean;
  storagePath?: string;
  error?: string;
  sizeKb?: number;
}

export async function uploadRegistoSessao(
  file: File,
  projetoId: number,
  aulaId: number,
): Promise<UploadResult> {
  // 1. Compress image
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    initialQuality: 0.75,
  });

  // 2. Convert to single-page PDF via canvas
  const bitmap = await createImageBitmap(compressed);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  const imgData = canvas.toDataURL('image/jpeg', 0.75);

  const orientation = bitmap.width > bitmap.height ? 'l' : 'p';
  const pdf = new jsPDF({ orientation, unit: 'px', format: [bitmap.width, bitmap.height] });
  pdf.addImage(imgData, 'JPEG', 0, 0, bitmap.width, bitmap.height);
  const pdfBytes = pdf.output('arraybuffer');

  // 3. Validate size
  if (pdfBytes.byteLength > MAX_SIZE_BYTES) {
    return { ok: false, error: `Ficheiro demasiado grande (${Math.round(pdfBytes.byteLength / 1024)}KB). Máximo: 1MB.` };
  }

  // 4. Upload to Supabase Storage
  const path = `${projetoId}/${aulaId}/registo.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  return { ok: true, storagePath: path, sizeKb: Math.round(pdfBytes.byteLength / 1024) };
}
```

**Note:** Find the existing `supabase` client import path by searching for `createClient` in `frontend/src/`. Adjust the import accordingly.

**Acceptance criteria:**
- `browser-image-compression` and `jspdf` appear in `frontend/package.json` dependencies
- `registoUpload.ts` exports `uploadRegistoSessao(file, projetoId, aulaId): Promise<UploadResult>`
- Returns `{ok: false, error}` when PDF >1MB
- Returns `{ok: true, storagePath}` on success
- Uses existing Supabase client (does not create a new one)

---

## Task 7: Frontend — Horarios 2-step Wizard

**Files:**
- Modify: `frontend/src/pages/Horarios.tsx`

**Context:** The "Terminar Sessão" button opens a modal that currently has a single step: rating (1–5) + optional `obs_termino`. We need to insert a Step 1 before it. The modal is triggered via a `viewSession` state and a confirm/submit button calls `terminateSessionMutation`. Find the terminar modal by searching for "Terminar Sessão" in Horarios.tsx.

The `viewSession` object has `projeto_id`. Query `GET /api/projetos` (already fetched) to get `requer_digitalizacao` for the current session's project.

**Step 1 — Digitalização:**
- Title: "Digitalização do Registo"
- Upload input: `<input type="file" accept="image/*" capture="environment">` (camera on mobile, file picker on desktop)
- Show file name + size indicator once chosen: e.g. "342 KB / 1 MB"
- On select: call `uploadRegistoSessao` and show result (success=green checkmark, error=red message)
- If `requer_digitalizacao = true`: "Seguinte" button disabled until upload succeeds
- If `requer_digitalizacao = false`: show both "Seguinte" and "Ignorar" buttons

**Step 2 — Avaliação (existing):**
- Rating 1–5 stars
- Optional obs_termino textarea
- "Terminar Sessão" button (calls existing terminar mutation)

**Implementation approach:**
1. Add `terminateStep` state: `1 | 2`, reset to `1` when modal opens
2. Add `registoUploadState`: `{status: 'idle' | 'uploading' | 'done' | 'error', sizeKb?: number, error?: string}`
3. Wrap the existing terminar modal content as Step 2
4. Add Step 1 JSX before it, conditionally rendered by `terminateStep === 1`
5. "Seguinte"/"Ignorar" advances `terminateStep` to `2`
6. When modal closes/resets, reset both states

**Acceptance criteria:**
- "Terminar Sessão" modal shows Step 1 (upload) first
- Step 1 shows file size indicator after file selection
- If `requer_digitalizacao=true`, "Seguinte" is disabled until upload completes successfully
- If `requer_digitalizacao=false`, "Ignorar" button skips step 1
- Step 2 is the existing rating+obs form, unchanged in behavior
- `terminateSessionMutation` is still called with the same payload on Step 2 submit
- Modal resets step to 1 when closed/reopened
- Outro sessions (`tipo === 'outro'`) are not affected (they already have the terminar button hidden)

---

## Task 8: Frontend — Wiki Project Settings Modal

**Files:**
- Modify: `frontend/src/pages/Wiki.tsx`

**Context:** Wiki.tsx has a `selectedProjetoId` state and a list of projects. The `Projeto` interface in Wiki.tsx currently has: `id`, `nome`, `descricao?`, `estado?`. The existing `projetos` query fetches from `/api/projetos`. COORD_ROLES = `coordenador | direcao | it_support`. User role available via `useAuth()` hook (check existing usage in Wiki.tsx).

The "Configurações do Projeto" button should appear next to the project name/selector when a project is selected, visible only to coordenador, direcao, it_support.

**Implementation:**
1. Extend local `Projeto` interface to include `requer_digitalizacao?: boolean`
2. Add state: `isConfigModalOpen: boolean`, `configForm: { requer_digitalizacao: boolean }`
3. Add `saveConfigMutation` that calls `PATCH /api/projetos/{id}/config` with `{ requer_digitalizacao }`
4. Add a `<Button>` "⚙ Configurações" near the project selector, guarded by role check
5. On click: open modal, pre-fill toggle from `selectedProjeto?.requer_digitalizacao ?? false`
6. Modal contains:
   - Title: "Configurações do Projeto"
   - Toggle/Switch: "Exigir digitalização de registos"
   - Description: "Quando ativo, o mentor é obrigado a submeter a fotografia do registo antes de terminar cada sessão."
   - Buttons: "Cancelar" + "Guardar"
7. On save: call mutation, invalidate `['projetos']` query, close modal, show toast

**Acceptance criteria:**
- "⚙ Configurações" button appears only when a project is selected and user is coordenador/direcao/it_support
- Modal opens with current `requer_digitalizacao` value pre-filled
- Toggle changes the local form state
- "Guardar" calls `PATCH /api/projetos/{selectedProjetoId}/config` and shows toast
- Query cache `['projetos']` is invalidated on success so next open reflects new value

---

## Task 9: Frontend — Estatisticas Export Modal

**Files:**
- Modify: `frontend/src/pages/Estatisticas.tsx`

**Context:** Estatisticas.tsx already has an `exportOpen` state and an "Exportar Dados" button/modal. User role available via `useAuth()`. The new "Exportar Registos" button should appear alongside "Exportar Dados", visible only to `direcao` and `it_support`. It triggers a separate modal with project filters, then calls `GET /api/aula-registos/export` and auto-downloads the PDF.

**Implementation:**
1. Add state: `exportRegistosOpen: boolean`
2. Add filter state: `registosFilter: { projeto_id: number | null, data_inicio: string, data_fim: string, estabelecimento_id: number | null, disciplina: string, mentor_id: string }`
3. Add `isExportingRegistos: boolean` (loading state while downloading)
4. Add "Exportar Registos" button next to "Exportar Dados" — guarded: `role === 'direcao' || role === 'it_support'`
5. Modal contains:
   - Select "Projeto" (required) — populated from existing projetos query or a local fetch
   - DatePicker or date inputs for "Data Início" and "Data Fim"
   - Select "Instituição" (optional) — from existing estabelecimentos data if available, else skip
   - Input "Disciplina" (optional, free text)
   - Select "Mentor" (optional) — from existing equipa data if available, else skip
   - Button "Gerar PDF" — disabled if `projeto_id` not selected; shows spinner while loading
6. On "Gerar PDF":
   - Build query params from filter state
   - Call `api.get('/api/aula-registos/export', { params: {...}, responseType: 'blob' })`
   - Trigger browser download: create object URL, click anchor, revoke URL
   - File name: `Registos_{ProjetoNome}_{Periodo}.pdf`
7. Handle 403 (show toast "Acesso negado") and network errors

**Acceptance criteria:**
- "Exportar Registos" button only visible to `direcao` and `it_support`
- "Gerar PDF" disabled until `projeto_id` is selected
- PDF download triggers when API returns 200
- Loading spinner shown during request
- Error toast on failure
- Modal closes after successful download

---

## Dependency Order

```
Task 1 (migration)  ──┐
Task 2 (models)     ──┼──▶ Task 3 (service) ──▶ Task 4 (routes + validation)
                        │
Task 5 (FE types)   ──┐│
                        ├──▶ Task 6 (upload util) ──▶ Task 7 (wizard)
                        ├──▶ Task 8 (wiki modal)
                        └──▶ Task 9 (estatisticas modal)
```

Tasks 1, 2, 5 can start in parallel.
Task 6 depends on Task 5 (types) and npm deps.
Tasks 7, 8, 9 depend on Task 5 (types) but can otherwise run in parallel after Task 6.
Task 3 depends on Task 2. Task 4 depends on Task 3.

---

## Out of Scope

- Scan with border detection
- Multiple files per session
- Retroactive uploads for past sessions
- Automatic monthly generation
- Notifications for sessions missing a registo
