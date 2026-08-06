# SPORTS PREDICTOR V2 — FASE 3: PLANO TÉCNICO DE REARQUITETURA
## ARQUITETURA DE SOFTWARE E BLUEPRINT DO SISTEMA V2.0

---

### AUTOR:
- **Principal Software Architect**

---

> **DIRETRIZ DA FASE 3:** NENHUM CÓDIGO-FONTE SERÁ ALTERADO NESTA ETAPA. Este documento é o plano arquitetural completo para a versão V2.0, definindo o padrão de projeto Clean Architecture, separação de camadas, estrutura de pastas, estado global reativo (Zustand), padrão Repository para o Supabase, resiliência e estratégia de performance.

---

## 1. VISÃO GERAL DA NOVA ARQUITETURA (CLEAN ARCHITECTURE & FEATURE-DRIVEN)

A versão V2 do **Sports Predictor** abandona o modelo de componentes monolíticos client-side para adotar uma **Clean Architecture (Arquitetura Limpa)** desacoplada em 5 camadas estritas:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DOMAIN LAYER (Motor Matemático & Regras de Negócio Puras)               │
│ • zero dependências externas ou de UI.                                      │
│ • predictionEngine, bayesian, distributions (Poisson/NB2), Kelly.           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. SERVICES & REPOSITORY LAYER (Persistência & Parser Externo)              │
│ • Supabase MatchRepository (Padrão Repository CRUD).                        │
│ • StatsHub Parser com relatório visual de erro por linha/coluna.            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. STATE & DATA FETCHING LAYER (Gerenciamento de Estado Reativo)            │
│ • Zustand Stores (useMatchStore, useBankrollStore).                         │
│ • TanStack Query (Gerenciamento de Cache, Stale Time e Invalidação).        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. HOOKS LAYER (Abstração de Lógica de UI)                                  │
│ • useAnalyzeMatch, useMatches, useKellyBankroll.                            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. PRESENTATION LAYER (UI Modular & Lazy-Loaded Views)                      │
│ • Design System Primitives (Radix UI + Tailwind).                           │
│ • Feature Components (MatchResultBlock, MarketBlock, BestBetsByMarket).     │
│ • Views com React.lazy() (Bundle Size < 200 kB).                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. NOVA ESTRUTURA DE DIRETÓRIOS DO PROJETO (`src/`)

```
src/
├── domain/                      # Layer 1: Regras de Negócio Puras & Motor Probabilístico
│   ├── engine/
│   │   ├── predictionEngine.js  # Motor V2 Orquestrador (Poisson, NB2, Dixon-Coles, Kelly)
│   │   ├── distributions.js     # Poisson & Binomial Negativa (NB2 avec Log-Gamma)
│   │   ├── bayesian.js          # Bayesian Shrinkage & Credibilidade de Amostras
│   │   └── kelly.js             # Risk Management & Calculador Quarter-Kelly
│   └── models/
│       ├── Match.js             # Entidade e Schemas Zod de Validação
│       └── MarketLines.js       # Linhas Comerciais (COMMERCIAL_LINES)
├── services/                    # Layer 2: Camada de Integração & Dados Externa
│   ├── supabase/
│   │   ├── client.js            # Instância Supabase Singleton
│   │   └── matchRepository.js   # Padrão Repository (CRUD Matches & Profiles)
│   └── parsers/
│       └── statsHubParser.js    # Parser Robusto com Diagnóstico de Erros
├── store/                       # Layer 3: Estado Global Reativo (Zustand)
│   ├── useMatchStore.js         # Estado das análises ativas, seleções e filtros
│   └── useBankrollStore.js      # Estado da banca total do usuário e gestão de risco
├── hooks/                       # Layer 4: Hooks Customizados Desacoplados
│   ├── useAnalyzeMatch.js       # Hook de execução do engine com memoização (useMemo)
│   ├── useMatches.js            # Hook TanStack Query para sincronização Supabase
│   └── useKellyBankroll.js      # Hook de cálculo dinâmico de Stake por Odd
├── components/                  # Layer 5: Design System e Componentes Modulares
│   ├── ui/                      # Primitivas Visuais Radix/Shadcn (Button, Card, Badge)
│   ├── match/                   # Componentes de Partida (MatchResultBlock, MarketBlock)
│   ├── analytics/               # Componentes de Análise (CornerDetails, BestBetsByMarket)
│   ├── calibration/             # Componentes de Diagnóstico (CalibrationView)
│   └── common/                  # Componentes Globais (ErrorBoundary, Header, Nav)
├── pages/                       # Views com Lazy-Loading (React.lazy)
│   ├── Home.jsx                 # Tela Principal
│   ├── MatchDetail.jsx          # Detalhes da Partida e Resultados Reais
│   ├── DailyOverview.jsx        # Painel Diário de Picks de Valor
│   ├── CalibrationPage.jsx      # Diagnóstico por Blocos de 10 Jogos
│   └── Export.jsx               # Exportação de Dados
└── App.jsx                      # Provider Wrapper com ErrorBoundary & Suspense
```

