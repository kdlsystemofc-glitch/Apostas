# RELATÓRIO TÉCNICO DE AUDITORIA — FASE 1.1
## ENGINE ARCHITECTURE DISCOVERY — SPORTS PREDICTION SYSTEM

---

### 1. Onde Começa uma Nova Análise
Uma nova análise tem seu ponto de partida na página principal [`src/pages/Home.jsx`](file:///c:/appo/src/pages/Home.jsx#L70-L80), dentro da aba **"Nova Análise"** (`<TabsContent value="new">`). 

A interface renderiza o componente de formulário [`StatsInput`](file:///c:/appo/src/components/stats/StatsInput.jsx#L11), onde o usuário cola o bloco de texto copiados diretamente do **StatsHub** (ou do Excel). O evento de execução do cálculo é disparado no clique do botão **"Analisar Jogo"**, que invoca a função assíncrona [`handleAnalyze`](file:///c:/appo/src/components/stats/StatsInput.jsx#L31-L80).

---

### 2. Componente que Recebe as Estatísticas dos Dois Times
O componente responsável por receber e processar a entrada de estatísticas de ambas as equipes é o [`StatsInput.jsx`](file:///c:/appo/src/components/stats/StatsInput.jsx).

- **Entradas do usuário:**
  - `homeTeam` (Nome do mandante) e `awayTeam` (Nome do visitante).
  - `homeText` (Área de texto com estatísticas do mandante).
  - `awayText` (Área de texto com estatísticas do visitante).
  - `leagueProfileId` (ID opcional do Perfil de Liga selecionado).
  - `matchDate` (Data do jogo).
- **Ação:** O componente recebe o texto bruto das estatísticas dos dois times e utiliza o método [`parseStatsHubText()`](file:///c:/appo/src/lib/predictionEngine.js#L40) para converter cada bloco em objetos estruturados contendo valores feitos (`t`) e cedidos (`c`). Em seguida, repassa os objetos `homeStats` e `awayStats` para a função central [`analisarJogo()`](file:///c:/appo/src/lib/predictionEngine.js#L439).

---

### 3. Fluxo Completo: Do Clique em "Nova Análise" ao Resultado Final

```
[Usuário cola estatísticas e clica "Analisar Jogo"]
                         │
                         ▼
             StatsInput.jsx :: handleAnalyze()
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
parseStatsHubText(homeText)      parseStatsHubText(awayText)
        │                                 │
        └────────────────┬────────────────┘
                         ▼
        predictionEngine.js :: analisarJogo(homeStats, awayStats)
                         │
  ┌──────────────────────┼──────────────────────┐
  ▼                      ▼                      ▼
Cálculo xCorners       Cálculo xGols          Cálculo xShots, Cards,
(calcCorners)          (calcGols)             Faltas, Saves, TotalShots
  │                      │                      │
  │                      ▼                      │
  │            Poisson 2D (calcResultado)       │
  │            -> P(Casa), P(Empate), P(Fora)   │
  │            -> Placares Top 5                │
  │                      │                      │
  │                      ▼                      │
  │            Logística Smooth (calcBTTS)      │
  │            -> P(BTTS)                       │
  │                      │                      │
  └──────────────────────┼──────────────────────┘
                         ▼
           Retorno do Objeto results
                         │
                         ▼
 base44.entities.Match.create({ ... })  ==> Salva no Supabase (tabela matches)
                         │
                         ▼
         onAnalysisComplete(match, selectedProfile)
                         │
                         ▼
            Home.jsx :: handleAnalysisComplete()
            - Armazena lastMatch & lastLeagueProfile
            - Alterna aba ativa para 'results'
                         │
                         ▼
          MatchResults.jsx & BestBetsByMarket.jsx
            - Aplica fatorLiga(leagueProfile) em leagueAdjustment.js
            - Aplica Poisson CDF (poissonOver) para cada linha (Over X.5)
            - Blenda histórico da liga (calibrarProb, LEAGUE_WEIGHT = 30%)
            - Renderiza os blocos visuais de mercados e recomendações
```

---

### 4. Todos os Services Envolvidos
1. **`base44`** ([`src/api/base44Client.js`](file:///c:/appo/src/api/base44Client.js#L58-L63)): Service abstrato de entidades (CRUD Client) que provê métodos utilitários (`create`, `list`, `get`, `update`, `delete`) para as tabelas `matches` e `league_profiles`.
2. **`supabase`** ([`src/lib/supabaseClient.js`](file:///c:/appo/src/lib/supabaseClient.js#L13)): Cliente de integração oficial com a API do Supabase (`@supabase/supabase-js`), estabelecendo a comunicação HTTP com a base de dados PostgreSQL.
3. **`AuthContext`** ([`src/lib/AuthContext.jsx`](file:///c:/appo/src/lib/AuthContext.jsx#L1)): Contexto/Service para gerenciamento de sessão de usuário autenticado via Supabase Auth.

---

### 5. Todos os Hooks Envolvidos
- **Built-in React Hooks:**
  - `useState`: Controle de estados locais em componentes (inputs de formulário, partidas recentes, perfis de liga, dados filtrados, modo de edição e controle de abas).
  - `useEffect`: Disparo de chamadas assíncronas para busca de partidas e perfis de liga na montagem dos componentes.
  - `useRef`: Manipulação do elemento nativo `<input type="file">` na importação de arquivos CSV de ligas.
- **Custom / Library Hooks:**
  - `useNavigate` (`react-router-dom`): Manipulação programmaticamente da navegação entre rotas (`/league-profiles`, `/export`, `/match/:id`).
  - `useParams` (`react-router-dom`): Extração do parâmetro ID da partida a partir da URL.
  - `useToast` ([`src/components/ui/use-toast.js`](file:///c:/appo/src/components/ui/use-toast.js)): Notificações flutuantes de feedback (sucesso/erro).
  - `useIsMobile` ([`src/hooks/use-mobile.jsx`](file:///c:/appo/src/hooks/use-mobile.jsx)): Detecção de viewport responsivo para dispositivos móveis.

---

### 6. Todas as Funções Responsáveis pelos Cálculos

#### A. Em [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js):
- **Parsing e Extração:**
  - `parseStatsHubText(text)`: Identifica via regex e tabulações se o formato colado é de exportação Excel ou cópia direta do StatsHub web, extraindo médias `t` (time) e `c` (cedida).
  - `g(stats, key, campo)`: Leitor com fallback dinâmico para valor numérico seguro (`0.0`).
- **Núcleo Estatístico Base:**
  - `indice(feito, cedido)`: Calcula a taxa de intensidade de ataque vs defesa $I = \frac{\text{feito}}{\frac{\text{feito} + \text{cedido}}{2}}$.
  - `resistencia(cedidoDef, feitoAtk, cap)`: Calcula a resistência de contenção defensiva oposta $\min\left(\frac{\ln(1 + \text{cedidoDef})}{\ln(1 + \text{feitoAtk})}, 2.0\right)$.
  - `ancora(timeFaz, advCede)`: Média de ancoragem entre o poder ofensivo do time e as estatísticas concedidas pelo adversário.
  - `pesosDinamicos(componentes)`: Realiza a ponderação dos sub-fatores, recalculando automaticamente os pesos caso alguma estatística esteja ausente.
  - `factorial(n)`: Cálculo fatorial utilitário para distribuição de Poisson.
  - `poissonOver(media, linha)`: Função de Distribuição Acumulada (CDF) da distribuição de Poisson para obter a probabilidade exata de $P(X > \text{linha})$.
- **Mercados Específicos:**
  - `calcCorners(atk, def_, isHome)`: Esperança matemática de escanteios (7 fatores ofensivos + 3 defensivos + fator casa 1.18).
  - `calcGols(atk, def_, isHome)`: Esperança matemática de gols (xG, Big Chances, Chutes no gol/área + fator casa 1.08 / fora 0.92).
  - `calcShotsOnTarget(atk, def_, isHome)`: Esperança de chutes no gol (5 fatores ofensivos + 2 defensivos + fator mandante 1.05 / visitante 0.95).
  - `calcResultado(xgCasa, xgFora)`: Matriz de probabilidade bivariada de Poisson $9 \times 9$ para estimar a probabilidade 1X2 e listar o Top 5 placares mais prováveis.
  - `calcBTTS(statsCasa, statsFora)`: Probabilidade de Ambas Marcam ajustada por função logística de correlação contínua sobre a soma do xG ($xG_{total}$).
  - `calcCartoes(atk, def_, isHome)`: Esperança de cartões (Faltas, desarmes, interceptações + fator casa 0.92).
  - `calcFaltas(atk, def_)`: Esperança de faltas com multiplicador de escala dependente do ritmo do jogo.
  - `calcSaves(atk, def_)`: Esperança de defesas dos goleiros.
  - `calcTotalShots(atk, def_, isHome)`: Esperança de finalizações totais na partida.
- **Orquestrador Central:**
  - `analisarJogo(statsCasa, statsFora)`: Executa todas as funções de mercado e consolida os resultados no objeto final retornado.
- **Classificação de Sinais:**
  - `sinalPoisson(prob)`, `sinalPoissonGols(prob)` e `sinalBTTS(p)`: Rotulam os níveis de confiança das apostas em badges (*FORTE OVER*, *OVER*, *NEUTRO*, *UNDER*, *FORTE UNDER*).

#### B. Em [`src/lib/leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js):
- `fatorLiga(avgLiga, avgApp)`: Calcula o fator multiplicador pela relação logarítmica entre a média do campeonato e a média global do app ($1 + 0.5 \times \ln(\text{ratio})$), limitado ao intervalo $[0.80, 1.20]$.
- `interpolarOverLiga(overMap, linha)`: Realiza interpolação linear entre as probabilidades históricas de Over registradas para a liga no CSV da FootyStats.
- `calibrarProb(probPoisson, overMapLiga, linha)`: Aplica a arquitetura híbrida blendando 70% do valor calculado por Poisson e 30% do histórico real da liga (`LEAGUE_WEIGHT = 0.30`).
- `buildOverMaps(lp)`: Estrutura os dicionários de linhas e porcentagens de Over obtidos a partir do `LeagueProfile`.
- `ajustarBTTS(pBtts, leagueProfile)`: Pondera a probabilidade do modelo com o percentual histórico real de BTTS da liga.

#### C. Em Componentes de Apresentação e Avaliação:
- `linhasDinamicas(x, nLados)`: Gera as linhas de aposta no padrão de casas de apostas (terminadas em `.5`) ao redor do valor esperado.
- `bestLine(...)` e `bestSignal(...)`: Algoritmos de ranking de apostas que selecionam a linha ideal considerando força do sinal, probabilidade e distância da linha principal.
- `calcBloco(matches)` ([`CalibrationView.jsx`](file:///c:/appo/src/components/stats/CalibrationView.jsx#L5)): Processa grupos de 10 jogos avaliando Viés ($\text{Previsto} - \text{Real}$), MAE (Erro Absoluto Médio) e Win Rate % para calibração.

---

### 7. Todos os Arquivos Relacionados ao Prediction Engine

| Categoria | Arquivo | Responsabilidade Principal |
| :--- | :--- | :--- |
| **Core Engine** | [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js) | Parser de texto, fórmulas de Poisson, índices atq/def e algoritmos de cálculo. |
| **Calibração** | [`src/lib/leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js) | Ajustes por liga (FootyStats), constantes globais e interpolação de probabilidades. |
| **API Client** | [`src/api/base44Client.js`](file:///c:/appo/src/api/base44Client.js) | Wrapper de persistência para as entidades `Match` e `LeagueProfile`. |
| **Supabase Client** | [`src/lib/supabaseClient.js`](file:///c:/appo/src/lib/supabaseClient.js) | Inicialização da SDK do Supabase. |
| **Interface / Entrada** | [`src/pages/Home.jsx`](file:///c:/appo/src/pages/Home.jsx) | Gerenciador principal de abas da aplicação. |
| **Formulário** | [`src/components/stats/StatsInput.jsx`](file:///c:/appo/src/components/stats/StatsInput.jsx) | Recebe os dados colar dos times e dispara `analisarJogo()`. |
| **Resultados** | [`src/components/stats/MatchResults.jsx`](file:///c:/appo/src/components/stats/MatchResults.jsx) | Grid geral de resultados com aplicação de fatores de liga. |
| **Mercados Visuais** | [`src/components/stats/MarketBlock.jsx`](file:///c:/appo/src/components/stats/MarketBlock.jsx) | Tabela e badges de Over/Under para cada estatística. |
| **BTTS Visual** | [`src/components/stats/BTTSBlock.jsx`](file:///c:/appo/src/components/stats/BTTSBlock.jsx) | Painel visual do mercado Ambas Marcam. |
| **Resultado 1X2** | [`src/components/stats/MatchResultBlock.jsx`](file:///c:/appo/src/components/stats/MatchResultBlock.jsx) | Barra de porcentagem 1X2 e Top 5 placares. |
| **Detalhamento** | [`src/components/stats/CornerDetails.jsx`](file:///c:/appo/src/components/stats/CornerDetails.jsx) | Decomposição dos fatores de escanteios (âncora, índices ofensivos/defensivos). |
| **Rank de Apostas** | [`src/components/stats/BestBetsByMarket.jsx`](file:///c:/appo/src/components/stats/BestBetsByMarket.jsx) | Ordenação das melhores apostas por força do sinal e calibração de liga. |
| **Sinais** | [`src/components/stats/SignalBadge.jsx`](file:///c:/appo/src/components/stats/SignalBadge.jsx) | Componente visual de indicação de sinal/cor. |
| **Monitor / Calibração** | [`src/components/stats/CalibrationView.jsx`](file:///c:/appo/src/components/stats/CalibrationView.jsx) | Análise de Viés e MAE em blocos de 10 jogos. |
| **Resumo Diário** | [`src/components/stats/DailyOverview.jsx`](file:///c:/appo/src/components/stats/DailyOverview.jsx) | Agrupador de análises do dia e destaque das apostas mais fortes. |
| **Detalhes do Jogo** | [`src/pages/MatchDetail.jsx`](file:///c:/appo/src/pages/MatchDetail.jsx) | Página individual da partida + entrada de resultados reais para auditoria. |
| **Gestão de Ligas** | [`src/pages/LeagueProfiles.jsx`](file:///c:/appo/src/pages/LeagueProfiles.jsx) | Importador de CSVs do FootyStats e criação de perfis de campeonato. |

---

### 8. Fluxograma Completo da Análise

```mermaid
flowchart TD
    SubGraphInput[<b>1. CAMADA DE ENTRADA (StatsInput.jsx)</b>]
    A[Usuário cola estatísticas] --> B[parseStatsHubText]
    B --> C{Valida quantidade de estatísticas >= 3}
    C -- Não --> D[Exibe Toast de Erro]
    C -- Sim --> E[Chama analisarJogo]

    SubGraphEngine[<b>2. CAMADA DE CÁLCULO ESTATÍSTICO (predictionEngine.js)</b>]
    E --> F1[calcCorners: xCorners]
    E --> F2[calcGols: xGols]
    E --> F3[calcShotsOnTarget: xShots]
    E --> F4[calcCartoes: xCartões]
    E --> F5[calcFaltas: xFaltas]
    E --> F6[calcSaves: xDefesas]
    E --> F7[calcTotalShots: xChutesTotais]
    
    F2 --> G1[calcResultado: Matriz Poisson 2D 9x9]
    G1 --> G2[P Casa, P Empate, P Fora & Top 5 Placares]
    
    F2 --> H1[calcBTTS: Logística Smooth de Correlação]
    H1 --> H2[P Ambas Marcam]

    SubGraphPersistence[<b>3. CAMADA DE PERSISTÊNCIA (base44Client.js -> Supabase)</b>]
    F1 & G2 & H2 & F3 & F4 & F5 & F6 & F7 --> I[base44.entities.Match.create]
    I --> J[(Tabela matches no Supabase)]

    SubGraphAdjustment[<b>4. CAMADA DE APRESENTAÇÃO E AJUSTE (MatchResults.jsx / BestBetsByMarket.jsx)</b>]
    J --> K[Retorna Match criada para Home.jsx]
    K --> L[Muda aba para 'results' e monta MatchResults.jsx]
    L --> M[Aplica fatorLiga do leagueAdjustment.js]
    M --> N[poissonOver calcula % para cada linha Over/Under]
    O --> P[Renderização de SinalBadge, MarketBlock, BTTSBlock, BestBetsByMarket]
```

---

### 9. Dependências Entre Arquivos

```
src/pages/Home.jsx
 ├── src/components/stats/StatsInput.jsx
 │    ├── src/lib/predictionEngine.js (parseStatsHubText, analisarJogo)
 │    ├── src/api/base44Client.js (base44.entities.LeagueProfile, base44.entities.Match)
 │    └── src/components/ui/use-toast.js
 ├── src/components/stats/MatchResults.jsx
 │    ├── src/lib/predictionEngine.js (sinalPoissonGols)
 │    ├── src/lib/leagueAdjustment.js (fatorLiga, APP_GLOBALS)
 │    ├── src/components/stats/MarketBlock.jsx
 │    │    ├── src/lib/predictionEngine.js (poissonOver, sinalPoisson)
 │    │    └── src/components/stats/SignalBadge.jsx
 │    └── src/components/stats/BTTSBlock.jsx
 │         ├── src/lib/predictionEngine.js (sinalBTTS)
 │         └── src/components/stats/SignalBadge.jsx
 ├── src/components/stats/DailyOverview.jsx
 │    ├── src/lib/predictionEngine.js (poissonOver, sinalPoisson, sinalPoissonGols, sinalBTTS)
 │    └── src/api/base44Client.js
 └── src/components/stats/CalibrationView.jsx
      └── src/api/base44Client.js

src/pages/MatchDetail.jsx
 ├── src/api/base44Client.js
 ├── src/components/stats/MatchResultBlock.jsx
 ├── src/components/stats/MatchResults.jsx
 ├── src/components/stats/BestBetsByMarket.jsx
 │    ├── src/lib/predictionEngine.js (poissonOver, sinalPoisson, sinalPoissonGols, sinalBTTS)
 │    └── src/lib/leagueAdjustment.js (fatorLiga, calibrarProb, buildOverMaps, ajustarBTTS, APP_GLOBALS)
 └── src/components/stats/CornerDetails.jsx

src/api/base44Client.js
 └── src/lib/supabaseClient.js
      └── @supabase/supabase-js
```

---

### 10. Diagrama da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UI LAYER (React Components)                      │
│   Home.jsx ──► StatsInput.jsx ──► MatchResults.jsx ──► BestBetsByMarket.jsx  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CORE PREDICTION ENGINE LAYER                        │
│                         (src/lib/predictionEngine.js)                        │
│   • parseStatsHubText()  • calcCorners()       • calcResultado() (Poisson)  │
│   • calcGols()           • calcShotsOnTarget() • calcBTTS() (Logística)     │
│   • calcCartoes()        • calcFaltas()        • analisarJogo() (Orquestr.) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CALIBRATION & LEAGUE ADJUSTMENT LAYER                  │
│                         (src/lib/leagueAdjustment.js)                       │
│   • fatorLiga()          • interpolarOverLiga() • calibrarProb() (Blend 30%) │
│   • buildOverMaps()      • ajustarBTTS()        • APP_GLOBALS (Médias App)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PERSISTENCE LAYER (API & Supabase)                    │
│   base44Client.js ──► supabaseClient.js ──► PostgreSQL (Supabase DB)        │
│   (Table: matches)                          (Table: league_profiles)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Mapeamento da Árvore do Prediction Flow

```
Prediction Flow
├── Home.jsx (Container de Abas & Orquestração de Estado)
│   ├── StatsInput.jsx (Captação de Estatísticas & Disparo da Análise)
│   │   ├── predictionEngine.js :: parseStatsHubText (Parser do Texto Colado)
│   │   ├── predictionEngine.js :: analisarJogo (Orquestrador Matemática Core)
│   │   │   ├── calcCorners (Calculador de Escanteios Esperados - xC)
│   │   │   ├── calcGols (Calculador de Gols Esperados - xG)
│   │   │   ├── calcShotsOnTarget (Calculador de Chutes no Gol - xS)
│   │   │   ├── calcResultado (Calculador de Matriz Poisson 1X2 & Placares)
│   │   │   ├── calcBTTS (Calculador Ambas Marcam com Logística Smooth)
│   │   │   ├── calcCartoes (Calculador de Cartões Amarelos/Vermelhos - xCard)
│   │   │   ├── calcFaltas (Calculador de Faltas - xFouls)
│   │   │   ├── calcSaves (Calculador de Defesas dos Goleiros - xSaves)
│   │   │   └── calcTotalShots (Calculador de Chutes Totais - xTotalShots)
│   │   └── base44Client.js :: Match.create (Persistência no Banco)
│   │       └── supabaseClient.js (Comunicação com Supabase API)
│   │
│   ├── MatchResults.jsx (Visualização do Resultado da Partida)
│   │   ├── leagueAdjustment.js :: fatorLiga (Ajuste do xValor pela Média da Liga)
│   │   ├── MarketBlock.jsx (Bloco do Mercado Over/Under)
│   │   │   ├── predictionEngine.js :: poissonOver (Cálculo de Probabilidade Poisson CDF)
│   │   │   └── SignalBadge.jsx (Badge Visual de Recomendação)
│   │   └── BTTSBlock.jsx (Bloco do Mercado Ambas Marcam)
│   │       └── predictionEngine.js :: sinalBTTS (Sinalização BTTS)
│   │
│   ├── BestBetsByMarket.jsx (Ranking de Melhores Apostas & Calibração)
│   │   ├── leagueAdjustment.js :: buildOverMaps (Mapeamento de Linhas da Liga)
│   │   ├── leagueAdjustment.js :: calibrarProb (Blend 70% Modelo + 30% Liga)
│   │   └── leagueAdjustment.js :: ajustarBTTS (Ajuste de BTTS pela Liga)
│   │
│   ├── MatchDetail.jsx (Detalhes e Registro de Resultados Reais)
│   │   ├── CornerDetails.jsx (Decomposição de Fatores Ofensivos/Defensivos)
│   │   └── MatchResultBlock.jsx (Barra 1X2 e Placares Mais Prováveis)
│   │
│   └── CalibrationView.jsx (Auditoria de Viés, MAE e Win Rate por Bloco de 10 Jogos)
└── LeagueProfiles.jsx (Importador do CSV FootyStats & Gestão de Perfis de Ligas)
```
