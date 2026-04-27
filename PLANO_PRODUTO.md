# Plano de Produto — Plataforma de Gestão de Equipas e Projetos no Terreno
> Versão 1.0 · Abril 2026

---

## 1. Posicionamento e Visão

### O que é esta plataforma

Uma aplicação SaaS de gestão operacional para **organizações do terceiro sector** (IPSS, associações, misericórdias, fundações) que desenvolvem **programas no terreno** — educação, intervenção social, desporto, artes, apoio domiciliário, inserção profissional.

O produto resolve o problema central destas organizações: **dados dispersos, relatórios manuais e impossibilidade de provar impacto de forma sistemática** aos financiadores públicos (ISS, FSE/Pessoas 2030, Santa Casa, câmaras municipais).

### Diferenciação

| Concorrente | Problema |
|---|---|
| Desafio Informático / SoftGold (PT) | Focados em ERPI/SAD/creches — não cobrem programas de intervenção no terreno |
| Salesforce NPSP | Overengineered, requer admin dedicado, caro para IPSS médias |
| CommCare / KoBoToolbox | Genéricos, sem templates ISS/FSE, sem localização portuguesa |
| Excel + email | O status quo — sem histórico, sem prova de impacto, sem colaboração |

**O nosso espaço livre:** software nativo para o mercado português que faz a ponte entre a operação no terreno (mentores, sessões, registos) e as obrigações de reporte aos financiadores (ISS OCIP, FSE Pessoas 2030, SCML).

---

## 2. Análise de Mercado

### Mercado-alvo imediato (Portugal)

- **~6.000 IPSS** registadas (ISS, 2024)
- **~2.500** com acordos de cooperação activos com o ISS (pagamentos mensais por serviço)
- **Subsector alvo:** organizações com programas de intervenção comunitária, educação não-formal, inclusão social — estimado ~800–1.200 organizações
- Ticket médio estimado: €150–350/mês → TAM ~€2–5M/ano só em Portugal

### Expansão natural

- **PALOP** (Angola, Moçambique, Cabo Verde) — muitas IPSS portuguesas têm programas financiados por fundos europeus nestes países
- **Brasil** — setor de organizações sociais (OSCIPs) com dinâmica semelhante, mercado 40× maior
- **Espanha** — entidades do tercer sector, financiamento FSE+ com os mesmos indicadores comuns europeus

### Concorrentes directos investigados

**Bonterra Apricot / ETO** (EUA) — mais próximo em features mas sem localização PT, sem ISS/FSE templates, preço opaco e negociado. Feature de referência: *Connect Portal* (portal de beneficiários) e *Blueprints* (templates de programa).

**Aam Digital / ndb-core** (Alemanha, open-source) — arquitectura config-driven onde todo o modelo de dados é JSON, sem deploy de código por cliente. **Referência técnica mais relevante para a nossa arquitectura.**

**Primero / UNICEF** (open-source) — multi-tenancy com isolamento por organização, formulários configuráveis por tipo de programa. **Referência para multi-tenancy.**

**DHIS2** — motor de regras de programa e indicadores calculados por configuração. Usado em Portugal por centros de saúde (ACES). **Referência para indicadores FSE.**

---

## 3. Arquitectura do Produto — Modelo Modular

### 3.1 Núcleo (incluído em todos os planos)

O núcleo é o que a app já tem hoje, generalizado:

```
Organização
└── Projeto (programa financiado)
    ├── Estabelecimento (escola, centro, local)
    │   └── Grupo/Turma
    │       └── Sessão (aula, visita, actividade)
    │           ├── Registo (digitalização, foto, PDF)
    │           ├── Presenças (por beneficiário)
    │           └── Avaliação (mentor → sessão)
    ├── Equipa (mentores, técnicos, voluntários)
    └── Beneficiários (participantes)
```

A hierarquia é **configurável por tipo de programa** — o wizard de onboarding escolhe os nomes certos (turma vs. grupo vs. caso, sessão vs. visita vs. consulta).

### 3.2 Módulos

