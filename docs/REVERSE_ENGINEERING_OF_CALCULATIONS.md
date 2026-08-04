# RELATÓRIO TÉCNICO DE ENGENHARIA REVERSA — FASE 1.2
## REVERSE ENGINEERING OF CALCULATIONS — PREDICTION ENGINE

Nenhum arquivo foi alterado ou modificado. Este documento detalha minuciosamente todas as fórmulas, pesos, constantes *hardcoded*, *thresholds*, funções e fontes de dados utilizados pelo motor de análise do **Sports Predictor**.

---

## 0. CONCEITOS E ESTRUTURAS DE CÁLCULO BASE (CORE ENGINE HELPERS)

Todas as previsões de mercado utilizam um conjunto de 5 funções utilitárias fundamentais definidas em `src/lib/predictionEngine.js`:

### A. Leitor de Estatísticas Com Fallback `g()`
- **Função:** `g(stats, key, campo = "t")`
- **Origem dos Dados:** Objeto parseado `homeStats` / `awayStats` de `parseStatsHubText()`. `t` = estatística realizada pelo time; `c` = estatística concedida pelo time.
- **Constante Hardcoded / Fallback:** `0.0` se a estatística não for encontrada.

### B. Índice Relativo de Intensidade `indice()`
- **Função:** `indice(feito, cedido)`
- **Fórmula:**
  $$\text{ref} = \frac{\text{feito} + \text{cedido}}{2}$$
  $$\text{Índice} = \begin{cases} \frac{\text{feito}}{\text{ref}}, & \text{se } \text{ref} > 0 \\ 1.0, & \text{se } \text{ref} \le 0 \end{cases}$$
- **Constante Hardcoded / Fallback:** `1.0` se $\text{ref} \le 0$.

### C. Resistência Defensiva `resistencia()`
- **Função:** `resistencia(cedidoDef, feitoAtk, cap = 2.0)`
- **Fórmula:**
  $$\text{Resistência} = \begin{cases} \min\left( \frac{\ln(1 + \text{cedidoDef})}{\ln(1 + \text{feitoAtk})}, \text{cap} \right), & \text{se } \text{feitoAtk} > 0 \\ 1.0, & \text{se } \text{feitoAtk} \le 0 \end{cases}$$
- **Constante Hardcoded / Cap:** `cap = 2.0` (teto máximo de resistência). Fallback `1.0`.

### D. Âncora Base `ancora()`
- **Função:** `ancora(timeFaz, advCede)`
- **Fórmula:**
  $$\text{Âncora} = \frac{\text{timeFaz} + \text{advCede}}{2}$$

### E. Pesos Dinâmicos Ponderados `pesosDinamicos()`
- **Função:** `pesosDinamicos(componentes)`
- **Fórmula:**
  Dada uma lista de pares $(\text{peso}_i, \text{valor}_i)$, filtra apenas os itens onde $\text{valor}_i > 0$.
  $$\text{peso\_normalizado}_i = \frac{\text{peso}_i}{\sum_{k \in \text{válidos}} \text{peso}_k}$$
  $$\text{Índice Final} = \sum_{i \in \text{válidos}} \left( \text{peso\_normalizado}_i \times \text{valor}_i \right)$$
- **Constante Hardcoded / Fallback:** `1.0` se nenhum componente for válido.

---

## 1. MERCADO: VITÓRIA CASA, EMPATE E VITÓRIA FORA (1X2) & PLACARES TOP 5

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L404-L436)
- **Função Responsável:** `calcResultado(xgCasa, xgFora)` (invocada por `analisarJogo()`)
- **Origem dos Dados:** Valores $xG_{\text{casa}}$ e $xG_{\text{fora}}$ gerados previamente pela função `calcGols()`.
- **Fórmula Matemática:**
  Distribuição Bivariada de Poisson com suposição de independência entre gols do mandante ($X$) e do visitante ($Y$):
  $$P(X = i, Y = j) = \text{PMF}_{\text{Poisson}}(i, xG_{\text{casa}}) \times \text{PMF}_{\text{Poisson}}(j, xG_{\text{fora}})$$
  Onde:
  $$\text{PMF}_{\text{Poisson}}(k, \lambda) = \frac{e^{-\lambda} \cdot \lambda^k}{k!}$$
  As probabilidades dos mercados 1X2 são dadas pelo somatório das probabilidades da matriz $9 \times 9$:
  $$P(\text{Vitória Casa}) = \sum_{i > j} P(X = i, Y = j)$$
  $$P(\text{Empate}) = \sum_{i = j} P(X = i, Y = j)$$
  $$P(\text{Vitória Fora}) = \sum_{i < j} P(X = i, Y = j)$$
