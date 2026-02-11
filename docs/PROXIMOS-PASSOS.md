# ✅ Confirmação e próximos passos

## Checklist rápido

| Item | Onde verificar |
|------|----------------|
| Backend `.env` | Raiz do projeto – `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` (Supabase Postgres). Opcional: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` |
| Frontend `.env` | Pasta `frontend/` – `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Supabase Auth | Dashboard → Authentication → Providers → Email ativado |

---

## Agora: arrancar e testar

### 1. Arrancar o backend (FastAPI)

Num terminal, na **raiz do projeto**:

```bash
# Ativar o venv (se usas)
source venv/bin/activate   # macOS/Linux
# ou: venv\Scripts\activate   # Windows

# Instalar dependências (se ainda não fizeste)
pip install -r requirements.txt

# Arrancar a API
python main.py
```

Deve aparecer algo como: **A arrancar a API do RAP Nova Escola em http://localhost:8000**

- Abre no browser: http://localhost:8000 → deves ver `{"message":"Bem-vindo à API do RAP Nova Escola!"}`
- Se tiveres BD configurada: http://localhost:8000/api/aulas → lista de aulas (ou `[]`)

---

### 2. Arrancar o frontend (Vite)

Noutro terminal, na pasta **frontend**:

```bash
cd frontend
npm run dev
```

Deve abrir em **http://localhost:5173**.

- **Se tens `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` definidos:** serás redirecionado para `/login`. Faz login (ou cria conta) e depois entras na app com o teu user.
- **Se não tens essas variáveis:** a app corre em modo mock (sem login); o header mostra o user mock e não aparece o botão "Sair".

---

### 3. Testar a ligação frontend ↔ backend

1. Com o **backend** e o **frontend** a correr.
2. Abre a app no browser (http://localhost:5173).
3. Vai à página **Horários**.
4. No topo deve aparecer o bloco **"Aulas no backend"**:
   - Se o backend e a BD estiverem ok: lista de aulas (ou "Nenhuma aula na base de dados").
   - Se o backend não estiver a correr: mensagem de erro (ex.: "Failed to fetch" ou similar).

---

### 4. Resumo do fluxo

1. **Backend** (porta 8000) → usa a BD Supabase (Postgres) e opcionalmente valida JWT.
2. **Frontend** (porta 5173) → faz login no Supabase Auth, envia o token nas chamadas à API e mostra o user real no header.
3. **Página Horários** → chama `GET /api/aulas` e mostra as aulas no bloco "Aulas no backend".

Se algo falhar (erro ao arrancar, 401, CORS, etc.), diz qual passo e qual mensagem de erro aparece.