| Módulo | Descrição | Preço indicativo |
|---|---|---|
| **Relatórios ISS** | Export OCIP-ready, mapa de actividades, contagem de beneficiários únicos | €29/mês |
| **Relatórios FSE+** | Indicadores comuns Pessoas 2030, breakdown sociodemográfico, realiz./resultados | €39/mês |
| **Registo de Beneficiários** | Ficha individual persistente, campos FSE obrigatórios, histórico multi-projeto | €29/mês |
| **Assinaturas Digitais** | Sign-pad mobile + link de contra-assinatura por email (director de escola, coordenador) | €19/mês |
| **Formulários Personalizados** | Builder drag-and-drop de campos extras nos registos de sessão, sem código | €29/mês |
| **Portal do Beneficiário** | Acesso simplificado para utentes/encarregados: histórico de participação, certificados, consentimentos | €39/mês |
| **Avaliações de Impacto** | Formulários pré/pós com scoring, delta de melhoria, gráficos de evolução | €29/mês |
| **Verificação Geográfica** | Geofence auto check-in quando mentor entra no raio do estabelecimento | €19/mês |
| **Gestão de Financiamentos** | Tracker de candidaturas, indicadores comprometidos vs. realizados, alertas de deadline | €39/mês |
| **Faturação e Pagamentos** | Emissão de facturas (certificada AT), integração com contabilidade, gestão de acordos | €49/mês |
| **Referenciações** | Encaminhamento entre organizações parceiras, tracking de resolução | €29/mês |
| **IA — Narrativa de Impacto** | Geração automática de texto para relatórios, com base nos dados da plataforma | €49/mês |
| **RGPD Pro** | Gestão de consentimentos, pedidos DSAR, pseudonimização em exports, log de acessos | €19/mês |
| **White Label** | Domínio próprio, logótipo, cores da organização | €99/mês |

---

## 4. Roadmap de Features — Faseado

### FASE 0 — Produto Actual (já existe)
- [x] Projectos, estabelecimentos, turmas, aulas
- [x] Registos de sessão com digitalização PDF
- [x] Horários e agendamento
- [x] Estatísticas de produção musical
- [x] Papéis e permissões (coordenador, mentor, produtor, direcção)
- [x] Export de registos em ZIP organizado por pastas
- [x] Notificações push

---

### FASE 1 — Fundações para Venda (Q2–Q3 2026)
*Objectivo: tornar o produto vendável a qualquer IPSS, com compliance mínimo e onboarding self-service*

#### 1.1 Wizard de Configuração Inicial
**Inspiração:** CommCare onboarding + Apricot Blueprints

Fluxo de 7 passos para novos clientes:
1. **Perfil da organização** — nome, NIF/NIPC, nº registo IPSS, morada, logótipo
2. **Tipo de programa** — menu: educação não-formal / intervenção social / desporto / artes / apoio domiciliário / outro → carrega nomenclatura e templates adequados
3. **Financiador principal** — ISS / FSE-Pessoas2030 / Santa Casa / câmara / privado → activa campos obrigatórios e templates de relatório correspondentes
4. **Equipa** — import CSV ou convite por email, atribuição de papéis
5. **Estabelecimentos** — import CSV com morada → geofences criados automaticamente
6. **Primeiro projeto** — guided flow: nome, datas, turmas, horário tipo
7. **Módulos recomendados** — sugestão baseada no tipo de programa + financiador seleccionados, com trial gratuito de 14 dias

#### 1.2 Registo de Beneficiários (Módulo)
**Inspiração:** Primero (UNICEF), DHIS2 Tracker, FSE indicadores comuns

Campos base por beneficiário:
- Identificação: nome, data de nascimento, NIF/CC (opcional, encriptado), contacto do encarregado
- FSE obrigatórios: género, idade, nível de escolaridade, situação laboral, migrante (S/N), deficiência (S/N)
- Histórico: todos os projectos em que participou, sessões presentes, avaliações
- ID interno persistente: garante contagem de indivíduos únicos (não sessões) para ISS

**Funcionalidade:** ligar beneficiário a turma → a presença é registada por nome, não só por contagem agregada.

#### 1.3 Módulo RGPD (Core — incluído em todos os planos)
**Inspiração:** CNPD directrizes, Fulcrum face-blurring, Casebox audit trail

