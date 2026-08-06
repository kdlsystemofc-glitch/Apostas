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
│ • Cálculo de Odd Mínima Justa (EV+): FairOdd = max(1.01, 1 / Prob).         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. CAMADA VISUAL E DASHBOARDS DE INTERFACE (React Components)               │
│ • MatchResultBlock.jsx -> Card "Pick Principal do Modelo" 1X2 + Odd EV+.    │
│ • MarketBlock.jsx      -> Highlight da Linha Base + Tabela Comercial.       │
│ • BestBetsByMarket.jsx -> Ranking de Melhores Apostas por Força de Sinal.   │
│ • CornerDetails.jsx    -> Tabela de Sub-Fatores Ofensivos/Defensivos.       │
│ • DailyOverview.jsx    -> Painel Diário de Jogos e Melhores Entradas.        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. PERSISTÊNCIA & SISTEMA DE CALIBRAÇÃO                                     │
│ • Supabase PostgreSQL (Tabela `matches`) -> Salva projeções e resultados.   │
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
Estabelece o valor médio neutro do confronto combinando o ataque de um time com a defesa do outro:
$$A(\text{atk}, \text{def}) = \frac{\text{atk.faz} + \text{def.cede}}{2}$$

#### 2. Índice de Intensidade Relativa (`indice`):
Mede o quanto o ataque de um time supera ou fica abaixo da média do confronto em um quesito específico:
$$I(f, c) = \begin{cases} \frac{f}{(f + c) / 2}, & \text{se } (f + c) > 0 \\ 1.0, & \text{caso contrário} \end{cases}$$

#### 3. Resistência Defensiva Logarítmica (`resistencia`):
Aplica uma compressão logarítmica $\ln(1+x)$ para medir o impacto da defesa adversária sobre o ataque. O uso do logaritmo evita que times com números discrepantes (outliers) distorçam a projeção. Possui trava de teto em $2.0$:
$$R(\text{cedidoDef}, \text{feitoAtk}) = \begin{cases} 1.0, & \text{se feitoAtk} \le 0 \\ \min\left(\frac{\ln(1 + \text{cedidoDef})}{\ln(1 + \text{feitoAtk})}, 2.0\right), & \text{caso contrário} \end{cases}$$

#### 4. Re-normalização Dinâmica de Pesos (`pesosDinamicos`):
Garante resiliência se faltar alguma estatística no texto colado. Se um componente $i$ tiver valor $0$, ele é ignorado e os pesos restantes são re-escalados para que a soma seja sempre $1.0$ ($100\%$):
$$w'_i = \frac{w_i}{\sum_{k \in \text{Válidos}} w_k} \implies I_{\text{composto}} = \sum w'_i \cdot v_i$$

---

### 3.2 Cruzamento Detalhado Mercado por Mercado

---

#### ⚽ MERCADO 1: GOLS ($xG_{\text{casa}}$ e $xG_{\text{fora}}$)
- **Função:** `calcGols(atk, def_, isHome)`
- **Âncora Base:** $A = \frac{\text{gols\_feitos}_{\text{atk}} + \text{gols\_sofridos}_{\text{def}}}{2}$
- **Composição dos Índices:**
  - **Fatores Ofensivos (55% do Peso Total):**
    - $\text{xg}$: Peso **0.25** ($\text{indice}$) ➔ Cruzamento do $xG$ feito com $xG$ cedido.
    - $\text{shots\_on\_target}$: Peso **0.25** ($\text{indice}$) ➔ Chutes no gol do ataque vs chutes no gol cedidos.
    - $\text{big\_chance\_scored}$: Peso **0.20** ($\text{indice}$) ➔ Grandes chances convertidas vs cedidas.
    - $\text{shots\_in\_box}$: Peso **0.15** ($\text{indice}$) ➔ Chutes na área vs chutes na área cedidos.
    - $\text{touches\_opp_box}$: Peso **0.15** ($\text{indice}$) ➔ Presença na área adversária vs permitida.
  - **Fatores Defensivos (45% do Peso Total):**
    - $\text{shots\_ced}$: Peso **0.45** ($\text{resistencia}$) ➔ Resistência de chutes no gol sofridos.
    - $\text{clearances}$: Peso **0.25** ($\text{resistencia}$) ➔ Cortes defensivos da zaga vs chutes na área.
    - $\text{errors\_goal}$: Peso **0.20** ($\text{indice}$) ➔ Erros graves que resultam em gol.
    - $\text{gk\_saves}$: Peso **0.10** ($\text{resistencia}$) ➔ Intervenções do goleiro adversário.