- **Pesos Utilizados:** Não há pesos ponderados; utiliza probabilidades exatas de Poisson.
- **Constantes Hardcoded / Valores Fixos:**
  - `maxGols = 8`: Limite da matriz de gols iterados de $0$ a $8$ (matriz de dimensão $9 \times 9 = 81$ placares possíveis).
- **Thresholds & Placares Top 5:**
  - Ordena os 81 placares em ordem decrescente de probabilidade e seleciona os 5 primeiros (`placares.slice(0, 5)`).
- **Arredondamento:** `Math.round(p * 10000) / 10000` (4 casas decimais).

---

## 2. MERCADO: AMBAS MARCAM (BTTS - BOTH TEAMS TO SCORE)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L286-L310) e [`src/lib/leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js#L96-L100)
- **Funções Responsáveis:** `calcBTTS(statsCasa, statsFora)` e `ajustarBTTS(pBtts, leagueProfile)`
- **Origem dos Dados:** $xG_{\text{casa}}$ e $xG_{\text{fora}}$ obtidos de `calcGols()`, acrescidos do histórico `btts_pct` de `LeagueProfile`.
- **Fórmula Matemática:**
  1. Probabilidade individual de cada time marcar ao menos 1 gol:
     $$P(\text{Casa Marca}) = 1 - e^{-xG_{\text{casa}}}$$
     $$P(\text{Fora Marca}) = 1 - e^{-xG_{\text{fora}}}$$
  2. Probabilidade Bruta Indireta:
     $$P(\text{BTTS}_{\text{raw}}) = P(\text{Casa Marca}) \times P(\text{Fora Marca})$$
  3. Fator de Correlação Logística Suave (Ajuste por total de gols esperados $xG_{\text{total}} = xG_{\text{casa}} + xG_{\text{fora}}$):
     $$\text{fatorCorrela} = \frac{1}{1 + e^{-1.3 \times (xG_{\text{total}} - 2.8)}}$$
     $$\text{desconto} = 0.62 + 0.36 \times \text{fatorCorrela}$$
     $$P(\text{BTTS}_{\text{modelo}}) = \max\left(0, \min\left(1, P(\text{BTTS}_{\text{raw}}) \times \text{desconto}\right)\right)$$
  4. Ajuste de Liga (se Perfil de Liga existente):
     $$P(\text{BTTS}_{\text{final}}) = P(\text{BTTS}_{\text{modelo}}) \times (1 - 0.30) + \left(\frac{\text{btts\_pct}_{\text{liga}}}{100}\right) \times 0.30$$
- **Pesos e Constantes Hardcoded:**
  - Slope da logística: `1.3`
  - Inflexão da logística (midpoint): `2.8`
  - Piso de desconto: `0.62`
  - Amplitude do desconto: `0.36` (o fator de desconto varia entre $0.62$ e $0.98$)
  - Peso de calibração da liga: `LEAGUE_WEIGHT = 0.30` (30% liga, 70% modelo).
- **Thresholds de Sinal (`sinalBTTS`):**
  - $p \ge 0.72$ ➔ `"SIM · FORTE"` (verde)
  - $p \ge 0.60$ ➔ `"SIM · POSSÍVEL"` (amarelo)
  - $p \le 0.35$ ➔ `"NÃO · FORTE"` (vermelho)
  - $p \le 0.45$ ➔ `"NÃO · POSSÍVEL"` (cinza)
  - Outros ➔ `"NEUTRO"` (cinza)

---