- Registo de consentimentos por beneficiário (quem deu, quando, para quê, validade)
- Consentimento parental para menores (< 16 anos): link por email para encarregado assinar digitalmente
- Desfocagem automática de rostos em fotos (server-side, usando OpenCV/face_recognition)
- Log de acessos: quem viu o quê e quando (DSAR-ready)
- Workflow de pedido de acesso/rectificação/apagamento (DSAR)
- Política de retenção por tipo de dados (sessões: 5 anos, fotos: 2 anos, etc.)

#### 1.4 Assinaturas Digitais (Módulo)
**Inspiração:** GoCanvas, Apricot Connect, Device Magic

- **Sign-pad no mobile:** mentor assina o registo de sessão no final da visita
- **Contra-assinatura remota:** envio de link por email para director de escola / coordenador assinar sem conta na plataforma (token de 72h)
- Registo de IP + timestamp + device por cada assinatura
- PDF gerado automaticamente com assinaturas embedidas

---

### FASE 2 — Reporte e Impacto (Q3–Q4 2026)
*Objectivo: eliminar o trabalho manual de preparação de relatórios para financiadores*

#### 2.1 Templates de Relatório ISS (Módulo)
**Referência:** Formulários OCIP, Portaria 196-A/2015, acordos de cooperação típicos

- Export Excel pré-formatado com os mapas ISS: mapa de actividades por valência, contagem de beneficiários, horas de serviço
- Parâmetros configuráveis por projeto: valência (CAF, CATL, CPCJ, ATL, PIEF, etc.), capacidade acordada, indicadores específicos do acordo
- Gerado automaticamente com base nos dados de sessões + presenças registadas

#### 2.2 Dashboard FSE+ / Pessoas 2030 (Módulo)
**Referência:** Regulamento UE 2021/1057, indicadores comuns CO01–CO19, Pessoas 2030 fichas de indicadores

Indicadores calculados automaticamente:
- **CO01** — desempregados (incluindo desempregados de longa duração)
- **CO06** — com menos de 30 anos / CO07 — com 55 anos ou mais
- **CO08** — com ensino básico ou menos
- **CR01–CR06** — resultados pós-saída (obtiveram qualificação, emprego, melhoraram competências)
- Taxa de conclusão do programa (inscritos vs. completaram)
- Breakdown por género em todos os indicadores

Dashboard em tempo real → gestor de projeto vê % de cumprimento de indicadores a qualquer momento, não só no final do período de reporte.

#### 2.3 Formulários de Avaliação de Impacto (Módulo)
**Inspiração:** Penelope (Athena Software), DHIS2 Program Rules

- Builder de questionários tipo Likert, múltipla escolha, escala numérica
- Aplicação em dois momentos: início e fim do programa (pre/post)
- Cálculo automático do delta de melhoria por beneficiário e por turma
- Instrumentos validados incluídos (sugestão): Escala de Bem-Estar WEMWBS adaptada, índice de confiança criativa (para programas de artes)
- Exportável como evidência de outcomes para relatórios de financiadores

#### 2.4 Verificação Geográfica (Módulo)
**Inspiração:** Salesforce Field Service, Fulcrum GPS accuracy requirement

- Geofence por estabelecimento (raio configurável, default 100m)
- Check-in automático quando mentor entra no raio (notificação confirmação)
- Check-out automático na saída → duração real da visita calculada
- Mapa em tempo real para coordenador ver equipa no terreno
- Se mentor tenta registar sessão fora do geofence → alerta para coordenador
- Fallback manual com justificação (ex: reunião noutra localização)

---

### FASE 3 — Plataforma Multi-cliente (Q4 2026 – Q1 2027)
*Objectivo: escalar para múltiplos clientes com isolamento total e self-service billing*

#### 3.1 Multi-tenancy com Isolamento por Organização
**Inspiração:** Primero (UNICEF), Row Level Security do Supabase

