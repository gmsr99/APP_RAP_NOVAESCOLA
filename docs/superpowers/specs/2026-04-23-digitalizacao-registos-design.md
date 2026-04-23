# Digitalização de Registos de Sessão — Documento de Planeamento

**Data:** 2026-04-23  
**Estado:** Planeamento aprovado, aguarda implementação

---

## Objetivo

Tornar obrigatória (por projeto) a submissão de uma digitalização/fotografia da folha de registo no momento de terminar uma sessão. As digitalizações ficam armazenadas e são exportáveis em PDF compilado, filtrável por instituição, disciplina e mentor.

---

## Decisões Tomadas

| Questão | Decisão |
|---|---|
| Fotos por sessão | 1 ficheiro por sessão |
| Formato guardado | PDF (conversão no cliente antes do upload) |
| Tamanho máximo | 1MB por ficheiro (enforced no cliente + backend) |
| Export | PDF compilado, gerado on-demand pelo utilizador |
| Obrigatoriedade | Configurável por projeto (toggle em `/wiki`) |
| Retroatividade | Não — só sessões futuras contam |
| Step 1 opcional | Sim — para projetos sem digitalização obrigatória, o step aparece mas não bloqueia |
| Quem faz download | `direcao`, `it_support` |
| Localização do export | Página `/estatisticas`, botão "Exportar Registos" ao lado de "Exportar Dados" |

---

## Armazenamento — Supabase Storage

**Bucket:** `registos-sessoes` (privado, acesso via URLs assinadas)

**Organização de paths:**
```
registos-sessoes/
  {projeto_id}/
    {aula_id}/
      registo.pdf
```

**Capacidade estimada:** 100–400KB por sessão → 1GB cobre ~2500–10000 sessões.  
**Ação quando ~80% cheio:** upgrade do Supabase Storage (~$0.021/GB extra).

**Políticas RLS:**
- Upload: qualquer utilizador autenticado (mentor da sessão)
- Download: `direcao`, `it_support`, `coordenador`
- Delete: `it_support` apenas

---

## Modelo de Dados

### Alteração à tabela `projetos`

```sql
ALTER TABLE projetos ADD COLUMN requer_digitalizacao BOOLEAN DEFAULT FALSE;
```

### Nova tabela `aula_registos`

```sql
CREATE TABLE aula_registos (
    id SERIAL PRIMARY KEY,
    aula_id INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,           -- path no bucket Supabase
    criado_por TEXT NOT NULL,             -- user_id UUID Supabase
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aula_id)                       -- 1 registo por sessão
);

CREATE INDEX idx_aula_registos_aula_id ON aula_registos(aula_id);
```

---

## Pipeline de Captura/Upload (Frontend)

### Fluxo no cliente

```
Câmara / Galeria
       ↓
Captura imagem (JPG/PNG)
       ↓
Compressão + redimensionamento (JS, antes do upload)
  - Máx 1200×1600px
  - JPEG quality 0.75
  - Biblioteca: browser-image-compression (12KB gzipped)
       ↓
Conversão para PDF de 1 página (jsPDF + canvas)
  - Resultado típico: 100–400KB
       ↓
Validação de tamanho (rejeitar se > 1MB)
       ↓
Upload para Supabase Storage (bucket: registos-sessoes)
       ↓
Guardar path na tabela aula_registos via POST /api/aula-registos
```

### Suporte de input
- **Mobile:** `<input type="file" accept="image/*" capture="environment">` — abre câmara nativa diretamente
- **Desktop:** `<input type="file" accept="image/*">` — seleção de ficheiro da galeria/sistema

Não é implementado scan com deteção de bordas (complexidade desnecessária). A conversão para PDF via `jsPDF` é suficiente para o propósito de arquivo.

---

## Wizard "Terminar Sessão" — Alterações

### Estrutura actual
- 1 step: avaliação (rating + obs_termino)

### Nova estrutura (2 steps)

**Step 1 — Registo da Sessão**
- Título: "Digitalização do Registo"
- Área de upload com preview da imagem/PDF
- Botão "Tirar foto" (câmara) + botão "Escolher ficheiro" (galeria/desktop)
- Indicador de tamanho (ex: "342 KB / 1 MB")
- Se `projeto.requer_digitalizacao = true`: campo obrigatório, botão "Seguinte" desativado até haver ficheiro
- Se `false`: campo opcional, botão mostra "Seguinte" e "Ignorar"

