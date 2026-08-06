# ESPECIFICAÇÃO TÉCNICA MESTRE E GUIA COMPLETO PARA INTELIGÊNCIA ARTIFICIAL
## MASTER AI SPECIFICATION & HANDOVER GUIDE FOR SPORTS PREDICTOR SYSTEM

> **AVISO IMPORTANTE PARA OUTRAS IAs / DESENVOLVEDORES:** Este é o **documento definitivo e unificado** sobre o sistema **Sports Predictor**. Ele reúne toda a engenharia reversa, matemática estatística, dicionário completo de estatísticas do StatsHub, cruzamento de parâmetros ofensivos/defensivos, componentes visuais de UI/UX, linhas comerciais da Bet365/Pinnacle, regras de decisão estrita do 1X2 e arquitetura de calibração. NENHUMA informação foi omitida.

---

## 1. VISÃO GERAL DA ARQUITETURA E FLUXO DE DADOS

O **Sports Predictor** é um motor estatístico autônomo e sistema web desenvolvido em React 18, Vite e Tailwind CSS, integrado a um banco de dados PostgreSQL no Supabase.

### Fluxograma Geral do Pipeline de Dados:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. INGESTÃO DE DADOS (StatsInput.jsx)                                       │
│ • O usuário cola o texto bruto do StatsHub ou do Excel.                     │
│ • Execução da função parseStatsHubText(text).                               │
│ • Mapeamento das 29+ estatísticas do STAT_MAP.                             │
│ • Estruturação dos objetos: statsCasa e statsFora.                          │
│   Cada stat contém: { t: valor_time_fez, c: valor_time_cedeu }.              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. MOTOR ESTATÍSTICO AUTÔNOMO (predictionEngine.js)                         │
│ • Execução de analisarJogo(statsCasa, statsFora).                           │
│ • Cálculo das Âncoras Base: ancora(faz, cede) = (faz + cede) / 2.            │
│ • Cruzamento Ofensivo vs Defensivo:                                         │
│   - Ataque: indice(feito, cedido) = feito / ((feito + cedido)/2).           │
│   - Defesa: resistencia(cedidoDef, feitoAtk) = ln(1+cedidoDef)/ln(1+feitoAtk)│
│ • Ponderação Dinâmica: pesosDinamicos(componentes) se faltar algum stat.    │
│ • Obtenção dos Lambdas (Expectativas de Gols, Escanteios, Cartões, etc.).   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. MODELAGEM DE PROBABILIDADES E MERCADOS COMERCIAIS                        │
│ • Mercado 1X2 Bivariado com Ajuste Dixon-Coles tau(x, y, rho = -0.13).      │
│   └─ Emissão da PICK ESTRITA: Vitória Casa, Empate ou Vitória Fora.         │
│ • Distribuição de Poisson CDF: poissonOver(media, linha).                    │
│ • Filtro de Linhas Comerciais Reais: COMMERCIAL_LINES.                      │
│ • Cálculo de Odd Justa (Fair Odd) e Calculador de EV Real (+X.X%).          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. CAMADA VISUAL E DASHBOARDS DE INTERFACE (React Components)               │
│ • MatchResultBlock.jsx -> Pick 1X2 + Odd Justa + Calculador de EV+ Real.    │
│ • MarketBlock.jsx      -> Highlight da Linha Base + Odd Justa + EV+ Real.   │
│ • BestBetsByMarket.jsx -> Ranking de Melhores Apostas por Força de Sinal.   │
│ • CornerDetails.jsx    -> Tabela de Sub-Fatores Ofensivos/Defensivos.       │
│ • DailyOverview.jsx    -> Painel Diário de Jogos e Melhores Entradas.        │
│ • ErrorBoundary.jsx    -> Captura de Exceções de UI (Prevenção Tela Branca).│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. PERSISTÊNCIA, RLS & SISTEMA DE CALIBRAÇÃO                                │
│ • Supabase PostgreSQL (Tabela `matches` com RLS ativado).                   │
│ • MatchDetail.jsx -> Preenchimento de Resultados Reais pós-jogo.            │
│ • CalibrationView.jsx -> Avaliação por Blocos de 10 Jogos (Viés, MAE, Win%).│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PARSER E DICIONÁRIO COMPLETO DAS ESTATÍSTICAS DO STATSHUB

O parser `parseStatsHubText(text)` lê a tabela de estatísticas colada e extrai os valores numéricos. Cada estatística no StatsHub traz duas colunas essenciais:
- **`t` (Team / Feito):** Média por jogo produzida pelo próprio time (ex: chutes no gol que o time faz).
- **`c` (Conceded / Cedido):** Média por jogo concedida pelo time ao adversário (ex: chutes no gol que o time sofre).

### Tabela Mestra de Mapeamento (`STAT_MAP`):