- Cada IPSS é um `tenant` com schema-level ou RLS-level isolation
- Dados de uma organização nunca visíveis a outra
- Super-admin da plataforma pode ver todos os tenants (suporte, auditoria)
- Opção de "organização-rede": uma entidade coordenadora vê dados agregados de organizações filiais (ex: CNIS com associadas)

#### 3.2 Module Marketplace + Billing
- Activação/desactivação de módulos por tenant em self-service
- Integração com Stripe (pagamentos recorrentes, facturas automáticas)
- Trial gratuito de 14 dias por módulo
- Downgrade gracioso: dados mantidos em read-only se módulo for desactivado

#### 3.3 Portal do Beneficiário (Módulo)
**Inspiração:** Apricot Connect Portal, Penelope Client Portal

- URL personalizada por organização (ou subdomínio white-label)
- Autenticação simplificada: email + código SMS (sem password)
- O que o utente/encarregado vê:
  - Histórico de sessões em que o filho/utente participou
  - Avaliações e progresso ao longo do programa
  - Certificado de participação (PDF download)
  - Formulários de consentimento pendentes (assinar online)
  - Documentos partilhados pela organização
- Não requer conta na plataforma principal — fluxo separado e simplificado

---

### FASE 4 — Integrações e IA (2027)
*Objectivo: eliminar silos entre a plataforma e os outros sistemas da organização*

#### 4.1 Google Workspace / Microsoft 365
- Sincronização de calendário (sessões ↔ Google Calendar / Outlook)
- Upload de registos directamente para Google Drive / SharePoint da organização
- Login com conta Google/Microsoft (SSO)
- Importação de contactos de equipa do Google Workspace

#### 4.2 Faturação e Contabilidade (Módulo)
**Referência:** Portaria 363/2010 (software certificado AT), integração com PHC, Sage, InvoiceXpress

- Emissão de facturas certificadas AT (para IPSS que cobram serviços a municípios/famílias)
- Gestão de acordos de cooperação: valor acordado, serviços prestados, facturação mensal automática
- Export para contabilidade: OFX, SAFT-PT, integração InvoiceXpress/Moloni
- Gestão de bolsas e subsídios recebidos (grant tracker)

#### 4.3 Gestão de Propostas e Candidaturas (Módulo)
- Pipeline de candidaturas a financiamento (rascunho → submetida → aprovada → em execução → encerrada)
- Templates de proposta por financiador (ISS, FSE, EEA Grants, Portugal Social Innovation)
- Indicadores comprometidos na proposta → linked ao dashboard de cumprimento em tempo real
- Alertas de deadline de reporte

#### 4.4 IA — Narrativa de Impacto (Módulo)
**Inspiração:** Claude API, GoCanvas automated PDF reports

- Com base nos dados da plataforma (sessões realizadas, taxa de presença, delta de avaliações, testemunhos), gera automaticamente:
  - Narrativa para o relatório de actividades (em português correcto, linguagem de "economia social")
  - Excerto para newsletter ou comunicação com doadores
  - Sumário executivo para conselho de administração
- Utilizador revê e edita antes de publicar
- Custo marginal por geração → módulo com créditos mensais incluídos

#### 4.5 Referenciações Inter-organizacionais (Módulo)
**Inspiração:** Apricot Closed-loop Referrals, CiviCRM Case Referral

- Mentor identifica necessidade de um beneficiário (alimentação, apoio psicológico, habitação)
- Cria referenciação para organização parceira (na plataforma ou por email com link)
- A organização receptora confirma recepção e, mais tarde, resolução
- Dashboard: referenciações abertas / em curso / resolvidas por organização
- Efeito de rede: quanto mais IPSS usam a plataforma, mais valioso fica o módulo

---

## 5. Modelo de Negócio

### 5.1 Planos de Subscrição

| Plano | Utilizadores | Projectos | Preço | Target |
|---|---|---|---|---|
| **Starter** | 1 coord + 5 mentores | 1 | €99/mês | Associação pequena, 1 programa |
| **Growth** | 1 coord + 20 mentores | 5 | €249/mês | IPSS média, múltiplos programas |
| **Scale** | 5 coords + 50 mentores | Ilimitado | €499/mês | IPSS grande, rede de equipamentos |
| **Enterprise** | Ilimitado | Ilimitado | Negociado | Confederações, redes nacionais |