- **Fator Composto:** $I_{\text{composto}} = 0.55 \cdot I_{\text{ofensivo}} + 0.45 \cdot I_{\text{defensivo}}$
- **Multiplicador de Mando:** $\times 1.06$ ($+6\%$) para o Mandante; $\times 0.94$ ($-6\%$) para o Visitante.
- **Resultado:** $xG = A \cdot I_{\text{composto}} \cdot \text{mando}$.

---

#### 🔲 MERCADO 2: ESCANTEIOS ($xC_{\text{casa}}$ e $xC_{\text{fora}}$)
- **Função:** `calcCorners(atk, def_, isHome)`
- **Âncora Base:** $A = \frac{\text{escanteios\_feitos}_{\text{atk}} + \text{escanteios\_cedidos}_{\text{def}}}{2}$
- **Composição dos Índices:**
  - **Fatores Ofensivos (60% do Peso Total):**
    - $\text{shots\_on\_target}$: Peso **0.25** ($\text{indice}$)
    - $\text{shots\_in\_box}$: Peso **0.25** ($\text{indice}$)
    - $\text{crosses}$: Peso **0.20** ($\text{indice}$) ➔ Volume de bolas alçadas na área.
    - $\text{touches\_opp_box}$: Peso **0.15** ($\text{indice}$)
    - $\text{big\_chance\_missed}$: Peso **0.10** ($\text{indice}$) ➔ Rebates da zaga e defesas para escanteio.
    - $\text{total\_shots}$: Peso **0.05** ($\text{indice}$)
  - **Fatores Defensivos (40% do Peso Total):**
    - $\text{clearances}$: Peso **0.40** ($\text{resistencia}$) ➔ Cortes da zaga mandando para escanteio.
    - $\text{shots\_ced}$: Peso **0.35** ($\text{resistencia}$)
    - $\text{gk\_saves}$: Peso **0.25** ($\text{resistencia}$) ➔ Espalmadas do goleiro para a linha de fundo.
- **Fator Composto:** $I_{\text{composto}} = 0.60 \cdot I_{\text{ofensivo}} + 0.40 \cdot I_{\text{defensivo}}$
- **Multiplicador de Mando:** $\times 1.12$ ($+12\%$) para o Mandante.

---

#### 🎯 MERCADO 3: CHUTES NO GOL ($xS_{\text{casa}}$ e $xS_{\text{fora}}$)
- **Função:** `calcShotsOnTarget(atk, def_, isHome)`
- **Âncora Base:** $A = \frac{\text{chutes\_gol\_feitos}_{\text{atk}} + \text{chutes\_gol\_cedidos}_{\text{def}}}{2}$
- **Fatores Ofensivos (60%):** `shots_in_box` (**0.40**), `big_chance_created` (**0.25**), `total_shots` (**0.20**), `touches_opp_box` (**0.15**).
- **Fatores Defensivos (40%):** `shots_ced` (**0.60**), `clearances` (**0.40**).
- **Multiplicador de Mando:** $\times 1.04$ ($+4\%$) Mandante; $\times 0.96$ ($-4\%$) Visitante.

---