**Step 2 — Avaliação da Sessão**
- Igual ao atual (rating 1–5 + campo de observações)
- Botão "Terminar Sessão" submete avaliação + chama endpoint existente

### Validação no backend

O endpoint `POST /api/aulas/{id}/terminar` deve verificar:
```python
if projeto.requer_digitalizacao:
    registo = obter_registo_aula(aula_id)
    if not registo:
        raise HTTPException(422, "Este projeto requer digitalização do registo.")
```

Isto garante que o frontend não pode ser contornado.

---

## Configuração por Projeto em `/wiki`

### Localização
Página `/wiki` → selecionar projeto → botão "⚙ Configurações do Projeto" (novo, visível apenas para `coordenador`, `direcao`, `it_support`)

### Modal de configurações
- Toggle: **"Exigir digitalização de registos"** (on/off)
- Descrição: "Quando ativo, o mentor é obrigado a submeter a fotografia do registo antes de terminar cada sessão."
- Salva via `PATCH /api/projetos/{id}` com `{ requer_digitalizacao: boolean }`

---

## Export PDF Compilado

### Localização
Página `/estatisticas` — botão **"Exportar Registos"** ao lado do botão "Exportar Dados" já existente.

### UI de filtragem
Modal com os filtros:
- **Projeto** (obrigatório)
- **Mês/Período** (date range)
- **Instituição** (opcional)
- **Disciplina** (opcional)
- **Mentor** (opcional)

Botão "Gerar PDF" — desativado se projeto não selecionado.

### Lógica do backend

`GET /api/aula-registos/export?projeto_id=&data_inicio=&data_fim=&estabelecimento_id=&disciplina=&mentor_id=`

1. Query à tabela `aula_registos` JOIN `aulas` com os filtros
2. Para cada registo: gerar URL assinada do Supabase Storage (TTL 60s)
3. Download de cada PDF do Storage
4. Compilar num único PDF multi-página com `pypdf` ou `reportlab`
   - Cada página = 1 registo
   - Rodapé automático com: data, mentor, instituição, disciplina
5. Devolver o PDF compilado como stream

### Nome do ficheiro gerado
```
Registos_PIS_Abril2026_EscolaX.pdf
```

---

## Novos Endpoints API

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/api/aula-registos` | Submeter path do registo para uma aula |
| `GET` | `/api/aula-registos/{aula_id}` | Verificar se aula tem registo |
| `GET` | `/api/aula-registos/export` | Gerar PDF compilado (com filtros) |
| `PATCH` | `/api/projetos/{id}` | Atualizar configurações do projeto (requer_digitalizacao) |

O upload do ficheiro em si é feito **diretamente para o Supabase Storage pelo cliente** (via SDK Supabase JS) — o backend não recebe o ficheiro, apenas o `storage_path` resultante.

---

## Novas Dependências

### Frontend
- `browser-image-compression` — compressão de imagem no cliente
- `jspdf` — conversão imagem → PDF no cliente
- `@supabase/supabase-js` (já presente) — upload direto para Storage

### Backend
- `pypdf` ou `reportlab` — compilação de PDFs no servidor para o export

---

## Ficheiros a Criar/Modificar

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `migrations/032_aula_registos.sql` | Criar | Tabela `aula_registos` + campo `projetos.requer_digitalizacao` |
| `services/registo_service.py` | Criar | CRUD de `aula_registos`, lógica de export PDF |
| `main.py` | Modificar | Novos endpoints `/api/aula-registos/*` e `PATCH /api/projetos/{id}` |
| `models/sqlmodel_models.py` | Modificar | Modelos `AulaRegisto`, `AulaRegistoCreate` |
| `services/aula_service.py` | Modificar | Validação de `requer_digitalizacao` em `terminar_aula()` |
| `frontend/src/pages/Horarios.tsx` | Modificar | Wizard 2 steps no modal "Terminar Sessão" |
| `frontend/src/pages/Wiki.tsx` | Modificar | Botão "Configurações do Projeto" + modal toggle |
| `frontend/src/pages/Estatisticas.tsx` | Modificar | Botão "Exportar Registos" + modal de filtros |
| `frontend/src/types/index.ts` | Modificar | `AulaRegisto`, `ProjetoConfig` types |

---

## Fora de Âmbito (desta iteração)

- Scan com deteção automática de bordas
- Múltiplos ficheiros por sessão
- Submissão retroativa de registos de sessões passadas
- Notificações de sessões sem registo
- Geração automática mensal (é on-demand)