Módulos adicionais: €19–€49/módulo/mês (ver secção 3.2).

**Nota sobre pricing:** Seguir o modelo CommCare — utilizadores em bundle por tier, não por cabeça. Evitar cobrança per-user: pune o crescimento das equipas, que é exactamente o que as IPSS querem fazer.

### 5.2 Fontes de Receita Complementares

- **Onboarding assistido:** €500–2.000 (configuração inicial, migração de dados, formação)
- **Templates de relatório personalizados:** €200–500 por template (ex: relatório específico de câmara municipal X)
- **Certificação de conformidade RGPD:** relatório de auditoria anual, €300/ano
- **Implementação white-label para redes:** uma confederação (ex: CNIS, UMP) licencia a plataforma para as suas associadas, paga em bulk com desconto e cobra às filiadas
- **API access para integrações custom:** tier pago para organizações com sistemas próprios

### 5.3 Go-to-Market

**Entrada pelo caso de uso específico (RAP Nova Escola como showcase):**
A plataforma já existe e funciona em produção para um programa real. Usar como case study e demo viva.

**Canais prioritários:**
1. **Associações de segundo grau** — CNIS (Confederação Nacional das Instituições de Solidariedade), UMP (União das Misericórdias Portuguesas), FENACERCI → acesso directo a centenas de IPSS membros
2. **Consultoras de candidaturas FSE** — empresas que preparam candidaturas e gerem relatórios para IPSS; torná-las parceiros de implementação (como o modelo CommCare de "certified providers")
3. **Divisões sociais de câmaras municipais** — câmaras que financiam programas IPSS e querem visibilidade sobre execução
4. **Portugal Inovação Social** — programa de apoio a inovação no terceiro sector; candidatura como ferramenta de impacto
5. **Eventos do sector** — Congresso CNIS, Encontro Nacional das Misericórdias, Social Innovation Summit Lisboa

**Argumento de venda principal:**
> "Elimina 20–40 horas de trabalho manual por ciclo de reporte. O relatório para o ISS ou para o FSE gera-se em 1 clique, com todos os dados que já registaste na operação diária."

---

## 6. Arquitectura Técnica — Notas para Implementação

### 6.1 Config-driven Data Model
**Inspiração:** Aam Digital ndb-core, DHIS2

O modelo de dados do núcleo é fixo (organização → projeto → estabelecimento → grupo → sessão → registo). Mas os **campos de cada entidade são configuráveis** por tenant via JSON de configuração, sem deploy de código:

```json
{
  "entidade": "sessao",
  "campos_extra": [
    { "nome": "tema_musical", "tipo": "texto", "obrigatorio": true },
    { "nome": "instrumentos_usados", "tipo": "multi_select", "opcoes": ["guitarra", "bateria", "voz"] },
    { "nome": "nota_comportamento", "tipo": "escala_1_5", "obrigatorio": false }
  ]
}
```

Isto é o que permite ao wizard de onboarding configurar a plataforma para um programa de música vs. tutoria vs. apoio domiciliário.

### 6.2 Program Rules Engine
**Inspiração:** DHIS2 Program Rules

Regras configuráveis que disparam com base em valores de campos:
- "Se `presencas < 3`, mostrar campo `motivo_baixa_adesao`"
- "Se `sessao_cancelada = true`, requerer `motivo_cancelamento`"
- "Se `avaliacao < 2`, criar alerta para coordenador"

Implementável como array de condições JSON avaliadas no frontend e validadas no backend.

### 6.3 Multi-tenancy com Supabase RLS
A arquitectura Supabase existente suporta Row Level Security nativo. Estratégia:

- Adicionar coluna `organizacao_id` a todas as tabelas core
- RLS policy: `auth.jwt() ->> 'organizacao_id' = organizacao_id`
- Super-admin com `organizacao_id IS NULL` pode ver tudo
- Cada tenant tem o seu bucket de Storage isolado

### 6.4 Face Blurring no Upload
Fluxo para compliance RGPD com fotos de menores:

