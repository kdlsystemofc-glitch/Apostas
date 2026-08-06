# DOCUMENTO MESTRE DE ARQUITETURA, MOTORES E INTERFACE DE USUÁRIO
## ULTIMATE AGENT & SYSTEM HANDOVER GUIDE FOR SPORTS PREDICTOR AI

> **Finalidade do Documento:** Este guia descreve exaustivamente **cada linha de lógica**, **cada fórmula matemática**, **cada peso estatístico**, **cada componente visual**, **cada tela de navegação** e **o pipeline de calibração** do sistema **Sports Predictor**. Ele foi estruturado para que qualquer Agente de Inteligência Artificial assuma o projeto com 100% de clareza sem necessidade de inferências.

---

## 1. ARQUITETURA GERAL E FLUXO DE DADOS

O **Sports Predictor** é uma plataforma web de análise preditiva de mercados esportivos. Ela processa dados brutos colados do **StatsHub** ou **Excel**, converte-os em estatísticas ponderadas, calcula a expectativa matemática de cada mercado ($\lambda$), aplica a Distribuição de Poisson CDF e o Modelo Bivariado de Dixon-Coles, filtra apenas **Linhas Comerciais Reais da Bet365/Pinnacle**, calcula a **Odd Mínima Justa (EV+)** e projeta os resultados na interface.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TELA 1: NOVA ANÁLISE (Home.jsx -> StatsInput.jsx)                            │
│ 1. Usuário insere Nome Mandante, Nome Visitante e Data do Jogo.             │
│ 2. Cole do texto bruto do StatsHub nas duas caixas de texto.                │
│ 3. Execução do Parser: parseStatsHubText(text)                              │
│    └─ Extract: { goals, corners, cards, yellow_cards, red_cards, crosses,    │
│                 xg, shots_on_target, shots_in_box, total_shots, clearances, │
│                 gk_saves, fouls, tackles, possession, touches_opp_box, etc. }│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENGINE ESTATÍSTICO AUTÔNOMO (predictionEngine.js)                            │
│ 1. Âncora Balanceada: ancora(faz, cede) = (faz + cede) / 2                  │
│ 2. Índices Relativos: indice(feito, cedido) = feito / ((feito + cedido)/2)  │
│ 3. Resistência Defensiva: resistencia(cedidoDef, feitoAtk)                  │
│ 4. Re-normalização Dinâmica de Pesos Faltantes: pesosDinamicos()             │
│ 5. Projeção de Lambdas (Gols, Escanteios, Cartões, Faltas, Chutes, Defesas) │
│ 6. Matriz 8x8 Dixon-Coles (tau): P(X=i, Y=j) * tau(i,j)                    │
│    └─ Saída 1X2 Estrita: Pick (Vitória Casa, Empate, Vitória Fora) + Odd Min│
│ 7. Filtro de Linhas Comerciais: COMMERCIAL_LINES (Gols 1.5-4.5, Cantos 7.5+) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TELA 2: VISUALIZAÇÃO DE RESULTADOS & DASHBOARD                              │
│ • MatchResultBlock.jsx -> Box "PICK PRINCIPAL DO MODELO" (Confiança % + Odd)│
│ • MarketBlock.jsx      -> Highlight da Linha Base + Tabela de Odds EV+      │
│ • BestBetsByMarket.jsx -> Ranking Ordenado por Força de Sinal               │
│ • CornerDetails.jsx    -> Detalhamento de Fatores Ofensivos e Defensivos    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PERSISTÊNCIA & CALIBRAÇÃO                                                   │
│ • base44Client.js -> Supabase PostgreSQL (Tabela `matches`)                 │
│ • MatchDetail.jsx -> Registro de Resultados Reais Pós-Jogo                  │
│ • CalibrationView.jsx -> Cálculo de Viés, MAE e WinRate por Blocos de 10    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MAPEAMENTO COMPLETO DAS TELAS E COMPONENTES VISUAIS

A interface é dividida em 5 abas principais na `Home.jsx` mais telas secundárias acessíveis por rotas do `react-router-dom`:

### 2.1 Aba "Nova Análise" (`StatsInput.jsx`)
- **Objetivo:** Permite ao usuário colar as estatísticas dos dois times.
- **Campos de Entrada:**
  - `homeTeam` (Input texto)
  - `awayTeam` (Input texto)
  - `matchDate` (Input date)
  - `homeText` (Textarea para colagem de StatsHub do Mandante)
  - `awayText` (Textarea para colagem de StatsHub do Visitante)
- **Indicador de Qualidade:** Conta automaticamente as linhas reconhecidas pelo parser (`homeStatsCount`). Se $< 5$, exibe um alerta de aviso em vermelho indicando formato não reconhecido.
- **Ação do Botão "Analisar Jogo":** Invoca `analisarJogo(homeStats, awayStats)`, cria o registro na tabela `matches` do Supabase e redireciona o usuário para a aba de "Resultado".

---

### 2.2 Aba "Resultado" (`MatchResults.jsx`, `MatchResultBlock.jsx`, `MarketBlock.jsx`, `BestBetsByMarket.jsx`, `CornerDetails.jsx`)
Exibe os dados calculados divididos em seções visuais de alta hierarquia:

#### A. `MatchResultBlock.jsx` (Resultado 1X2 & Placares)
- **Box "Pick Principal do Modelo":** Box em destaque verde escuro no topo que **assume a posição** do modelo declarando estritamente **Vitória Mandante**, **Empate** ou **Vitória Visitante**. Exibe a porcentagem exata de confiança e a **Odd Mínima Justa (EV+)** ($1 / P$).
- **Barra Truncada Tripla:** Barra gráfica visual com 3 divisões de cor (Verde para Mandante, Amarelo para Empate, Vermelho para Visitante).
- **Grade Top 5 Placares:** Exibe os 5 placares exatos mais prováveis com suas respectivas probabilidades.

#### B. `MarketBlock.jsx` (Cards Individuais por Mercado)
- Cada mercado (Gols, Escanteios, Cartões, Chutes no Gol, Chutes Totais, Faltas, Defesas do Goleiro) possui seu próprio card contendo:
  1. **Header do Card:** Ícone, Nome do Mercado e Badge da Linha Base Recomendada.
  2. **Trinca de Valores Esperados:** Exibe o $xHome$, $xAway$ e $xTotal$ em caixas de destaque.
  3. **Banner de Highlight:** Caixa escura destacando a **Linha Principal Comercial Recomendada**, Porcentagem e Odd Mínima.
  4. **Tabela de Linhas Comerciais:** Exibe todas as linhas do dicionário `COMMERCIAL_LINES` com o percentual Over e a **Odd Mínima (EV+)** necessária para apostar em cada linha.

#### C. `BestBetsByMarket.jsx` (Ranking das Melhores Oportunidades)
- Ordena todos os mercados disponíveis pelo desvio $|P - 0.50|$ (Força do Sinal).
- Coloca a Pick 1X2 em destaque no topo e lista os mercados com sinais `FORTE OVER`, `OVER`, `FORTE UNDER`, `UNDER` e `NEUTRO`.

#### D. `CornerDetails.jsx` (Detalhamento Técnico de Cantos)
- Exibe a tabela de decomposição de escanteios mostrando a Âncora Base, Índice Ofensivo, Índice Defensivo e o desdobramento individual dos 6 sub-fatores ofensivos e 3 sub-fatores defensivos com seus respectivos pesos e valores.

---

### 2.3 Aba "Apostas do Dia" (`DailyOverview.jsx`)
- Lista os jogos salvos no banco agrupados por data.
- Exibe em cada card de jogo uma grade com a **Pick 1X2**, o **BTTS** e as **Linhas Comerciais com Odd Mínima Justa**.
- Destaca a **"Aposta de Maior Valor"** da partida no rodapé do card.

---

### 2.4 Aba "Calibração" (`CalibrationView.jsx`)
- Agrupa todas as partidas que possuem resultados reais preenchidos em **blocos de 10 jogos**.
- Calcula para cada mercado:
  - **Médias Previstas vs Médias Reais**
  - **Viés ($\bar{P} - \bar{R}$)**: Positivo = modelo superestima; Negativo = modelo subestima.
  - **MAE (Erro Absoluto Médio)**: Média do desvio absoluto em unidades reais.
  - **WinRate %**: Porcentagem de acertos das linhas recomendadas.
  - **Avaliação**: `✓ Calibrado` ($|\text{Viés}| < 0.30$), `⚠ Leve Viés` ($0.30 \le |\text{Viés}| < 0.70$) ou `✗ Revisar Pesos` ($|\text{Viés}| \ge 0.70$).