#### 🟨 MERCADO 4: CARTÕES ($xCard_{\text{casa}}$ e $xCard_{\text{fora}}$)
- **Função:** `calcCartoes(atk, def_, isHome)`
- **Composição da Base:** $A = 0.80 \cdot \text{ancora}(\text{cards}_{\text{atk}}, \text{cards}_{\text{def}}) + 0.20 \cdot \max(\text{cards}_{\text{atk}}, \text{cards}_{\text{def}})$
- **Fatores Ponderados (100%):**
  - $\text{yellow\_hist}$: Peso **0.35** ($\text{indice}$) ➔ Histórico de amarelos reais do time.
  - $\text{fouls}$: Peso **0.30** ($\text{indice}$) ➔ Faltas cometidas.
  - $\text{tackles}$: Peso **0.20** ($\text{indice}$) ➔ Desarmes rudes.
  - $\text{interceptions}$: Peso **0.15** ($\text{indice}$) ➔ Faltas táticas para parar contra-ataque.
- **Multiplicador de Mando:** $\times 0.95$ ($-5\%$) Mandante.

---

#### 🤜 MERCADO 5: FALTAS ($xFouls_{\text{casa}}$ e $xFouls_{\text{fora}}$)
- **Função:** `calcFaltas(atk, def_)`
- **Âncora e Multiplicador por Volumetria:**
  $$\text{baseRaw} = \text{ancora}(\text{fouls}_{\text{atk}}, \text{fouls}_{\text{def}})$$
  $$\text{mult} = \begin{cases} 1.20, & \text{se baseRaw} < 18 \\ 1.12, & \text{se } 18 \le \text{baseRaw} < 22 \\ 1.05, & \text{se baseRaw} \ge 22 \end{cases} \implies \text{base} = \text{baseRaw} \cdot \text{mult}$$
- **Fatores Ponderados (100%):** `fouls` (**0.40**), `tackles` (**0.30**), `interceptions` (**0.20**), `dispossessed` (**0.10**).

---

#### 🧤 MERCADO 6: DEFESAS DO GOLEIRO ($xSaves$)
- **Função:** `calcSaves(atk, def_)`
- **Âncora Base:** $A = \text{ancora}(\text{def.gk\_saves.t}, \text{atk.shots\_on\_target.t})$
- **Fatores Ponderados (100%):** `shots_on_target` (**0.45**), `shots_in_box` (**0.25**), `big_chance_created` (**0.15**), `total_shots` (**0.15**).

---

#### 💥 MERCADO 7: CHUTES TOTAIS ($xTotalShots$)
- **Função:** `calcTotalShots(atk, def_, isHome)`
- **Âncora Base:** $A = \text{ancora}(\text{atk.total\_shots.t}, \text{def.total\_shots.c})$
- **Fatores Ponderados (100%):** `total_shots` (**0.40**), `shots_in_box` (**0.25**), `touches_opp_box` (**0.20**), `big_chance_created` (**0.15**).
- **Mando:** $\times 1.05$ Mandante, $\times 0.95$ Visitante.

---

#### 🔁 MERCADO 8: AMBAS MARCAM / BTTS
- **Função:** `calcBTTS(statsCasa, statsFora)`
- **Cálculo:**
  $$P(\text{Casa Marca}) = 1 - e^{-xG_{\text{casa}}}, \quad P(\text{Fora Marca}) = 1 - e^{-xG_{\text{fora}}}$$
  $$P(\text{BTTS}) = \max(0, \min(1, P(\text{Casa Marca}) \cdot P(\text{Fora Marca})))$$

---

#### 🏆 MERCADO 9: RESULTADO 1X2 COM AJUSTE DIXON-COLES (`calcResultado`)
Gera a Matriz de Placares de $0 \times 0$ até $8 \times 8$. Para cada placar $(i, j)$:

1. **Calcula PMF de Poisson:** $P_{\text{pois}}(i, xG_{\text{casa}}) \cdot P_{\text{pois}}(j, xG_{\text{fora}})$
2. **Aplica Ajuste de Dependência Dixon-Coles $\tau(i, j)$ ($\rho = -0.13$):**
   $$\tau(i, j) = \max\left(0, \begin{cases} 1 - (xG_{\text{casa}} \cdot xG_{\text{fora}} \cdot \rho), & i=0, j=0 \\ 1 + (xG_{\text{casa}} \cdot \rho), & i=1, j=0 \\ 1 + (xG_{\text{fora}} \cdot \rho), & i=0, j=1 \\ 1 - \rho, & i=1, j=1 \\ 1.0, & \text{caso contrário} \end{cases}\right)$$