1. Upload do registo de sessão (foto/PDF)
2. Supabase Edge Function processa a imagem:
   - Detecção de faces com `face_recognition` (Python) ou `@vladmandic/face-api` (JS)
   - Desfocagem automática das faces detectadas
3. Versão desfocada guardada como default público
4. Versão original mantida em path privado (acesso só com consentimento documentado)
5. Se nenhuma face detectada, salta o passo de blurring

### 6.5 Geofencing
- Frontend: `navigator.geolocation.watchPosition()` em background quando sessão ativa
- Backend: endpoint recebe coordenadas, compara com polígono do estabelecimento (PostGIS `ST_DWithin`)
- Supabase Realtime: coordenador vê pins da equipa em tempo real no mapa
- Fallback offline: coordenadas guardadas localmente (IndexedDB) e sincronizadas quando há rede

---

## 7. Compliance Regulatório — Checklist

### 7.1 RGPD / Lei 58/2019 (CNPD)
- [ ] Registar actividades de tratamento (Art. 30)
- [ ] Documentar base jurídica por tipo de dado
- [ ] Consentimento parental para menores (< 16 anos)
- [ ] Política de retenção e eliminação automática de dados
- [ ] Procedimento de resposta a DSAR (prazo 30 dias)
- [ ] DPO designado (pode ser outsourced) para clientes que processam dados sensíveis em escala
- [ ] Pseudonimização em exports analíticos
- [ ] Breach notification procedure (72h para CNPD)

### 7.2 ISS / Acordos de Cooperação
- [ ] Campos obrigatórios para reporte: valência, capacidade, nº beneficiários, horas de serviço
- [ ] Compatibilidade com formato OCIP (mapas Excel)
- [ ] Registo de presenças individualizado (não só contagem agregada)
- [ ] Arquivo de registos por 5 anos (prazo legal)

### 7.3 FSE+ / Pessoas 2030
- [ ] Indicadores comuns CO01–CO19 implementados
- [ ] Campos sociodemográficos obrigatórios por beneficiário
- [ ] Tracking de entrada/saída do programa (data início, data conclusão, motivo saída)
- [ ] Resultados pós-saída (CR01–CR06): mecanismo de follow-up a 4 semanas e 6 meses

### 7.4 Faturação (se Módulo activado)
- [ ] Software certificado AT (Portaria 363/2010) — requerer integração com InvoiceXpress/Moloni (já certificados) em vez de implementar certificação própria
- [ ] SAFT-PT gerado mensalmente
- [ ] NIF no cabeçalho de todas as facturas

---

## 8. Referências e Inspirações

### Open-source para estudar
- **Aam Digital / ndb-core** — `github.com/Aam-Digital/ndb-core` — arquitectura config-driven, referência técnica principal
- **Primero (UNICEF)** — `github.com/primeroims/primero` — multi-tenancy, formulários configuráveis, gestão de casos
- **DHIS2** — `github.com/dhis2/dhis2-core` — program rules engine, indicadores calculados, scheduled jobs
- **KoBoToolbox** — `github.com/kobotoolbox/kobocat` — XLSForm standard, validação de dados, GPS por submissão
- **Frappe Changemakers** — `github.com/frappe/changemakers` — Ionic mobile + Frappe DocType (no-code form builder)

### Produtos comerciais de referência
- **CommCare (Dimagi)** — pricing model (bundled users), offline-first, form builder
- **Bonterra Apricot** — Blueprints (templates de programa), Connect Portal (beneficiários)
- **Fulcrum** — face blurring RGPD, AI form fill from photos
- **Salesforce Field Service** — geofence check-in automático, route optimization

### Contexto regulatório PT
- ISS — Portaria 196-A/2015 (cooperação), Despacho 11411/2013 (OCIP)
- Pessoas 2030 — `pessoas2030.gov.pt` — regulamento FSE+, fichas de indicadores comuns
- CNPD — `cnpd.pt` — orientações para tratamento de dados de menores, violações de dados
- Portugal Inovação Social — `inovacaosocial.portugal2020.pt`

---

*Documento vivo — atualizar à medida que o produto evolui.*
*Próxima revisão: Julho 2026*