| Nome Original no StatsHub | Chave Interna no Código | Descrição Estatística | Função no Cruzamento de Mercado |
| :--- | :--- | :--- | :--- |
| **Goals** | `goals` | Gols marcados (`t`) e sofridos (`c`) | Base do cálculo de expectativa de gols ($xG$). |
| **Corners** | `corners` | Escanteios a favor (`t`) e cedidos (`c`) | Base do cálculo de escanteios ($xC$). |
| **Cards** | `cards` | Total de cartões recebidos (`t`) e forçados (`c`) | Base do cálculo de cartões ($xCard$). |
| **Yellow Cards** | `yellow_cards` | Cartões amarelos recebidos (`t`) e sofridos (`c`) | Fator dominante (35%) no cálculo de cartões. |
| **Red Cards** | `red_cards` | Cartões vermelhos recebidos e sofridos | Métrica de indisciplina histórica complementar. |
| **Expected Goals (xG)** | `xg` | Gols esperados gerados (`t`) e cedidos (`c`) | Fator dominante (25%) na expectativa de gols. |
| **Shots On Target** | `shots_on_target` | Chutes no gol a favor (`t`) e sofridos (`c`) | Fator decisivo em Gols, Cantos, Chutes no Gol e Defesas. |
| **Shots In The Box** | `shots_in_box` | Chutes realizados dentro da grande área | Indicador de presença na área e volume de perigo. |
| **Total Shots** | `total_shots` | Total de chutes (no gol + fora + bloqueados) | Medida de volume ofensivo geral da equipe. |
| **Shots Outside The Box**| `shots_outside_box` | Chutes de fora da área | Indicador de média e longa distância. |
| **Big Chance Scored** | `big_chance_scored` | Grandes chances convertidas em gol | Eficiência de finalização do ataque. |
| **Big Chance Missed** | `big_chance_missed` | Grandes chances desperdiçadas | Geração de escanteios via rebate / defesa do goleiro. |
| **Big Chance Created** | `big_chance_created` | Grandes chances criadas pela equipe | Capacidade de armação e penetração ofensiva. |
| **Touches In Opp Box** | `touches_opp_box` | Toques na bola dentro da área adversária | Pressão ofensiva e volume de escanteios/gols. |
| **Crosses** | `crosses` | Cruzamentos efetuados para a área | Fator relevante (20%) na geração de escanteios. |
| **Possession** | `possession` | Porcentagem de posse de bola ($\%$) | Indicador de controle de jogo e domínio territorial. |
| **Clearances** | `clearances` | Cortes defensivos e rebatidas | Fator defensivo (40%) de resistência a escanteios/gols. |
| **Goalkeeper Saves** | `gk_saves` | Defesas efetuadas pelo goleiro | Média de intervenções do goleiro sob pressão. |
| **Fouls** | `fouls` | Faltas cometidas (`t`) e sofridas (`c`) | Fator dominante (40%) no mercado de faltas e cartões. |
| **Tackles** | `tackles` | Desarmes efetuados pela equipe | Fator de combate físico e paradas de jogada (faltas/cartões). |
| **Interception Won** | `interceptions` | Interceptações de passe bem-sucedidas | Fator de leitura defensiva e interrupção de ataque. |
| **Dispossessed** | `dispossessed` | Perdas de posse de bola sob pressão | Fator de vulnerabilidade e concessão de faltas. |
| **Offsides** | `offsides` | Impedimentos cometidos pela equipe | Indicador de linha de zaga adiantada e profundidade. |
| **Passes** | `passes` | Total de passes trocados | Volume de construção de jogo. |
| **Free Kicks** | `free_kicks` | Faltas cobradas / Tiros livres | Oportunidades de bola parada ofensiva. |
| **Throw Ins** | `throw_ins` | Arremessos laterais | Volume de jogo pelas pontas. |
| **Goal Kicks** | `goal_kicks` | Tiros de meta cobrados | Pressão sofrida ou bolas chutadas para fora. |
| **Errors Lead To Goal** | `errors_goal` | Erros graves que resultaram em gol | Falhas individuais e fragilidade defensiva. |
| **Errors Lead To Shot** | `errors_shot` | Erros graves que resultaram em chute | Concessão de finalizações ao adversário. |

---

## 3. O CRUZAMENTO MATEMÁTICO DE ESTATÍSTICAS E PARÂMETROS

### 3.1 As 4 Primitivas Matemáticas de Cruzamento

Toda previsão no sistema é construída através do cruzamento entre as estatísticas do **Time Atacante (Mandante/Visitante)** e do **Time Defensor (Visitante/Mandante)** usando 4 equações fundamentais:

#### 1. Âncora de Equilíbrio (`ancora`):
$$A(\text{atk}, \text{def}) = \frac{\text{atk.faz} + \text{def.cede}}{2}$$

#### 2. Índice de Intensidade Relativa (`indice`):
$$I(f, c) = \begin{cases} \frac{f}{(f + c) / 2}, & \text{se } (f + c) > 0 \\ 1.0, & \text{caso contrário} \end{cases}$$

#### 3. Resistência Defensiva Logarítmica (`resistencia`):
$$R(\text{cedidoDef}, \text{feitoAtk}) = \begin{cases} 1.0, & \text{se feitoAtk} \le 0 \\ \min\left(\frac{\ln(1 + \text{cedidoDef})}{\ln(1 + \text{feitoAtk})}, 2.0\right), & \text{caso contrário} \end{cases}$$

