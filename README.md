# 🎤 RAP Nova Escola - Sistema de Coordenação de Equipa

## 📋 Visão Geral

Plataforma interna para coordenar um projeto educativo e artístico de RAP. Gere sessões, horários, recursos, produção musical e comunicação de equipa.

---

## 🔗 Ligar Backend, Frontend e Supabase

### 1. Backend (FastAPI) com Supabase

- **Base de dados:** O backend usa PostgreSQL via `database/connection.py`. Para usar o Supabase como BD, em **Supabase → Project Settings → Database** copia o connection string (ou host, database, user, password, port) e define no `.env`:
  - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`
- **JWT (opcional):** Para o endpoint `/api/me` validar o token do Supabase, define no `.env`:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` (JWT Secret em Project Settings → API)

Usa o ficheiro `.env.example` na raiz do projeto como referência.

### 2. Frontend (Vite) com Backend e Supabase Auth

- Na pasta `frontend/`, cria um ficheiro `.env` (podes copiar de `frontend/.env.example`) e define:
  - `VITE_API_URL=http://localhost:8000` — URL da API FastAPI
  - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` — do Supabase (Project Settings → API)

Com `VITE_SUPABASE_*` definidos, a app exige **login** (página `/login`). Sem estas variáveis, a app corre em modo mock (sem autenticação).

### 3. Resumo

| Onde | O que fazer |
|------|-------------|
| **Backend** | `.env` com `DB_*` (Supabase Postgres) e opcionalmente `SUPABASE_*` para JWT |
| **Frontend** | `frontend/.env` com `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Supabase** | Ativar Auth (Email/Password) em Authentication → Providers se quiseres login |

A página **Horários** mostra um bloco "Aulas no backend" quando `VITE_API_URL` está definido; as aulas vêm da API FastAPI (e da BD Supabase se o backend estiver ligado a ela).

---

## 📁 Estrutura do Projeto

```
rap_nova_escola/
├── main.py                    # 🚀 Ficheiro principal - arranca aqui
├── requirements.txt           # 📦 Bibliotecas necessárias
├── .env                       # 🔐 Configurações sensíveis (passwords)
├── .env.example              # 📄 Template do .env
│
├── config/                    # ⚙️ Configurações gerais
│   ├── __init__.py
│   └── settings.py
│
├── database/                  # 🗄️ Gestão da base de dados
│   ├── __init__.py
│   ├── connection.py
│   └── migrations/
│
├── models/                    # 📊 Estrutura das tabelas (entidades)
│   ├── __init__.py
│   ├── mentor.py
│   ├── turma.py
│   ├── instituicao.py
│   ├── sessao.py
│   ├── equipamento.py
│   └── producao_musical.py
│
├── services/                  # 🧠 Lógica de negócio (funcionalidades)
│   ├── __init__.py
│   ├── mentor_service.py
│   ├── sessao_service.py
│   ├── disponibilidade_service.py
│   ├── notificacao_service.py
│   └── relatorio_service.py
│
├── utils/                     # 🔧 Funções auxiliares
│   ├── __init__.py
│   ├── validators.py
│   └── helpers.py
│
└── tests/                     # ✅ Testes automáticos
    ├── __init__.py
    └── test_basic.py
```

---

## 🎯 Responsabilidade de Cada Pasta

### 📂 `/config`
**O quê?** Configurações da aplicação  
**Exemplos:** Ligação à BD, timezone, nome da app  
**Quando usar?** Quando precisas definir ou alterar configurações globais

### 📂 `/database`
**O quê?** Tudo relacionado com PostgreSQL  
**Exemplos:** Criar ligação, executar queries, migrations  
**Quando usar?** Quando precisas comunicar com a base de dados

### 📂 `/models`
**O quê?** Define como são as entidades (tabelas)  
**Exemplos:** Um Mentor tem nome, email, especialidade  
**Quando usar?** Ao criar ou modificar estrutura de dados

### 📂 `/services`
**O quê?** Lógica de negócio (as funcionalidades)  
**Exemplos:** Criar sessão, cancelar sessão, enviar notificação  
**Quando usar?** Para implementar as funcionalidades da app

