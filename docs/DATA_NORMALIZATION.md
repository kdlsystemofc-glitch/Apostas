# RELATÓRIO TÉCNICO DE AUDITORIA — FASE 1.4
## DATA NORMALIZATION & TRANSFORMATION PIPELINE

Nenhum arquivo foi alterado ou modificado. Esta auditoria detalha exatamente como os dados brutos são recebidos, parseados, transformados e normalizados antes e durante os cálculos do **Sports Predictor**.

---

### 1. RESUMO EXECUTIVO DO TIPO DE NORMALIZAÇÃO

| Método de Normalização | Utilizado? | Onde / Como é Aplicado no Sistema |
| :--- | :---: | :--- |
| **Média Simples** | **SIM** | **1.** Na entrada bruta do StatsHub (`t` e `c` são médias por jogo).<br>**2.** Na função `ancora()` que calcula a média aritmética simples $\frac{\text{feito} + \text{cedido}}{2}$. |
| **Média Ponderada** | **SIM** | Na função `pesosDinamicos()`, que calcula a soma ponderada dos fatores ofensivos e defensivos ($\sum \hat{w}_i v_i$). |
| **Min-Max (Clamping)** | **SIM** | Utilizado em travas de teto e piso (Cap/Floor):<br>• `resistencia()` limita em `cap = 2.0`.<br>• `fatorLiga()` limita no intervalo `[0.80, 1.20]`.<br>• Probabilidades limitadas no intervalo `[0.0, 1.0]`. |
| **Z-Score** ($\frac{x - \mu}{\sigma}$) | **NÃO** | O sistema não calcula desvio padrão ($\sigma$) nem padronização Z-score. |
| **Percentil** | **NÃO** | O sistema não utiliza ranking por percentis sobre a distribuição dos dados. |
| **Normalização Própria** | **SIM (PREDOMINANTE)** | **1. Ratio Relativo Ataque/Defesa (`indice`):** Proporção do time frente à média do confronto.<br>**2. Compressão Logarítmica (`resistencia`):** Suavização por $\ln(1+x)$.<br>**3. Re-normalização Dinâmica de Pesos:** Redistribuição automática de pesos para estatísticas ausentes.<br>**4. Correlação Sigmoide Logística (`calcBTTS`):** Ajuste de curva em S.<br>**5. Blend Híbrido da Liga (`calibrarProb`):** Combinação linear de Poisson com histórico real (30%). |
| **Nenhuma Normalização** | **NÃO** | Os dados brutos passam por 11 etapas sucessivas de transformação matemática antes do resultado final. |

---

### 2. FLUXO COMPLETO DA TRANSFORMAÇÃO DE DADOS (PIPELINE)

```
[1. Texto Bruto Colado (StatsHub / Excel)]
                   │
                   ▼
[2. Parsing & Extração (parseStatsHubText)]
    - Converte strings tabuladas em floats
    - Separa em Média do Time (t) e Média Cedida (c)
                   │
                   ▼
[3. Leitura com Fallback (g)]
    - Garante valor padrão 0.0 para estatísticas ausentes
                   │
                   ▼
[4. Ancoragem Base (ancora)]
    - Calcula a Média Simples Inter-Equipes: (Atq.t + Def.c) / 2
                   │
                   ▼
[5. Normalização Relativa de Intensidade (indice)]
    - Normaliza ataque frente à média do confronto: Atq / ((Atq + Def) / 2)
                   │
                   ▼
[6. Normalização Defensiva Logarítmica (resistencia)]
    - Suavização não-linear: ln(1 + Def) / ln(1 + Atq) com Cap Max = 2.0
                   │
                   ▼
[7. Re-normalização Dinâmica de Pesos (pesosDinamicos)]
    - Filtra estatísticas válidas (> 0) e recalcula pesos para somarem 1.0 (100%)
                   │
                   ▼
[8. Escalonamento por Mando de Campo]
    - Aplica multiplicadores lineares fixos (ex: Escanteios Casa x1.18, Gols Casa x1.08)
                   │
                   ▼
[9. Calibração Logarítmica de Liga (fatorLiga)]
    - Ajusta xValor pela média da liga: 1 + 0.5 * ln(avgLiga / avgApp) em [0.80, 1.20]
                   │
                   ▼
[10. Transformação Probabilística Discrete Poisson (poissonOver / calcResultado)]
    - Transforma valor esperado (lambda) em probabilidades de linha Over/Under e Matriz 1X2
                   │
                   ▼
[11. Blend Híbrido Linear com Histórico da Liga (calibrarProb / ajustarBTTS)]
    - Combinação Convexa Final: Prob = (Modelo * 70%) + (Histórico Liga * 30%)
                   │
                   ▼
[12. Visualização dos Sinais e Recomendações (MarketBlock / BestBetsByMarket)]
```

---

### 3. DETALHAMENTO MATEMÁTICO DE CADA ETAPA DA PIPELINE

#### Etapa 1 & 2: Ingestão, Parsing e Extração de Médias Simples Brutas
- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L40-L111)
- **Função:** `parseStatsHubText(text)` e `extrairMedias(line)`
- **Mecanismo:** O sistema faz o split por tabulações `\t` e quebras de linha `\n`. Os dados já chegam do StatsHub como **Médias Simples por Jogo** (ex: `goals.t = 1.80` gols feitos por jogo; `goals.c = 1.10` gols cedidos por jogo).

#### Etapa 3: Tratamento de Dados Nulos e Ausentes
- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L109-L111)
- **Função:** `g(stats, key, campo)`
- **Mecanismo:** `stats?.[key]?.[campo] || 0.0`. Garante que estatísticas não coladas não quebrem o fluxo numérico, retornando `0.0`.