---

### 2.5 Tela de Detalhes da Partida & Preenchimento Pós-Jogo (`MatchDetail.jsx`)
- Acessada via rota `/match/:id`.
- Permite ao usuário clicar em **"Editar Resultados Reais"** para inserir os dados oficiais ocorridos no jogo (gols, escanteios, cartões, faltas, chutes, defesas).
- Calcula o BTTS automaticamente a partir dos gols salvos e atualiza a partida para `status: "completed"`.

---

## 3. AS FÓRMULAS MATEMÁTICAS E TODOS OS PARÂMETROS DE APOSTA

O arquivo [`predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js) é a biblioteca matemática central.

### 3.1 Funções Primitivas e Auxiliares

1. **Getter de Estatísticas `g(stats, key, campo = "t")`:**
   Mapeia com segurança a chave da estatística e o campo (`t` para feito, `c` para cedido). Se não existir, retorna `0.0`.

2. **Índice de Intensidade `indice(feito, cedido)`:**
   $$\text{Ref} = \frac{\text{feito} + \text{cedido}}{2} \implies I = \begin{cases} \frac{\text{feito}}{\text{Ref}}, & \text{se Ref} > 0 \\ 1.0, & \text{caso contrário} \end{cases}$$

3. **Resistência Defensiva Logarítmica `resistencia(cedidoDef, feitoAtk, cap = 2.0)`:**
   $$R = \begin{cases} 1.0, & \text{se feitoAtk} \le 0 \\ \min\left(\frac{\ln(1 + \text{cedidoDef})}{\ln(1 + \text{feitoAtk})}, 2.0\right), & \text{caso contrário} \end{cases}$$

4. **Âncora Equilibrada `ancora(timeFaz, advCede)`:**
   $$A = \frac{\text{timeFaz} + \text{advCede}}{2}$$

5. **Ponderação Dinâmica de Pesos `pesosDinamicos(componentes)`:**
   Filtra apenas estatísticas com valor $> 0$. Calcula a soma dos pesos válidos $S = \sum w_i$ e re-normaliza cada peso $w'_i = \frac{w_i}{S}$. Retorna $\sum w'_i \cdot v_i$.

6. **Poisson Over CDF `poissonOver(media, linha)`:**
   Calcula a probabilidade de ocorrer **estritamente mais que** a `linha`:
   $$k = \lfloor \text{linha} \rfloor \implies P(\text{Under } k) = \sum_{i=0}^k \frac{e^{-\lambda} \lambda^i}{i!} \implies P(\text{Over } \text{linha}) = 1 - P(\text{Under } k)$$

---

### 3.2 Tabelas Exatas de Pesos e Parâmetros por Mercado

#### Mercado 1: Escanteios (`calcCorners`)
- **Âncora Base:** `ancora(atk.corners.t, def.corners.c)`
- **Fatores Ofensivos (Peso Total no Blend: 60%):**
  - `shots_on_target`: **0.25** ($\text{indice}$)
  - `shots_in_box`: **0.25** ($\text{indice}$)
  - `crosses`: **0.20** ($\text{indice}$)
  - `touches_opp_box`: **0.15** ($\text{indice}$)
  - `big_chance_missed`: **0.10** ($\text{indice}$)
  - `total_shots`: **0.05** ($\text{indice}$)
- **Fatores Defensivos (Peso Total no Blend: 40%):**
  - `clearances`: **0.40** ($\text{resistencia}$)
  - `shots_ced`: **0.35** ($\text{resistencia}$)
  - `gk_saves`: **0.25** ($\text{resistencia}$)
- **Multiplicador de Mando:** $+12\%$ para o mandante ($1.12$).

#### Mercado 2: Gols (`calcGols`)
- **Âncora Base:** `ancora(atk.goals.t, def.goals.c)`
- **Fatores Ofensivos (Peso Total no Blend: 55%):**
  - `xg`: **0.25** ($\text{indice}$)
  - `shots_on_target`: **0.25** ($\text{indice}$)
  - `big_chance_scored`: **0.20** ($\text{indice}$)
  - `shots_in_box`: **0.15** ($\text{indice}$)
  - `touches_opp_box`: **0.15** ($\text{indice}$)
- **Fatores Defensivos (Peso Total no Blend: 45%):**
  - `shots_ced`: **0.45** ($\text{resistencia}$)
  - `clearances`: **0.25** ($\text{resistencia}$)
  - `errors_goal`: **0.20** ($\text{indice}$)
  - `gk_saves`: **0.10** ($\text{resistencia}$)
- **Multiplicador de Mando:** $+6\%$ para mandante ($1.06$), $-6\%$ para visitante ($0.94$).

#### Mercado 3: Chutes no Gol (`calcShotsOnTarget`)
- **Âncora Base:** `ancora(atk.shots_on_target.t, def.shots_on_target.c)`
- **Fatores Ofensivos (Peso Total no Blend: 60%):**
  - `shots_in_box`: **0.40** ($\text{indice}$)
  - `big_chance_created`: **0.25** ($\text{indice}$)
  - `total_shots`: **0.20** ($\text{indice}$)
  - `touches_opp_box`: **0.15** ($\text{indice}$)
- **Fatores Defensivos (Peso Total no Blend: 40%):**
  - `shots_ced`: **0.60** ($\text{resistencia}$)
  - `clearances`: **0.40** ($\text{resistencia}$)
- **Multiplicador de Mando:** $+4\%$ para mandante ($1.04$), $-4\%$ para visitante ($0.96$).

#### Mercado 4: Ambas Marcam / BTTS (`calcBTTS`)
- **Fórmula Autônoma de Probabilidade Conjunta:**
  $$P(\text{Casa Marca}) = 1 - e^{-xG_{\text{casa}}}$$
  $$P(\text{Fora Marca}) = 1 - e^{-xG_{\text{fora}}}$$
  $$P(\text{BTTS}) = P(\text{Casa Marca}) \cdot P(\text{Fora Marca})$$

#### Mercado 5: Cartões (`calcCartoes`)
- **Composição da Base:** $80\%$ Média da Âncora $+ 20\%$ Máximo da Amostra.
- **Fatores (100%):**
  - `yellow_hist` (histórico real de amarelos do próprio time): **0.35** ($\text{indice}$)
  - `fouls` (faltas cometidas): **0.30** ($\text{indice}$)
  - `tackles` (desarmes): **0.20** ($\text{indice}$)
  - `interceptions` (interceptações): **0.15** ($\text{indice}$)
- **Multiplicador de Mando:** $-5\%$ para mandante ($0.95$).

#### Mercado 6: Faltas (`calcFaltas`)
- **Base com Escala Volumétrica:**
  $$\text{baseRaw} = \text{ancora}(\text{atk.fouls.t}, \text{def.fouls.c})$$
  $$\text{mult} = \begin{cases} 1.20, & \text{se baseRaw} < 18 \\ 1.12, & \text{se } 18 \le \text{baseRaw} < 22 \\ 1.05, & \text{se baseRaw} \ge 22 \end{cases} \implies \text{base} = \text{baseRaw} \cdot \text{mult}$$
- **Fatores (100%):**
  - `fouls`: **0.40** ($\text{indice}$)
  - `tackles`: **0.30** ($\text{indice}$)
  - `interceptions`: **0.20** ($\text{indice}$)
  - `dispossessed`: **0.10** ($\text{indice}$)

#### Mercado 7: Defesas do Goleiro (`calcSaves`)
- **Base:** `ancora(def.gk_saves.t, atk.shots_on_target.t)`
- **Fatores (100%):**
  - `shots_on_target`: **0.45** ($\text{indice}$)
  - `shots_in_box`: **0.25** ($\text{indice}$)
  - `big_chance_created`: **0.15** ($\text{indice}$)
  - `total_shots`: **0.15** ($\text{indice}$)

#### Mercado 8: Chutes Totais (`calcTotalShots`)
- **Base:** `ancora(atk.total_shots.t, def.total_shots.c)`
- **Fatores (100%):**
  - `total_shots`: **0.40** ($\text{indice}$)
  - `shots_in_box`: **0.25** ($\text{indice}$)
  - `touches_opp_box`: **0.20** ($\text{indice}$)
  - `big_chance_created`: **0.15** ($\text{indice}$)
- **Multiplicador de Mando:** $+5\%$ para mandante ($1.05$), $-5\%$ para visitante ($0.95$).

---

### 3.3 O Modelo 1X2 Dixon-Coles (`calcResultado`)

Gera uma Matriz de Probabilidades $8 \times 8$ ($0$ a $8$ gols para cada lado). Para cada placar $(i, j)$:

1. **Calcula PMF de Poisson:**
   $$P_{\text{pois}}(i, \lambda_1) = \frac{e^{-\lambda_1} \lambda_1^i}{i!}, \quad P_{\text{pois}}(j, \lambda_2) = \frac{e^{-\lambda_2} \lambda_2^j}{j!}$$

2. **Aplica Fator de Ajuste Dixon-Coles $\tau(i, j)$ com $\rho = -0.13$:**
   $$\tau(i, j) = \max\left(0, \begin{cases} 1 - (\lambda_1 \lambda_2 \rho), & i=0, j=0 \\ 1 + (\lambda_1 \rho), & i=1, j=0 \\ 1 + (\lambda_2 \rho), & i=0, j=1 \\ 1 - \rho, & i=1, j=1 \\ 1.0, & \text{outro} \end{cases}\right)$$

3. **Probabilidade do Placar:** $P(i, j) = P_{\text{pois}}(i, \lambda_1) \cdot P_{\text{pois}}(j, \lambda_2) \cdot \tau(i, j)$
4. **Somatório e Normalização:** $P_{\text{casa}} = \sum_{i>j} P(i, j)$, $P_{\text{empate}} = \sum_{i=j} P(i, j)$, $P_{\text{fora}} = \sum_{i<j} P(i, j)$.
5. **Decisão Estrita (Pick 1X2):**
   - Se $P_{\text{empate}} > P_{\text{casa}}$ e $P_{\text{empate}} > P_{\text{fora}} \implies$ **Pick: Empate**
   - Senão, se $P_{\text{fora}} > P_{\text{casa}}$ e $P_{\text{fora}} > P_{\text{empate}} \implies$ **Pick: Vitória Visitante**
   - Senão $\implies$ **Pick: Vitória Mandante**
6. **Cálculo da Odd Mínima EV+:** $\text{OddMin} = \max\left(1.01, \text{round}\left(\frac{1}{P_{\text{vencedora}}}, 2\right)\right)$

---

## 4. ESTRUTURA DO BANCO DE DADOS (SUPABASE POSTGRESQL)

A persistência do sistema utiliza duas tabelas no Supabase:

### 4.1 Tabela `matches`
- `id` (uuid, chave primária)
- `home_team` (text, nome do mandante)
- `away_team` (text, nome do visitante)
- `date` (text / date, data da partida)
- `status` (text, `"pending"` ou `"completed"`)
- `home_stats` (jsonb, objeto contendo todas as estatísticas extraídas do mandante)
- `away_stats` (jsonb, objeto contendo todas as estatísticas extraídas do visitante)
- `results` (jsonb, objeto completo contendo todas as projeções, probabilidades e a `pick_1x2`)
- `real_results` (jsonb, estatísticas reais registradas pós-jogo para calibração)
- `created_at` (timestamp)

### 4.2 Tabela `league_profiles`
- `id` (uuid, chave primária)
- `name` (text, nome do campeonato)
- `season` (text, temporada)
- `matches_sample` (int, número de jogos importados)
- `avg_goals`, `avg_corners`, `avg_cards`, `avg_xg` (float, médias históricas da liga para consulta)

---

## 5. GUIA DE MANUTENÇÃO E REGRAS PARA NOVOS AGENTES DE IA

1. **NUNCA Reintroduzir perfis de liga nas previsões:** O motor deve permanecer 100% autônomo.
2. **NUNCA Reintroduzir escolhas de Dupla Chance ou DNB:** O 1X2 deve manter a estrição estrita entre Vitória Mandante, Empate e Vitória Visitante.
3. **NUNCA Exibir linhas irrealistas na UI:** Todas as exibições Over/Under devem consultar o dicionário `COMMERCIAL_LINES`.
4. **Respeitar o Build:** Sempre execute `npm run build` após alterar arquivos frontend para garantir zero quebras de módulo.

---
Este documento foi compilado como o guia definitivo de arquitetura, parâmetros e operação do sistema.