### 📂 `/utils`
**O quê?** Funções auxiliares reutilizáveis  
**Exemplos:** Validar email, formatar data, calcular distância  
**Quando usar?** Para funções que são usadas em vários lugares

### 📂 `/tests`
**O quê?** Testes automáticos  
**Exemplos:** Testar se criar mentor funciona, se validação de email funciona  
**Quando usar?** Para garantir qualidade do código

---

## 🚀 Como Começar

### 1️⃣ Pré-requisitos
- Python 3.11 instalado
- PostgreSQL instalado e a correr
- Editor de código (VS Code recomendado)

### 2️⃣ Instalação

```bash
# 1. Clonar/criar a pasta do projeto
mkdir rap_nova_escola
cd rap_nova_escola

# 2. Criar ambiente virtual (recomendado)
python -m venv venv

# 3. Ativar ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 4. Instalar dependências
pip install -r requirements.txt

# 5. Configurar variáveis de ambiente
# Copiar .env.example para .env e preencher com dados reais
cp .env.example .env
# Editar .env com os teus dados do PostgreSQL
```

### 3️⃣ Executar a Aplicação

```bash
python3 main.py
```

---

## 📖 Explicação dos Ficheiros Principais

### `main.py`
- **O quê faz?** É o "cérebro" da aplicação, coordena tudo
- **Quando executa?** Quando corres `python main.py`
- **Responsabilidades:**
  - Mostrar menu principal
  - Processar escolhas do utilizador
  - Chamar os módulos corretos (services)
  - Gerir o fluxo da aplicação

### `requirements.txt`
- **O quê faz?** Lista todas as bibliotecas Python necessárias
- **Como usar?** `pip install -r requirements.txt`
- **Principais bibliotecas:**
  - `psycopg2-binary`: Conectar ao PostgreSQL
  - `python-dotenv`: Ler variáveis do .env
  - `pydantic`: Validar dados
  - `tabulate`: Mostrar tabelas bonitas no terminal

### `.env`
- **O quê faz?** Guarda informações sensíveis (passwords, configurações)
- **MUITO IMPORTANTE:** NUNCA partilhar este ficheiro!
- **Conteúdo típico:**
  - Password da base de dados
  - Chaves de APIs
  - Configurações específicas do ambiente

---

## 🔄 Próximos Passos

1. ✅ **Estrutura base criada** (estamos aqui!)
2. ⏳ Criar ficheiro `config/settings.py`
3. ⏳ Criar ficheiro `database/connection.py`
4. ⏳ Criar models (mentor, turma, etc)
5. ⏳ Criar services (lógica de negócio)
6. ⏳ Integrar tudo no `main.py`

---

## 💡 Dicas para Não-Programadores

### Como funciona o fluxo?
```
Utilizador → main.py → Services → Database → PostgreSQL
                ↓
            Mostra resultado
```

1. **Utilizador** escolhe opção no menu
2. **main.py** recebe a escolha e chama o service correto
3. **Service** executa a lógica (ex: criar sessão)
4. **Database** comunica com PostgreSQL
5. **Resultado** volta ao utilizador

### Analogia do Restaurante 🍽️
- **main.py** = Empregado de mesa (recebe pedidos)
- **services/** = Cozinha (prepara a comida)
- **database/** = Despensa (guarda ingredientes)
- **models/** = Receitas (como fazer cada prato)
- **utils/** = Utensílios (facas, panelas, etc)

---

## ❓ FAQ

**P: Posso executar sem PostgreSQL?**  
R: Não nesta versão. Mas podemos adaptar para SQLite no futuro.

**P: O que é um ambiente virtual (venv)?**  
R: É uma "pasta isolada" com as bibliotecas do projeto. Evita conflitos com outros projetos Python.

**P: Onde está a interface gráfica?**  
R: Por agora é só terminal/consola. Interface gráfica virá em versões futuras.

**P: Como adiciono uma nova funcionalidade?**  
R: Cria um novo service em `/services` e adiciona opção no menu do `main.py`.

---

## 📞 Suporte

Para dúvidas ou problemas, contactar a equipa técnica do projeto.

---

**Versão:** 1.0.0  
**Data:** Janeiro 2026  
**Estado:** Em Desenvolvimento 🚧