## 3. MERCADO: GOLS (xGOLS, EXPECTED GOALS)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L217-L250)
- **Funções Responsáveis:** `calcGols(atk, def_, isHome)` e `fatorLiga()` em [`leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js#L41)
- **Origem dos Dados:** Estatísticas de Goals, xG, Big Chances, Shots on Target, Shots in Box, Touches in Opp Box, Clearances, Goalkeeper Saves e Errors.
- **Fórmula Matemática:**
  1. **Âncora Base:**
     $$\text{base} = \frac{\text{goals}_{\text{atk.t}} + \text{goals}_{\text{def.c}}}{2}$$
  2. **Índice Ofensivo ($i_o$):**
     Pesos ponderados dos fatores ofensivos:
     - `xg` ($0.22$): `indice(atk.xg.t, def_.xg.c)`
     - `big_chance_scored` ($0.20$): `indice(atk.big_chance_scored.t, def_.big_chance_scored.c)`
     - `shots_on_target` ($0.20$): `indice(atk.shots_on_target.t, def_.shots_on_target.c)`
     - `shots_in_box` ($0.13$): `indice(atk.shots_in_box.t, def_.shots_in_box.c)`
     - `touches_opp_box` ($0.13$): `indice(atk.touches_opp_box.t, def_.touches_opp_box.c)`
     - `big_chance_created` ($0.12$): `indice(atk.big_chance_created.t, def_.big_chance_created.c)`
  3. **Índice Defensivo ($i_d$):**
     Pesos ponderados dos fatores defensivos:
     - `gk_saves` ($0.42$): `resistencia(def_.gk_saves.t, atk.shots_on_target.t)`
     - `shots_ced` ($0.26$): `resistencia(def_.shots_on_target.c, atk.shots_on_target.t)`
     - `clearances` ($0.16$): `resistencia(def_.clearances.c, atk.shots_in_box.t)`
     - `errors` ($0.16$): `indice(atk.errors_goal.t, Math.max(def_.errors_goal.c, 0.01))`
  4. **Índice Composto ($i_c$):**
     $$i_c = 0.55 \times i_o + 0.45 \times i_d$$
  5. **Multiplicador de Mando de Campo:**
     $$xG_{\text{bruto}} = \text{base} \times i_c \times \begin{cases} 1.08, & \text{se mandante (isHome = true)} \\ 0.92, & \text{se visitante (isHome = false)} \end{cases}$$
  6. **Ajuste da Liga (`MatchResults.jsx`):**
     $$f_G = \max\left(0.80, \min\left(1.20, 1 + 0.5 \times \ln\left(\frac{\text{avg\_goals}_{\text{liga}}}{2.69}\right)\right)\right)$$
     $$xG_{\text{final}} = xG_{\text{bruto}} \times f_G$$
- **Constantes Hardcoded:**
  - Pesos Compostos: `0.55` (Ofensivo) e `0.45` (Defensivo)
  - Fator Casa: `1.08` (+8%)
  - Fator Fora: `0.92` (-8%)
  - Média de Gols do App (`APP_GLOBALS.avg_goals`): `2.69`
  - Constante de segurança contra divisão por zero em erros: `0.01`
- **Thresholds de Sinal (`sinalPoissonGols`):**
  - $prob \ge 0.78$ ➔ `"FORTE OVER"` (verde)
  - $prob \ge 0.70$ ➔ `"OVER"` (amarelo)
  - $prob \le 0.22$ ➔ `"FORTE UNDER"` (vermelho)
  - $prob \le 0.32$ ➔ `"UNDER"` (cinza)
  - Outros ➔ `"NEUTRO"` (cinza)

---

## 4. MERCADO: ESCANTEIOS (xCORNERS)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L172-L214)
- **Funções Responsáveis:** `calcCorners(atk, def_, isHome)` e `fatorLiga()` em [`leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js#L41)
- **Origem dos Dados:** Corners, Shots on Target, Shots in Box, Big Chance Missed, Crosses, Touches in Opp Box, Total Shots, Possession, GK Saves, Clearances.
- **Fórmula Matemática:**
  1. **Âncora Base:**
     $$\text{base} = \frac{\text{corners}_{\text{atk.t}} + \text{corners}_{\text{def.c}}}{2}$$
  2. **Índice Ofensivo ($i_o$):**
     - `shots_on_target` ($0.27$): `indice(atk.shots_on_target.t, def_.shots_on_target.c)`
     - `shots_in_box` ($0.22$): `indice(atk.shots_in_box.t, def_.shots_in_box.c)`
     - `big_chance_missed` ($0.13$): `indice(atk.big_chance_missed.t, def_.big_chance_missed.c)`
     - `crosses` ($0.13$): `indice(atk.crosses.t, def_.crosses.c)`
     - `touches_opp_box` ($0.13$): `indice(atk.touches_opp_box.t, def_.touches_opp_box.c)`
     - `total_shots` ($0.10$): `indice(atk.total_shots.t, def_.total_shots.c)`
     - `possession` ($0.08$): `indice(atk.possession.t, def_.possession.c)`
  3. **Índice Defensivo ($i_d$):**
     - `gk_saves` ($0.50$): `resistencia(def_.gk_saves.t, atk.shots_on_target.t)`
     - `clearances` ($0.25$): `resistencia(def_.clearances.c, atk.shots_in_box.t)`
     - `shots_ced` ($0.25$): `resistencia(def_.shots_on_target.c, atk.shots_on_target.t)`
  4. **Índice Composto ($i_c$):**
     $$i_c = 0.60 \times i_o + 0.40 \times i_d$$
  5. **Multiplicador de Mando de Campo:**
     $$xC_{\text{bruto}} = \text{base} \times i_c \times \begin{cases} 1.18, & \text{se mandante (isHome = true)} \\ 1.00, & \text{se visitante (isHome = false)} \end{cases}$$
  6. **Ajuste da Liga (`MatchResults.jsx`):**
     $$f_C = \max\left(0.80, \min\left(1.20, 1 + 0.5 \times \ln\left(\frac{\text{avg\_corners}_{\text{liga}}}{9.67}\right)\right)\right)$$
     $$xC_{\text{final}} = xC_{\text{bruto}} \times f_C$$
- **Constantes Hardcoded:**
  - Pesos Compostos: `0.60` (Ofensivo) e `0.40` (Defensivo)
  - Fator Casa: `1.18` (+18%)
  - Média de Escanteios do App (`APP_GLOBALS.avg_corners`): `9.67`
- **Thresholds de Sinal (`sinalPoisson`):**
  - $prob \ge 0.75$ ➔ `"FORTE OVER"` (verde)
  - $prob \ge 0.65$ ➔ `"OVER"` (amarelo)
  - $prob \le 0.25$ ➔ `"FORTE UNDER"` (vermelho)
  - $prob \le 0.35$ ➔ `"UNDER"` (cinza)

---

## 5. MERCADO: CARTÕES (xCARDS)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L313-L338)
- **Funções Responsáveis:** `calcCartoes(atk, def_, isHome)` e `fatorLiga()` em [`leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js#L41)
- **Origem dos Dados:** Cards, Fouls, Tackles, Interceptions, Dispossessed, Free Kicks, Yellow Cards, Offsides.
- **Fórmula Matemática:**
  1. **Âncora Base Composta Ponderada:**
     $$\text{baseMedia} = \frac{\text{cards}_{\text{atk.t}} + \text{cards}_{\text{def.c}}}{2}$$
     $$\text{baseMax} = \max(\text{cards}_{\text{atk.t}}, \text{cards}_{\text{def.c}})$$
     $$\text{base} = \text{baseMedia} \times 0.90 + \text{baseMax} \times 0.10$$
  2. **Índice Composto de Fatores ($i_c$):**
     - `fouls` ($0.25$): `indice(atk.fouls.t, def_.fouls.c)`
     - `tackles` ($0.20$): `indice(atk.tackles.t, def_.tackles.c)`
     - `interceptions` ($0.16$): `indice(atk.interceptions.t, def_.interceptions.c)`
     - `dispossessed` ($0.15$): `indice(atk.dispossessed.t, def_.dispossessed.c)`
     - `free_kicks_ced` ($0.12$): `indice(def_.free_kicks.c, Math.max(atk.free_kicks.t, 0.01))`
     - `yellow_hist` ($0.07$): `indice(atk.yellow_cards.t, Math.max(def_.yellow_cards.c, 0.01))`
     - `offsides` ($0.05$): `indice(atk.offsides.t, Math.max(def_.offsides.c, 0.01))`
  3. **Multiplicador de Mando de Campo:**
     $$xCard_{\text{bruto}} = \text{base} \times i_c \times \begin{cases} 0.92, & \text{se mandante (isHome = true)} \\ 1.00, & \text{se visitante (isHome = false)} \end{cases}$$
  4. **Ajuste da Liga (`MatchResults.jsx`):**
     $$f_K = \max\left(0.80, \min\left(1.20, 1 + 0.5 \times \ln\left(\frac{\text{avg\_cards}_{\text{liga}}}{2.94}\right)\right)\right)$$
     $$xCard_{\text{final}} = xCard_{\text{bruto}} \times f_K$$
- **Constantes Hardcoded:**
  - Divisão da Base: `0.90` (Média) / `0.10` (Máximo)
  - Fator Casa: `0.92` (-8% cartões para mandante devido ao fator torcida)
  - Média de Cartões do App (`APP_GLOBALS.avg_cards`): `2.94`
  - Constante de segurança contra divisão por zero: `0.01`

---

## 6. MERCADO: CHUTES NO GOL (xSHOTS ON TARGET)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L253-L283)
- **Função Responsável:** `calcShotsOnTarget(atk, def_, isHome)`
- **Origem dos Dados:** Shots on Target, Shots in Box, Big Chance Created, Total Shots, Touches in Opp Box, Possession, GK Saves, Clearances.
- **Fórmula Matemática:**
  1. **Âncora Base:**
     $$\text{base} = \frac{\text{shots\_on\_target}_{\text{atk.t}} + \text{shots\_on\_target}_{\text{def.c}}}{2}$$
  2. **Índice Ofensivo ($i_o$):**
     - `shots_in_box` ($0.36$): `indice(atk.shots_in_box.t, def_.shots_in_box.c)`
     - `big_chance_created` ($0.23$): `indice(atk.big_chance_created.t, def_.big_chance_created.c)`
     - `total_shots` ($0.18$): `indice(atk.total_shots.t, def_.total_shots.c)`
     - `touches_opp_box` ($0.13$): `indice(atk.touches_opp_box.t, def_.touches_opp_box.c)`
     - `possession` ($0.10$): `indice(atk.possession.t, def_.possession.c)`
  3. **Índice Defensivo ($i_d$):**
     - `gk_saves` ($0.60$): `resistencia(def_.gk_saves.t, atk.shots_on_target.t)`
     - `clearances` ($0.40$): `resistencia(def_.clearances.c, atk.shots_in_box.t)`
  4. **Índice Composto ($i_c$):**
     $$i_c = 0.60 \times i_o + 0.40 \times i_d$$
  5. **Multiplicador de Mando de Campo:**
     $$xS = \text{base} \times i_c \times \begin{cases} 1.05, & \text{se mandante (isHome = true)} \\ 0.95, & \text{se visitante (isHome = false)} \end{cases}$$
- **Constantes Hardcoded:**
  - Pesos Compostos: `0.60` (Ofensivo) e `0.40` (Defensivo)
  - Fator Casa: `1.05` (+5%)
  - Fator Fora: `0.95` (-5%)

---

## 7. MERCADO: DEFESAS DO GOLEIRO (xSAVES)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L362-L378)
- **Função Responsável:** `calcSaves(atk, def_)`
- **Nota de Parâmetro:** `atk` = time atacante (gerador dos chutes); `def_` = time defendendo (goleiro que realiza as defesas).
- **Origem dos Dados:** GK Saves, Shots on Target, Shots in Box, Big Chance Created, Total Shots, xG.
- **Fórmula Matemática:**
  1. **Âncora Base:**
     $$\text{base} = \frac{\text{gk\_saves}_{\text{def.t}} + \text{gk\_saves}_{\text{atk.c}}}{2}$$
  2. **Índice Composto ($i_c$):**
     - `shots_on_target` ($0.35$): `indice(atk.shots_on_target.t, def_.shots_on_target.c)`
     - `shots_in_box` ($0.22$): `indice(atk.shots_in_box.t, def_.shots_in_box.c)`
     - `big_chance_created` ($0.18$): `indice(atk.big_chance_created.t, def_.big_chance_created.c)`
     - `total_shots` ($0.13$): `indice(atk.total_shots.t, def_.total_shots.c)`
     - `xg` ($0.12$): `indice(atk.xg.t, Math.max(def_.xg.c, 0.01))`
  3. **Resultado:**
     $$xSaves = \text{base} \times i_c$$
- **Constantes Hardcoded:**
  - Constante de segurança contra divisão por zero em xG: `0.01`

---

## 8. MERCADO: FALTAS (xFOULS)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L341-L358)
- **Função Responsável:** `calcFaltas(atk, def_)`
- **Origem dos Dados:** Fouls, Tackles, Interceptions, Dispossessed, Crosses, Offsides.
- **Fórmula Matemática:**
  1. **Âncora Base Inicial:**
     $$\text{baseRaw} = \frac{\text{fouls}_{\text{atk.t}} + \text{fouls}_{\text{def.c}}}{2}$$
  2. **Escalamento por Faixas de Faltas (Thresholds Hardcoded):**
     $$\text{mult} = \begin{cases} 1.28, & \text{se } \text{baseRaw} < 18 \\ 1.18, & \text{se } 18 \le \text{baseRaw} < 22 \\ 1.10, & \text{se } \text{baseRaw} \ge 22 \end{cases}$$
     $$\text{base} = \text{baseRaw} \times \text{mult}$$
  3. **Índice Composto ($i_c$):**
     - `fouls` ($0.30$): `indice(atk.fouls.t, def_.fouls.c)`
     - `tackles` ($0.22$): `indice(atk.tackles.t, def_.tackles.c)`
     - `interceptions` ($0.18$): `indice(atk.interceptions.t, def_.interceptions.c)`
     - `dispossessed` ($0.15$): `indice(atk.dispossessed.t, def_.dispossessed.c)`
     - `crosses` ($0.10$): `indice(atk.crosses.t, def_.crosses.c)`
     - `offsides` ($0.05$): `indice(atk.offsides.t, Math.max(def_.offsides.c, 0.01))`
  4. **Resultado:**
     $$xFouls = \text{base} \times i_c$$
- **Constantes Hardcoded / Thresholds:**
  - Multiplicadores por faixa: `1.28` (+28%), `1.18` (+18%), `1.10` (+10%).
  - Corte de faixas de faltas: `18` e `22`.
- **Aviso na Interface (`MatchResults.jsx`):**
  - `"⚠ Mercado com alta variância — sinais removidos das recomendações automáticas"`

---

## 9. MERCADO: CHUTES TOTAIS (xTOTAL SHOTS)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L381-L402)
- **Função Responsável:** `calcTotalShots(atk, def_, isHome)`
- **Origem dos Dados:** Total Shots, Shots in Box, Touches in Opp Box, Big Chance Created, Possession, Crosses.
- **Fórmula Matemática:**
  1. **Âncora Base:**
     $$\text{base} = \frac{\text{total\_shots}_{\text{atk.t}} + \text{total\_shots}_{\text{def.c}}}{2}$$
  2. **Índice Composto ($i_c$):**
     - `shots_in_box` ($0.26$): `indice(atk.shots_in_box.t, def_.shots_in_box.c)`
     - `touches_opp_box` ($0.26$): `indice(atk.touches_opp_box.t, def_.touches_opp_box.c)`
     - `big_chance_created` ($0.22$): `indice(atk.big_chance_created.t, def_.big_chance_created.c)`
     - `possession` ($0.13$): `indice(atk.possession.t, def_.possession.c)`
     - `crosses` ($0.13$): `indice(atk.crosses.t, def_.crosses.c)`
  3. **Multiplicador de Mando de Campo:**
     $$xTotalShots = \text{base} \times i_c \times \begin{cases} 1.08, & \text{se mandante (isHome = true)} \\ 0.92, & \text{se visitante (isHome = false)} \end{cases}$$
- **Constantes Hardcoded:**
  - Fator Casa: `1.08` (+8%)
  - Fator Fora: `0.92` (-8%)
  - Property Flag: `lowConfidence: true` (Mercado rotulado como "em recalibração — baixa confiabilidade" em `BestBetsByMarket.jsx`).

---

## 10. PROBABILIDADES DE LINHAS OVER/UNDER (POISSON CDF & LINHAS DINÂMICAS)

- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L146-L152) e [`src/components/stats/MatchResults.jsx`](file:///c:/appo/src/components/stats/MatchResults.jsx#L7-L20)
- **Funções Responsáveis:** `poissonOver(media, linha)` e `linhasDinamicas(x, nLados = 3)`
- **Geração de Linhas Reais:**
  - Dado um valor esperado $x$, calcula a linha principal de mercado terminada em `.5`:
    $$\text{centro} = \lfloor x \rfloor + 0.5$$
  - Gera 7 linhas asiáticas/europeias reais no intervalo $[ \text{centro} - 3, \text{centro} + 3 ]$ (ex: Over 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5).
- **Fórmula da Probabilidade Over:**
  $$P(X > \text{linha}) = 1 - \sum_{i=0}^{\lfloor \text{linha} \rfloor} \frac{e^{-\lambda} \cdot \lambda^i}{i!} \quad \text{onde } \lambda = x_{\text{total\_ajustado}}$$

---

## 11. ALGORITMO SELETOR DA MELHOR APOSTA (`bestLine`)

- **Arquivo:** [`src/components/stats/BestBetsByMarket.jsx`](file:///c:/appo/src/components/stats/BestBetsByMarket.jsx#L27-L55)
- **Função Responsável:** `bestLine(xTotal, lines, sinalFn, dynamic, overMap)`
- **Fórmula de Pontuação (Score de Ranking):**
  Para cada linha candidata:
  $$\text{linhaPrincipal} = \lfloor xTotal \rfloor + 0.5$$
  $$\text{dist} = |\text{linha} - \text{linhaPrincipal}|$$
  $$\text{distPenalty} = \text{dist} \times 0.12$$
  $$\text{signalBonus} = \begin{cases} 0.35, & \text{se sinal contém "FORTE"} \\ 0.18, & \text{se sinal é "OVER" ou "UNDER"} \\ 0.00, & \text{se sinal é "NEUTRO"} \end{cases}$$
  $$\text{Score} = (1 - \text{distPenalty}) + \text{signalBonus} + \begin{cases} 0.05, & \text{se } prob \ge 0.50 \\ 0.00, & \text{caso contrário} \end{cases}$$
- **Seleção:** A linha com o maior `Score` é escolhida como a recomendação principal para cada mercado.
- **Constantes Hardcoded:**
  - Penalidade por distância de linha: `0.12` por unidade de desvio.
  - Bônus por Sinal Forte: `0.35`.
  - Bônus por Sinal Normal: `0.18`.
  - Bônus de linha favorável ($prob \ge 50\%$): `0.05`.

---

## RESUMO CONSOLIDADO DE TODAS AS CONSTANTES HARDCODED DO ENGINE

| Categoria | Constante Hardcoded | Valor | Arquivo / Localização | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| **Gols** | Bônus Mandante | `1.08` (+8%) | `predictionEngine.js:241` | Aumento do xG em casa |
| **Gols** | Penalidade Visitante | `0.92` (-8%) | `predictionEngine.js:243` | Redução do xG fora |
| **Gols** | Pesos Composição | `0.55` / `0.45` | `predictionEngine.js:238` | 55% Ofensivo / 45% Defensivo |
| **Escanteios** | Bônus Mandante | `1.18` (+18%) | `predictionEngine.js:196` | Aumento do xCorners em casa |
| **Escanteios** | Pesos Composição | `0.60` / `0.40` | `predictionEngine.js:193` | 60% Ofensivo / 40% Defensivo |
| **Cartões** | Penalidade Mandante | `0.92` (-8%) | `predictionEngine.js:331` | Menos cartões para mandante |
| **Cartões** | Composição da Base | `0.90` / `0.10` | `predictionEngine.js:316` | 90% Média / 10% Máximo |
| **Chutes no Gol**| Bônus/Penalidade Casa/Fora | `1.05` / `0.95` | `predictionEngine.js:274-276` | ±5% Mando de campo |
| **Faltas** | Multiplicadores Escala | `1.28`, `1.18`, `1.10` | `predictionEngine.js:343` | Escalonamento por volume |
| **BTTS** | Parâmetros Logísticos | `1.3` (slope), `2.8` (mid) | `predictionEngine.js:296` | Correlação de total de gols |
| **BTTS** | Faixa de Desconto | `0.62` a `0.98` | `predictionEngine.js:297` | Fator de desconto de BTTS |
| **Liga** | Média Global Gols | `2.69` | `leagueAdjustment.js:15` | Referência para `fatorLiga` |
| **Liga** | Média Global Corners | `9.67` | `leagueAdjustment.js:16` | Referência para `fatorLiga` |
| **Liga** | Média Global Cartões | `2.94` | `leagueAdjustment.js:17` | Referência para `fatorLiga` |
| **Liga** | Peso da Liga (Blend) | `0.30` (30%) | `leagueAdjustment.js:22` | Blend 30% Liga / 70% Modelo |
| **Liga** | Limits de `fatorLiga` | `[0.80, 1.20]` | `leagueAdjustment.js:47` | Trava de segurança de fator |
| **Ranking** | Penalização por Distância | `0.12` | `BestBetsByMarket.jsx:44` | Ajuste de seleção de linha |

---
Nenhum código foi modificado durante esta auditoria.