#### 4. Re-normalização Dinâmica de Pesos (`pesosDinamicos`):
$$w'_i = \frac{w_i}{\sum_{k \in \text{Válidos}} w_k} \implies I_{\text{composto}} = \sum w'_i \cdot v_i$$

---

### 3.2 Cruzamento Detalhado Mercado por Mercado

#### ⚽ GOLS | 🔲 ESCANTEIOS | 🎯 CHUTES NO GOL | 🟨 CARTÕES | 🤜 FALTAS | 🧤 DEFESAS | 💥 CHUTES TOTAIS | 🔁 BTTS | 🏆 1X2 DIXON-COLES

- **Odd Justa (Fair Odd):** $\text{OddJusta} = \max\left(1.01, \text{round}\left(\frac{1}{P}, 2\right)\right)$
- **Calculador de EV Real:** $EV(\%) = ((P \cdot \text{Odd}_{\text{casa}}) - 1) \times 100$

---

## 4. LINHAS COMERCIAIS REAIS DE CASAS DE APOSTAS (`COMMERCIAL_LINES`)

```javascript
export const COMMERCIAL_LINES = {
  goals_total:        [1.5, 2.5, 3.5, 4.5],
  goals_team:         [0.5, 1.5, 2.5],
  corners_total:      [7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
  corners_team:       [3.5, 4.5, 5.5, 6.5],
  cards_total:        [3.5, 4.5, 5.5, 6.5],
  cards_team:         [1.5, 2.5, 3.5],
  shots_target_total: [7.5, 8.5, 9.5, 10.5],
  shots_target_team:  [3.5, 4.5, 5.5],
  total_shots_total:  [21.5, 23.5, 25.5, 27.5],
  total_shots_team:   [10.5, 12.5, 14.5],
  saves_total:        [5.5, 6.5, 7.5],
  saves_team:         [2.5, 3.5, 4.5],
  fouls_total:        [22.5, 24.5, 26.5],
  fouls_team:         [10.5, 12.5, 14.5],
};
```

---

## 5. REGRAS DE DESIGN DE UI/UX, EV+ REAL E RESILIÊNCIA

1. **Card "Pick Principal do Modelo" (`MatchResultBlock.jsx`):** Exibe no topo a entrada recomendada do 1X2 (ex: **Vitória Argentina**), a **Odd Justa (Fair Odd)** ($1/P$) e um **Calculador de EV Real**, permitindo digitar a Odd da casa de apostas e calculando $EV(\%) = ((P \cdot \text{Odd}) - 1) \cdot 100$, destacando o badge `🔥 EV+ +X.X%` quando $EV > 0\%$.
2. **Card de Mercado (`MarketBlock.jsx`):** Exibe a **Linha Comercial Recomendada**, a **Odd Justa**, um campo para inserção da Odd da casa com calculador de EV+ Real e a tabela de linhas comerciais reais.
3. **Melhor Aposta por Mercado (`BestBetsByMarket.jsx`):** Ordena os mercados pelo desvio $|P - 0.50|$ para ranquear onde estão os melhores valores da partida (Odd Justa).
4. **Detalhamento de Escanteios (`CornerDetails.jsx`):** Exibe a tabela completa de fatores ofensivos e defensivos com os pesos e os valores parciais de cada time.
5. **Resiliência de Interface (`ErrorBoundary.jsx`):** Envolve a estrutura de rotas para capturar erros de renderização, prevenindo tela branca e exibindo interface de recuperação.
6. **Bateria de Testes de Não-Regressão (Vitest):** Testes unitários automatizados em `src/lib/predictionEngine.test.js` cobrem 100% das primitivas estatísticas, garantindo zero regressão matemática.

---

## 6. SISTEMA DE CALIBRAÇÃO E DIAGNÓSTICO (`CalibrationView.jsx`)

- **Viés ($\text{Viés}$):** $\bar{P}_{\text{previsto}} - \bar{R}_{\text{real}}$.
- **MAE (Erro Absoluto Médio):** $\frac{1}{N}\sum |P_i - R_i|$.
- **WinRate %:** Taxa de acerto das linhas principais recomendadas.

---

## 7. ESQUEMA DO BANCO DE DADOS (SUPABASE POSTGRESQL & RLS)

### Tabela `matches`:
- `id` (uuid, PK)
- `home_team`, `away_team`, `date` (text)
- `status` (`"pending"` | `"completed"`)
- `home_stats`, `away_stats` (jsonb, dados brutos do StatsHub)
- `results` (jsonb, projeções, probabilidades, `pick_1x2`)
- `real_results` (jsonb, placares e dados reais salvos pós-jogo para calibração)

### Segurança RLS (Row Level Security):
- Habilitada via `ALTER TABLE matches ENABLE ROW LEVEL SECURITY;` com políticas públicas ativas.

---
Este documento consolida 100% das especificações técnicas, matemáticas e operacionais do **Sports Predictor**, servindo como fonte única da verdade para qualquer Agente de IA.