#### Etapa 4: Ancoragem Base Inter-Equipes (Média Simples)
- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L124-L126)
- **Função:** `ancora(timeFaz, advCede)`
- **Fórmula:**
  $$\text{Âncora} = \frac{\text{timeFaz} + \text{advCede}}{2}$$
- **Propósito:** Cria o valor neutro inicial de partida cruzando o ataque do time A com a defesa do time B.

#### Etapa 5: Normalização Relativa de Intensidade Ataque vs Defesa (`indice`)
- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L114-L117)
- **Função:** `indice(feito, cedido)`
- **Fórmula:**
  $$\text{ref} = \frac{\text{feito} + \text{cedido}}{2}$$
  $$\text{Índice} = \begin{cases} \frac{\text{feito}}{\text{ref}}, & \text{se } \text{ref} > 0 \\ 1.0, & \text{se } \text{ref} \le 0 \end{cases}$$
- **Propósito:** É uma **normalização própria adimensionada** centrada em `1.0`. Se o time produz acima da média do confronto, o índice é $> 1.0$; se produz abaixo, é $< 1.0$.

#### Etapa 6: Compressão Logarítmica Defensiva Não-Linear (`resistencia`)
- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L119-L122)
- **Função:** `resistencia(cedidoDef, feitoAtk, cap = 2.0)`
- **Fórmula:**
  $$\text{Resistência} = \begin{cases} \min\left( \frac{\ln(1 + \text{cedidoDef})}{\ln(1 + \text{feitoAtk})}, 2.0 \right), & \text{se } \text{feitoAtk} > 0 \\ 1.0, & \text{se } \text{feitoAtk} \le 0 \end{cases}$$
- **Propósito:** Normaliza a relação de força defensiva aplicando utilidade marginal decrescente via $\ln(1+x)$. Além disso, aplica um **Min-Max Cap** limitando o multiplicador máximo em `2.0`.

#### Etapa 7: Re-normalização Dinâmica de Pesos para Estatísticas Ausentes
- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L128-L136)
- **Função:** `pesosDinamicos(componentes)`
- **Fórmula:**
  Para uma lista de componentes com pesos teóricos $w_1, w_2, \dots, w_k$:
  1. Filtra apenas componentes com valor $v_i > 0$.
  2. Recalcula os pesos vigentes para garantir a restrição de soma igual a 1 (100%):
     $$\hat{w}_i = \frac{w_i}{\sum_{j \in \text{válidos}} w_j}$$
  3. Retorna a Média Ponderada Re-normalizada: $I = \sum \hat{w}_i v_i$.
- **Propósito:** Se uma estatística secundária não for colada pelo usuário (ex: `big_chance_created`), o sistema redistribui proporcionalmente seu peso entre as estatísticas presentes sem distorcer a escala final.

#### Etapa 8: Escalonamento Fixo de Mando de Campo
- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L195,L240,L273,L330,L392)
- **Mecanismo:** Multiplicação escalar direta por constante de mando:
  - Gols Mandante: $\times 1.08$ | Visitante: $\times 0.92$
  - Escanteios Mandante: $\times 1.18$ | Visitante: $\times 1.00$
  - Chutes no Gol Mandante: $\times 1.05$ | Visitante: $\times 0.95$
  - Cartões Mandante: $\times 0.92$ | Visitante: $\times 1.00$

#### Etapa 9: Normalização Logarítmica com Cap/Floor por Liga (`fatorLiga`)
- **Arquivo:** [`src/lib/leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js#L41-L48)
- **Função:** `fatorLiga(avgLiga, avgApp)`
- **Fórmula:**
  $$\text{ratio} = \frac{\text{avgLiga}}{\text{avgApp}}$$
  $$\text{fator} = \text{Clamp}\left( 1 + 0.5 \times \ln(\text{ratio}), \text{min}=0.80, \text{max}=1.20 \right)$$
- **Propósito:** Normaliza o xValor da partida em relação ao padrão histórico do campeonato. Utiliza **compressão logarítmica** suavizada por `0.5` e **Min-Max Clamping** forçando o fator a permanecer no intervalo $[0.80, 1.20]$.

#### Etapa 10: Transformação Probabilística de Poisson (CDF Acumulada & PMF 2D)
- **Arquivo:** [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L146-L152,L404-L436)
- **Funções:** `poissonOver(media, linha)` e `calcResultado(xgCasa, xgFora)`
- **Fórmula:**
  Converte a esperança matemática bruta $\lambda$ em probabilidade limitada no intervalo $[0.0, 1.0]$:
  $$P(\text{Over } \text{linha}) = 1 - \sum_{i=0}^{\lfloor \text{linha} \rfloor} \frac{e^{-\lambda} \cdot \lambda^i}{i!}$$

#### Etapa 11: Blend Híbrido Linear com Histórico Real da Liga (Calibração Bayesian-like)
- **Arquivo:** [`src/lib/leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js#L51-L56,L96-L100)
- **Funções:** `calibrarProb(probPoisson, overMapLiga, linha)` e `ajustarBTTS()`
- **Fórmula:**
  Combinação linear convexa (Média Ponderada de Probabilidades):
  $$P_{\text{final}} = P_{\text{Poisson}} \times (1 - 0.30) + P_{\text{histórico\_liga}} \times 0.30$$
- **Propósito:** Mescla 70% do modelo estatístico derivado do confronto direto com 30% da frequência histórica real observada no campeonato (via interpolação linear `interpolarOverLiga`).

---
Nenhum arquivo do código-fonte foi alterado durante esta auditoria.
