# RELATÓRIO TÉCNICO DE AUDITORIA — FASE 1.3
## WEIGHT ANALYSIS — SPORTS PREDICTION SYSTEM

Nenhum arquivo foi modificado. Esta auditoria localizou e catalogou **todos os pesos, coeficientes, multiplicadores e fatores de ponderação** existentes no motor de previsão do sistema.

---

### 1. DETALHAMENTO DE CADA PESO ENCONTRADO

#### A. Mercado de Escanteios (Corners)
- **Fatores Ofensivos (`calcCorners`):**
  - `shots_on_target`: **0.27 (27%)** — *Impacto:* Peso de maior relevância ofensiva para geração de escanteios.
  - `shots_in_box`: **0.22 (22%)** — *Impacto:* Mede a presença e volume de chutes de dentro da grande área.
  - `big_chance_missed`: **0.13 (13%)** — *Impacto:* Mede o volume de chances claras não convertidas.
  - `crosses`: **0.13 (13%)** — *Impacto:* Mede bolas alçadas à área com potencial de corte.
  - `touches_opp_box`: **0.13 (13%)** — *Impacto:* Mede a ocupação da área adversária.
  - `total_shots`: **0.10 (10%)** — *Impacto:* Volume bruto de finalizações.
  - `possession`: **0.08 (8%)** — *Impacto:* Controle territorial e posse de bola.
  - *Localização:* [`src/lib/predictionEngine.js:175-183`](file:///c:/appo/src/lib/predictionEngine.js#L175-L183) | *Quem Utiliza:* `calcCorners()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Fatores Defensivos (`calcCorners`):**
  - `gk_saves`: **0.50 (50%)** — *Impacto:* Peso primário defensivo (defesas do goleiro espalmando para escanteio).
  - `clearances`: **0.25 (25%)** — *Impacto:* Cortes da zaga que geram escanteios.
  - `shots_ced`: **0.25 (25%)** — *Impacto:* Volume de chutes concedidos à equipe adversária.
  - *Localização:* [`src/lib/predictionEngine.js:185-189`](file:///c:/appo/src/lib/predictionEngine.js#L185-L189) | *Quem Utiliza:* `calcCorners()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Composição Ofensivo vs Defensivo (`calcCorners`):**
  - `Ofensivo (io)`: **0.60 (60%)** | `Defensivo (id)`: **0.40 (40%)**
  - *Localização:* [`src/lib/predictionEngine.js:193`](file:///c:/appo/src/lib/predictionEngine.js#L193) | *Quem Utiliza:* `calcCorners()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Mando de Campo (`calcCorners`):**
  - Mandante (`isHome`): **1.18 (+18%)** | Visitante: **1.00 (0%)**
  - *Localização:* [`src/lib/predictionEngine.js:196`](file:///c:/appo/src/lib/predictionEngine.js#L196) | *Quem Utiliza:* `calcCorners()` | *Configurável/Hardcoded:* **Hardcoded**.

---

#### B. Mercado de Gols (Expected Goals - xG)
- **Fatores Ofensivos (`calcGols`):**
  - `xg`: **0.22 (22%)** — *Impacto:* Média bruta de xG histórico do time.
  - `big_chance_scored`: **0.20 (20%)** — *Impacto:* Eficiência de conversão de grandes chances.
  - `shots_on_target`: **0.20 (20%)** — *Impacto:* Pontaria e finalizações no alvo.
  - `shots_in_box`: **0.13 (13%)** — *Impacto:* Finalizações na área perigosa.
  - `touches_opp_box`: **0.13 (13%)** — *Impacto:* Pressão na área adversária.
  - `big_chance_created`: **0.12 (12%)** — *Impacto:* Capacidade de criação de chances claras.
  - *Localização:* [`src/lib/predictionEngine.js:220-227`](file:///c:/appo/src/lib/predictionEngine.js#L220-L227) | *Quem Utiliza:* `calcGols()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Fatores Defensivos (`calcGols`):**
  - `gk_saves`: **0.42 (42%)** — *Impacto:* Capacidade de defesa do goleiro adversário.
  - `shots_ced`: **0.26 (26%)** — *Impacto:* Chutes no gol concedidos pela zaga.
  - `clearances`: **0.16 (16%)** — *Impacto:* Eficiência em afastar o perigo.
  - `errors`: **0.16 (16%)** — *Impacto:* Falhas defensivas que resultam em gols.
  - *Localização:* [`src/lib/predictionEngine.js:229-234`](file:///c:/appo/src/lib/predictionEngine.js#L229-L234) | *Quem Utiliza:* `calcGols()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Composição Ofensivo vs Defensivo (`calcGols`):**
  - `Ofensivo (io)`: **0.55 (55%)** | `Defensivo (id)`: **0.45 (45%)**
  - *Localização:* [`src/lib/predictionEngine.js:238`](file:///c:/appo/src/lib/predictionEngine.js#L238) | *Quem Utiliza:* `calcGols()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Mando de Campo (`calcGols`):**
  - Mandante (`isHome`): **1.08 (+8%)** | Visitante: **0.92 (-8%)**
  - *Localização:* [`src/lib/predictionEngine.js:240-244`](file:///c:/appo/src/lib/predictionEngine.js#L240-L244) | *Quem Utiliza:* `calcGols()` | *Configurável/Hardcoded:* **Hardcoded**.

---

#### C. Mercado de Chutes no Gol (Shots On Target)
- **Fatores Ofensivos (`calcShotsOnTarget`):**
  - `shots_in_box`: **0.36 (36%)** — *Impacto:* Principal preditor de chute no alvo.
  - `big_chance_created`: **0.23 (23%)** — *Impacto:* Criação de perigo claro.
  - `total_shots`: **0.18 (18%)** — *Impacto:* Volume geral de arremates.
  - `touches_opp_box`: **0.13 (13%)** — *Impacto:* Ocupação da área.
  - `possession`: **0.10 (10%)** — *Impacto:* Domínio de jogo.
  - *Localização:* [`src/lib/predictionEngine.js:256-262`](file:///c:/appo/src/lib/predictionEngine.js#L256-L262) | *Quem Utiliza:* `calcShotsOnTarget()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Fatores Defensivos (`calcShotsOnTarget`):**
  - `gk_saves`: **0.60 (60%)** | `clearances`: **0.40 (40%)**
  - *Localização:* [`src/lib/predictionEngine.js:264-267`](file:///c:/appo/src/lib/predictionEngine.js#L264-L267) | *Quem Utiliza:* `calcShotsOnTarget()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Composição Ofensivo vs Defensivo (`calcShotsOnTarget`):**
  - `Ofensivo (io)`: **0.60 (60%)** | `Defensivo (id)`: **0.40 (40%)**
  - *Localização:* [`src/lib/predictionEngine.js:271`](file:///c:/appo/src/lib/predictionEngine.js#L271) | *Quem Utiliza:* `calcShotsOnTarget()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Mando de Campo (`calcShotsOnTarget`):**
  - Mandante (`isHome`): **1.05 (+5%)** | Visitante: **0.95 (-5%)**
  - *Localização:* [`src/lib/predictionEngine.js:273-277`](file:///c:/appo/src/lib/predictionEngine.js#L273-L277) | *Quem Utiliza:* `calcShotsOnTarget()` | *Configurável/Hardcoded:* **Hardcoded**.

---

#### D. Mercado de Cartões (Cards)
- **Ponderação da Base Inicial (`calcCartoes`):**
  - Média da Média (`baseMedia`): **0.90 (90%)** | Média do Máximo (`baseMax`): **0.10 (10%)**
  - *Localização:* [`src/lib/predictionEngine.js:316`](file:///c:/appo/src/lib/predictionEngine.js#L316) | *Quem Utiliza:* `calcCartoes()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Fatores Ponderados (`calcCartoes`):**
  - `fouls`: **0.25 (25%)** — *Impacto:* Faltas cometidas/sofridas.
  - `tackles`: **0.20 (20%)** — *Impacto:* Desarmes e disputas físicas.
  - `interceptions`: **0.16 (16%)** — *Impacto:* Interrupção de jogadas.
  - `dispossessed`: **0.15 (15%)** — *Impacto:* Perda de bola sob pressão.
  - `free_kicks_ced`: **0.12 (12%)** — *Impacto:* Faltas perigosas cedidas.
  - `yellow_hist`: **0.07 (7%)** — *Impacto:* Histórico direto de cartões amarelos.
  - `offsides`: **0.05 (5%)** — *Impacto:* Paralisações e indisciplina tática.
  - *Localização:* [`src/lib/predictionEngine.js:318-326`](file:///c:/appo/src/lib/predictionEngine.js#L318-L326) | *Quem Utiliza:* `calcCartoes()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Mando de Campo (`calcCartoes`):**
  - Mandante (`isHome`): **0.92 (-8%)** | Visitante: **1.00 (0%)**
  - *Localização:* [`src/lib/predictionEngine.js:330-332`](file:///c:/appo/src/lib/predictionEngine.js#L330-L332) | *Quem Utiliza:* `calcCartoes()` | *Configurável/Hardcoded:* **Hardcoded**.

---

#### E. Mercado de Faltas (Fouls)
- **Escalonamento por Faixa de Volume (`calcFaltas`):**
  - Faixa $< 18$ faltas: **1.28 (+28%)** | Faixa $18 - 22$ faltas: **1.18 (+18%)** | Faixa $\ge 22$ faltas: **1.10 (+10%)**
  - *Localização:* [`src/lib/predictionEngine.js:343`](file:///c:/appo/src/lib/predictionEngine.js#L343) | *Quem Utiliza:* `calcFaltas()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Fatores Ponderados (`calcFaltas`):**
  - `fouls`: **0.30 (30%)** | `tackles`: **0.22 (22%)** | `interceptions`: **0.18 (18%)** | `dispossessed`: **0.15 (15%)** | `crosses`: **0.10 (10%)** | `offsides`: **0.05 (5%)**
  - *Localização:* [`src/lib/predictionEngine.js:345-352`](file:///c:/appo/src/lib/predictionEngine.js#L345-L352) | *Quem Utiliza:* `calcFaltas()` | *Configurável/Hardcoded:* **Hardcoded**.

---

#### F. Mercado de Defesas do Goleiro (Goalkeeper Saves)
- **Fatores Ponderados (`calcSaves`):**
  - `shots_on_target`: **0.35 (35%)** | `shots_in_box`: **0.22 (22%)** | `big_chance_created`: **0.18 (18%)** | `total_shots`: **0.13 (13%)** | `xg`: **0.12 (12%)**
  - *Localização:* [`src/lib/predictionEngine.js:365-371`](file:///c:/appo/src/lib/predictionEngine.js#L365-L371) | *Quem Utiliza:* `calcSaves()` | *Configurável/Hardcoded:* **Hardcoded**.

---

#### G. Mercado de Chutes Totais (Total Shots)
- **Fatores Ponderados (`calcTotalShots`):**
  - `shots_in_box`: **0.26 (26%)** | `touches_opp_box`: **0.26 (26%)** | `big_chance_created`: **0.22 (22%)** | `possession`: **0.13 (13%)** | `crosses`: **0.13 (13%)**
  - *Localização:* [`src/lib/predictionEngine.js:383-389`](file:///c:/appo/src/lib/predictionEngine.js#L383-L389) | *Quem Utiliza:* `calcTotalShots()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Mando de Campo (`calcTotalShots`):**
  - Mandante (`isHome`): **1.08 (+8%)** | Visitante: **0.92 (-8%)**
  - *Localização:* [`src/lib/predictionEngine.js:392-396`](file:///c:/appo/src/lib/predictionEngine.js#L392-L396) | *Quem Utiliza:* `calcTotalShots()` | *Configurável/Hardcoded:* **Hardcoded**.

---

#### H. Calibração de Ligas e Ajustes Globais
- **Peso do Histórico Real da Liga (`LEAGUE_WEIGHT`):**
  - Valor: **0.30 (30% Liga, 70% Modelo de Poisson)**
  - *Localização:* [`src/lib/leagueAdjustment.js:22`](file:///c:/appo/src/lib/leagueAdjustment.js#L22) | *Quem Utiliza:* `calibrarProb()`, `ajustarBTTS()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Coeficiente da Escala Logarítmica (`fatorLiga`):**
  - Coeficiente: **0.50** | Cap Máximo: **1.20 (+20%)** | Piso Mínimo: **0.80 (-20%)**
  - *Localização:* [`src/lib/leagueAdjustment.js:45-47`](file:///c:/appo/src/lib/leagueAdjustment.js#L45-L47) | *Quem Utiliza:* `fatorLiga()` | *Configurável/Hardcoded:* **Hardcoded**.
- **Médias Globais de Referência (`APP_GLOBALS`):**
  - `avg_goals`: **2.69** | `avg_corners`: **9.67** | `avg_cards`: **2.94**
  - *Localização:* [`src/lib/leagueAdjustment.js:14-18`](file:///c:/appo/src/lib/leagueAdjustment.js#L14-L18) | *Quem Utiliza:* `fatorLiga()` em `MatchResults.jsx` | *Configurável/Hardcoded:* **Hardcoded**.

---

#### I. Ranking de Seleção da Melhor Aposta (`bestLine`)
- **Fatores de Score do Algoritmo (`BestBetsByMarket.jsx`):**
  - Penalidade por Distância de Linha: **-0.12** por passo de desvio.
  - Bônus por Sinal "FORTE": **+0.35**
  - Bônus por Sinal Normal: **+0.18**
  - Bônus de Linha Favorável ($prob \ge 50\%$): **+0.05**
  - *Localização:* [`src/components/stats/BestBetsByMarket.jsx:44-46`](file:///c:/appo/src/components/stats/BestBetsByMarket.jsx#L44-L46) | *Quem Utiliza:* `bestLine()` | *Configurável/Hardcoded:* **Hardcoded**.

---

### 2. TABELA CONSOLIDADA COMPLETA DE TODOS OS PESOS ENCONTRADOS

| Mercado / Módulo | Variável / Fator | Peso / Valor | Onde Está (Arquivo & Linha) | Quem Utiliza | Impacto no Cálculo | Configurável? | Hardcoded? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Escanteios** | `shots_on_target` | **0.27 (27%)** | `predictionEngine.js:176` | `calcCorners()` | Pondera índice ofensivo | Não | Sim |
| **Escanteios** | `shots_in_box` | **0.22 (22%)** | `predictionEngine.js:177` | `calcCorners()` | Pondera índice ofensivo | Não | Sim |
| **Escanteios** | `big_chance_missed` | **0.13 (13%)** | `predictionEngine.js:178` | `calcCorners()` | Pondera índice ofensivo | Não | Sim |
| **Escanteios** | `crosses` | **0.13 (13%)** | `predictionEngine.js:179` | `calcCorners()` | Pondera índice ofensivo | Não | Sim |
| **Escanteios** | `touches_opp_box` | **0.13 (13%)** | `predictionEngine.js:180` | `calcCorners()` | Pondera índice ofensivo | Não | Sim |
| **Escanteios** | `total_shots` | **0.10 (10%)** | `predictionEngine.js:181` | `calcCorners()` | Pondera índice ofensivo | Não | Sim |
| **Escanteios** | `possession` | **0.08 (8%)** | `predictionEngine.js:182` | `calcCorners()` | Pondera índice ofensivo | Não | Sim |
| **Escanteios** | `gk_saves` (Def) | **0.50 (50%)** | `predictionEngine.js:186` | `calcCorners()` | Pondera índice defensivo | Não | Sim |
| **Escanteios** | `clearances` (Def) | **0.25 (25%)** | `predictionEngine.js:187` | `calcCorners()` | Pondera índice defensivo | Não | Sim |
| **Escanteios** | `shots_ced` (Def) | **0.25 (25%)** | `predictionEngine.js:188` | `calcCorners()` | Pondera índice defensivo | Não | Sim |
| **Escanteios** | Comp. Ofensivo / Defensivo | **0.60 / 0.40** | `predictionEngine.js:193` | `calcCorners()` | Ponderação Atq vs Def | Não | Sim |
| **Escanteios** | Mando de Campo Casa | **1.18 (+18%)** | `predictionEngine.js:196` | `calcCorners()` | Multiplica xCorners Casa | Não | Sim |
| **Gols** | `xg` | **0.22 (22%)** | `predictionEngine.js:221` | `calcGols()` | Pondera índice ofensivo | Não | Sim |
| **Gols** | `big_chance_scored` | **0.20 (20%)** | `predictionEngine.js:222` | `calcGols()` | Pondera índice ofensivo | Não | Sim |
| **Gols** | `shots_on_target` | **0.20 (20%)** | `predictionEngine.js:223` | `calcGols()` | Pondera índice ofensivo | Não | Sim |
| **Gols** | `shots_in_box` | **0.13 (13%)** | `predictionEngine.js:224` | `calcGols()` | Pondera índice ofensivo | Não | Sim |
| **Gols** | `touches_opp_box` | **0.13 (13%)** | `predictionEngine.js:225` | `calcGols()` | Pondera índice ofensivo | Não | Sim |
| **Gols** | `big_chance_created` | **0.12 (12%)** | `predictionEngine.js:226` | `calcGols()` | Pondera índice ofensivo | Não | Sim |
| **Gols** | `gk_saves` (Def) | **0.42 (42%)** | `predictionEngine.js:230` | `calcGols()` | Pondera índice defensivo | Não | Sim |
| **Gols** | `shots_ced` (Def) | **0.26 (26%)** | `predictionEngine.js:231` | `calcGols()` | Pondera índice defensivo | Não | Sim |
| **Gols** | `clearances` (Def) | **0.16 (16%)** | `predictionEngine.js:232` | `calcGols()` | Pondera índice defensivo | Não | Sim |
| **Gols** | `errors` (Def) | **0.16 (16%)** | `predictionEngine.js:233` | `calcGols()` | Pondera índice defensivo | Não | Sim |
| **Gols** | Comp. Ofensivo / Defensivo | **0.55 / 0.45** | `predictionEngine.js:238` | `calcGols()` | Ponderação Atq vs Def | Não | Sim |
| **Gols** | Mando Casa / Fora | **1.08 / 0.92** | `predictionEngine.js:241-243` | `calcGols()` | Ajuste de mando ±8% | Não | Sim |
| **Chutes no Gol**| `shots_in_box` | **0.36 (36%)** | `predictionEngine.js:257` | `calcShotsOnTarget()` | Pondera índice ofensivo | Não | Sim |
| **Chutes no Gol**| `big_chance_created` | **0.23 (23%)** | `predictionEngine.js:258` | `calcShotsOnTarget()` | Pondera índice ofensivo | Não | Sim |
| **Chutes no Gol**| `total_shots` | **0.18 (18%)** | `predictionEngine.js:259` | `calcShotsOnTarget()` | Pondera índice ofensivo | Não | Sim |
| **Chutes no Gol**| `touches_opp_box` | **0.13 (13%)** | `predictionEngine.js:260` | `calcShotsOnTarget()` | Pondera índice ofensivo | Não | Sim |
| **Chutes no Gol**| `possession` | **0.10 (10%)** | `predictionEngine.js:261` | `calcShotsOnTarget()` | Pondera índice ofensivo | Não | Sim |
| **Chutes no Gol**| `gk_saves` (Def) | **0.60 (60%)** | `predictionEngine.js:265` | `calcShotsOnTarget()` | Pondera índice defensivo | Não | Sim |
| **Chutes no Gol**| `clearances` (Def) | **0.40 (40%)** | `predictionEngine.js:266` | `calcShotsOnTarget()` | Pondera índice defensivo | Não | Sim |
| **Chutes no Gol**| Comp. Ofensivo / Defensivo | **0.60 / 0.40** | `predictionEngine.js:271` | `calcShotsOnTarget()` | Ponderação Atq vs Def | Não | Sim |
| **Chutes no Gol**| Mando Casa / Fora | **1.05 / 0.95** | `predictionEngine.js:274-276` | `calcShotsOnTarget()` | Ajuste de mando ±5% | Não | Sim |
| **Cartões** | Composição da Base Inicial | **0.90 / 0.10** | `predictionEngine.js:316` | `calcCartoes()` | 90% Média / 10% Máximo | Não | Sim |
| **Cartões** | `fouls` | **0.25 (25%)** | `predictionEngine.js:319` | `calcCartoes()` | Pondera índice composto | Não | Sim |
| **Cartões** | `tackles` | **0.20 (20%)** | `predictionEngine.js:320` | `calcCartoes()` | Pondera índice composto | Não | Sim |
| **Cartões** | `interceptions` | **0.16 (16%)** | `predictionEngine.js:321` | `calcCartoes()` | Pondera índice composto | Não | Sim |
| **Cartões** | `dispossessed` | **0.15 (15%)** | `predictionEngine.js:322` | `calcCartoes()` | Pondera índice composto | Não | Sim |
| **Cartões** | `free_kicks_ced` | **0.12 (12%)** | `predictionEngine.js:323` | `calcCartoes()` | Pondera índice composto | Não | Sim |
| **Cartões** | `yellow_hist` | **0.07 (7%)** | `predictionEngine.js:324` | `calcCartoes()` | Pondera índice composto | Não | Sim |
| **Cartões** | `offsides` | **0.05 (5%)** | `predictionEngine.js:325` | `calcCartoes()` | Pondera índice composto | Não | Sim |
| **Cartões** | Mando Casa | **0.92 (-8%)** | `predictionEngine.js:331` | `calcCartoes()` | Redução de cartões casa | Não | Sim |
| **Faltas** | Escala Faixa $< 18$ | **1.28 (+28%)** | `predictionEngine.js:343` | `calcFaltas()` | Multiplicador de volume | Não | Sim |
| **Faltas** | Escala Faixa $18-22$ | **1.18 (+18%)** | `predictionEngine.js:343` | `calcFaltas()` | Multiplicador de volume | Não | Sim |
| **Faltas** | Escala Faixa $\ge 22$ | **1.10 (+10%)** | `predictionEngine.js:343` | `calcFaltas()` | Multiplicador de volume | Não | Sim |
| **Faltas** | `fouls` | **0.30 (30%)** | `predictionEngine.js:346` | `calcFaltas()` | Pondera índice composto | Não | Sim |
| **Faltas** | `tackles` | **0.22 (22%)** | `predictionEngine.js:347` | `calcFaltas()` | Pondera índice composto | Não | Sim |
| **Faltas** | `interceptions` | **0.18 (18%)** | `predictionEngine.js:348` | `calcFaltas()` | Pondera índice composto | Não | Sim |
| **Faltas** | `dispossessed` | **0.15 (15%)** | `predictionEngine.js:349` | `calcFaltas()` | Pondera índice composto | Não | Sim |
| **Faltas** | `crosses` | **0.10 (10%)** | `predictionEngine.js:350` | `calcFaltas()` | Pondera índice composto | Não | Sim |
| **Faltas** | `offsides` | **0.05 (5%)** | `predictionEngine.js:351` | `calcFaltas()` | Pondera índice composto | Não | Sim |
| **Defesas** | `shots_on_target` | **0.35 (35%)** | `predictionEngine.js:366` | `calcSaves()` | Pondera índice composto | Não | Sim |
| **Defesas** | `shots_in_box` | **0.22 (22%)** | `predictionEngine.js:367` | `calcSaves()` | Pondera índice composto | Não | Sim |
| **Defesas** | `big_chance_created` | **0.18 (18%)** | `predictionEngine.js:368` | `calcSaves()` | Pondera índice composto | Não | Sim |
| **Defesas** | `total_shots` | **0.13 (13%)** | `predictionEngine.js:369` | `calcSaves()` | Pondera índice composto | Não | Sim |
| **Defesas** | `xg` | **0.12 (12%)** | `predictionEngine.js:370` | `calcSaves()` | Pondera índice composto | Não | Sim |
| **Chutes Totais**| `shots_in_box` | **0.26 (26%)** | `predictionEngine.js:384` | `calcTotalShots()` | Pondera índice composto | Não | Sim |
| **Chutes Totais**| `touches_opp_box` | **0.26 (26%)** | `predictionEngine.js:385` | `calcTotalShots()` | Pondera índice composto | Não | Sim |
| **Chutes Totais**| `big_chance_created` | **0.22 (22%)** | `predictionEngine.js:386` | `calcTotalShots()` | Pondera índice composto | Não | Sim |
| **Chutes Totais**| `possession` | **0.13 (13%)** | `predictionEngine.js:387` | `calcTotalShots()` | Pondera índice composto | Não | Sim |
| **Chutes Totais**| `crosses` | **0.13 (13%)** | `predictionEngine.js:388` | `calcTotalShots()` | Pondera índice composto | Não | Sim |
| **Chutes Totais**| Mando Casa / Fora | **1.08 / 0.92** | `predictionEngine.js:393-395` | `calcTotalShots()` | Ajuste de mando ±8% | Não | Sim |
| **Calibração** | `LEAGUE_WEIGHT` | **0.30 (30%)** | `leagueAdjustment.js:22` | `calibrarProb()`, `ajustarBTTS()` | Peso da liga no blend | Não | Sim |
| **Calibração** | Escalar Logarítmico Liga | **0.50** | `leagueAdjustment.js:46` | `fatorLiga()` | Suavizador de ratio | Não | Sim |
| **Calibração** | Cap / Piso `fatorLiga` | **1.20 / 0.80** | `leagueAdjustment.js:47` | `fatorLiga()` | Limite de ajuste de liga | Não | Sim |
| **Globals** | `avg_goals` | **2.69** | `leagueAdjustment.js:15` | `fatorLiga()` | Denominador de Gols | Não | Sim |
| **Globals** | `avg_corners` | **9.67** | `leagueAdjustment.js:16` | `fatorLiga()` | Denominador de Escanteios | Não | Sim |
| **Globals** | `avg_cards` | **2.94** | `leagueAdjustment.js:17` | `fatorLiga()` | Denominador de Cartões | Não | Sim |
| **Ranking** | Penalização por Distância | **-0.12** | `BestBetsByMarket.jsx:44` | `bestLine()` | Penaliza linha distante | Não | Sim |
| **Ranking** | Bônus Sinal "FORTE" | **+0.35** | `BestBetsByMarket.jsx:45` | `bestLine()` | Bônus de sinal forte | Não | Sim |
| **Ranking** | Bônus Sinal Normal | **+0.18** | `BestBetsByMarket.jsx:45` | `bestLine()` | Bônus de sinal normal | Não | Sim |
| **Ranking** | Bônus Linha Favorável | **+0.05** | `BestBetsByMarket.jsx:46` | `bestLine()` | Bônus se $prob \ge 50\%$ | Não | Sim |

---
Nenhum arquivo do código-fonte foi alterado nesta auditoria.