3. **Probabilidade do Placar:** $P(i, j) = P_{\text{pois}}(i) \cdot P_{\text{pois}}(j) \cdot \tau(i, j)$
4. **Normalização da Matriz:** $P_{\text{casa}} = \sum_{i>j} P(i,j)$, $P_{\text{empate}} = \sum_{i=j} P(i,j)$, $P_{\text{fora}} = \sum_{i<j} P(i,j)$.
5. **Decisão Estrita (Pick 1X2):** Seleciona o resultado de maior probabilidade entre as 3 opções puras (**Vitória Casa**, **Empate** ou **Vitória Fora**).
6. **Odd Mínima Justa (EV+):** $\text{OddMin} = \max\left(1.01, \text{round}\left(\frac{1}{P_{\text{vencedora}}}, 2\right)\right)$

---

## 4. LINHAS COMERCIAIS REAIS DE CASAS DE APOSTAS (`COMMERCIAL_LINES`)

Para eliminar "linhas lixo" sem mercado real nas casas de apostas (ex: "Over 0.5 Defesas do Goleiro"), o sistema consulta o dicionário de **Linhas Comercializáveis da Bet365 / Pinnacle**:

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

## 5. REGRAS DE DESIGN DE UI/UX E VISUALIZAÇÃO

1. **Card "Pick Principal do Modelo" (`MatchResultBlock.jsx`):** Exibe em destaque no topo a entrada recomendada do 1X2 (ex: **Vitória Argentina**), o percentual de confiança e a Odd Mínima EV+.
2. **Card de Mercado (`MarketBlock.jsx`):** Exibe a **Linha Comercial Recomendada** (a linha de `COMMERCIAL_LINES` mais próxima do valor esperado) no destaque central escuro, seguida da tabela de linhas comerciais reais contendo o percentual e a Odd Mínima de cada linha.
3. **Melhor Aposta por Mercado (`BestBetsByMarket.jsx`):** Ordena os mercados pelo desvio $|P - 0.50|$ para ranquear onde estão os melhores valores da partida.
4. **Detalhamento de Escanteios (`CornerDetails.jsx`):** Exibe a tabela completa de fatores ofensivos e defensivos com os pesos e os valores parciais de cada time.

---

## 6. SISTEMA DE CALIBRAÇÃO E DIAGNÓSTICO (`CalibrationView.jsx`)

O módulo de calibração permite avaliar a precisão das projeções acumuladas agrupando as partidas finalizadas em blocos de 10 jogos:

- **Viés ($\text{Viés}$):** $\bar{P}_{\text{previsto}} - \bar{R}_{\text{real}}$. Indica se o modelo está superestimando ($> 0$) ou subestimando ($< 0$) um mercado.
- **MAE (Erro Absoluto Médio):** $\frac{1}{N}\sum |P_i - R_i|$.
- **WinRate %:** Taxa de acerto das linhas principais recomendadas.
- **Classificação:** `✓ Calibrado` ($|\text{Viés}| < 0.30$), `⚠ Leve Viés` ($0.30 \le |\text{Viés}| < 0.70$) ou `✗ Revisar Pesos` ($|\text{Viés}| \ge 0.70$).

---

## 7. ESQUEMA DO BANCO DE DADOS (SUPABASE POSTGRESQL)

### Tabela `matches`:
- `id` (uuid, PK)
- `home_team`, `away_team`, `date` (text)
- `status` (`"pending"` | `"completed"`)
- `home_stats`, `away_stats` (jsonb, dados brutos do StatsHub)
- `results` (jsonb, projeções, probabilidades, `pick_1x2`)
- `real_results` (jsonb, placares e dados reais salvos pós-jogo para calibração)

---
Este documento consolida 100% das especificações técnicas, matemáticas e operacionais do **Sports Predictor**, servindo como fonte única da verdade para qualquer Agente de IA.