---

## 3. ESPECIFICAÇÃO DAS CAMADAS E COMPONENTES

### 3.1 Camada de Estado Global (Zustand Stores)
Em substituição aos `useState` espalhados no `Home.jsx`, o estado da aplicação é desacoplado em dois stores reativos de alta performance:

1. **`useMatchStore.js`:**
   - Mantém a lista de partidas carregadas, a partida ativa sob análise e o histórico de colagem.
   - Fornece ações síncronas (`setMatch`, `clearMatch`, `saveAnalysis`).

2. **`useBankrollStore.js`:**
   - Armazena a Banca Total do usuário (ex: `R$ 5.000,00`) e a fração de Kelly configurada (Padrão: $25\%$ - Quarter Kelly).
   - Calcula o valor exato em Reais (R$) para cada sugestão de aposta.

---

### 3.2 Camada de Serviços e Repositório (Supabase Repository)
Toda a interação com o Supabase é isolada na classe `MatchRepository`:

```javascript
// Exemplo conceitual da abstração Repository
export const MatchRepository = {
  async getMatches() { /* ... */ },
  async getMatchById(id) { /* ... */ },
  async saveMatch(matchData) { /* ... */ },
  async updateRealResults(id, realResults) { /* ... */ },
};
```

---

### 3.3 Estratégia de Performance & Bundling (Code-Splitting)
Para resolver o aviso de chunk $> 500\text{ kB}$ do Vite, as páginas secundárias são divididas via `React.lazy()` e envolvidas por `<Suspense fallback={<LoadingSpinner />}>` em `App.jsx`:

```javascript
const MatchDetail = React.lazy(() => import('@/pages/MatchDetail'));
const DailyOverview = React.lazy(() => import('@/pages/DailyOverview'));
const CalibrationPage = React.lazy(() => import('@/pages/CalibrationPage'));
const ExportPage = React.lazy(() => import('@/pages/Export'));
```

**Meta de Performance V2:** Tamanho do chunk inicial público $< 180\text{ kB}$.

---

### 3.4 Modelo de Banco de Dados PostgreSQL & Segurança RLS

#### Esquema SQL Atualizado (`supabase/schema.sql`):
```sql
-- Habilitação de RLS na tabela de partidas
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso por usuário / anônimo
CREATE POLICY "Matches Read Policy" ON matches 
  FOR SELECT USING (true);

CREATE POLICY "Matches Insert Policy" ON matches 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Matches Update Policy" ON matches 
  FOR UPDATE USING (true);
```

---

## 4. PLANO DE TRANSIÇÃO PARA A IMPLEMENTAÇÃO (FASE 3.1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PLANO DE EXECUÇÃO DA REARQUITETURA V2                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 1: Organização dos diretórios src/domain, src/services, src/store.     │
│ Step 2: Instalação de Zustand para gerenciamento de estado global.          │
│ Step 3: Implementação do MatchRepository e isolamento do Supabase Client.    │
│ Step 4: Refatoração dos componentes UI em src/components/match e analytics. │
│ Step 5: Implementação de Code-Splitting com React.lazy() no App.jsx.         │
│ Step 6: Execução de suíte de testes Vitest + validação npm run build.       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---
Plano técnico de rearquitetura V2 concluído pelo Principal Software Architect. Nenhuma linha de código foi alterada nesta fase. Especificação 100% pronta para a transição e implementação na Fase 3.1.
