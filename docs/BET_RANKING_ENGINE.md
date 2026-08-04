# RELATÓRIO TÉCNICO DE AUDITORIA — FASE 1.6
## BET RANKING ENGINE & SIGNAL CLASSIFICATION

Nenhum arquivo foi alterado ou modificado. Esta auditoria detalha exatamente como o **Sports Predictor** gera probabilidades, classifica sinais (**FORTE OVER**, **OVER**, **NEUTRO**, **UNDER**, **FORTE UNDER**) e seleciona/ordena as melhores apostas por mercado.

---

### 1. ORIGEM DE CADA PORCENTAGEM APRESENTADA NA INTERFACE

| Elemento Visual na Interface | Componente React | Função Responsável | Origem Matemática da Porcentagem |
| :--- | :--- | :--- | :--- |
| **Probabilidades 1X2 (Casa / Empate / Fora)** | `MatchResultBlock.jsx`<br>`DailyOverview.jsx` | `calcResultado()` em `predictionEngine.js:404` | Somatório das probabilidades da Matriz Bivariada $9 \times 9$ de Poisson:<br>$P(\text{Casa}) = \sum_{i>j} \text{PMF}(i, xG_C) \cdot \text{PMF}(j, xG_F)$ |
| **Top 5 Placares Prováveis** | `MatchResultBlock.jsx` | `calcResultado()` em `predictionEngine.js:404` | Probabilidade individual da célula de Poisson $P(X=i, Y=j) = \text{PMF}(i, xG_C) \cdot \text{PMF}(j, xG_F)$ ordenada decrescentemente. |
| **Porcentagens Over/Under por Linha** | `MarketBlock.jsx`<br>`BestBetsByMarket.jsx` | `poissonOver()` em `predictionEngine.js:146` + `calibrarProb()` em `leagueAdjustment.js:51` | **1.** $P_{\text{bruta}} = 1 - \sum_{i=0}^{\lfloor \text{linha} \rfloor} \frac{e^{-\lambda} \lambda^i}{i!}$ onde $\lambda = x_{\text{total}} \cdot f_{\text{liga}}$<br>**2.** $P_{\text{final}} = P_{\text{bruta}} \cdot 0.70 + P_{\text{liga}}(\text{linha}) \cdot 0.30$ |
| **Porcentagem Ambas Marcam (BTTS)** | `BTTSBlock.jsx`<br>`BestBetsByMarket.jsx` | `calcBTTS()` em `predictionEngine.js:286` + `ajustarBTTS()` em `leagueAdjustment.js:96` | **1.** $P_{\text{raw}} = (1 - e^{-xG_C}) \cdot (1 - e^{-xG_F})$<br>**2.** $P_{\text{modelo}} = P_{\text{raw}} \cdot (0.62 + 0.36 \cdot \text{sigmoide}(xG_{\text{tot}}))$<br>**3.** $P_{\text{final}} = P_{\text{modelo}} \cdot 0.70 + \text{BTTS}_{\text{liga}} \cdot 0.30$ |
| **Probabilidades P(Casa Marca) e P(Fora Marca)** | `BTTSBlock.jsx`<br>`BestBetsByMarket.jsx` | `calcBTTS()` em `predictionEngine.js:286` | $P(\text{Casa Marca}) = (1 - e^{-xG_{\text{casa}}}) \times 100\%$<br>$P(\text{Fora Marca}) = (1 - e^{-xG_{\text{fora}}}) \times 100\%$ |

---

### 2. REGRAS DE DECISÃO E RECONHECIMENTO DE SINAIS (THRESHOLDS)

O sistema possui **3 classificadores distintos** de sinais definidos em `predictionEngine.js`:

#### A. Classificador Geral (`sinalPoisson`)
- **Arquivo:** [`src/lib/predictionEngine.js:154-160`](file:///c:/appo/src/lib/predictionEngine.js#L154-L160)
- **Mercados Aplicados:** Escanteios, Chutes no Gol, Cartões, Defesas do Goleiro, Chutes Totais e Faltas.
- **Tabela de Regras e Thresholds:**

```
                  UNDER                 NEUTRO                 OVER              FORTE OVER
    ◄───────────────────────────────┼─────────────┼───────────────────────────────►
    0%                             25%           35%                             75%             100%
             FORTE UNDER                     OVER
```

| Faixa de Probabilidade ($p$) | Rótulo (Label) | Cor na UI | Significado Operacional |
| :--- | :--- | :--- | :--- |
| $p \ge 0.75$ ($75.0\%$) | **FORTE OVER** | `green` (Verde) | Alta probabilidade de bater o Over (Sinal Forte) |
| $0.65 \le p < 0.75$ ($65.0\% - 74.9\%$) | **OVER** | `yellow` (Amarelo) | Probabilidade moderada de bater o Over |
| $0.35 < p < 0.65$ ($35.1\% - 64.9\%$) | **NEUTRO** | `gray` (Cinza) | Indefinição / Sem tendência de aposta |
| $0.25 < p \le 0.35$ ($25.1\% - 35.0\%$) | **UNDER** | `gray` (Cinza) | Tendência moderada a Under |
| $p \le 0.25$ ($25.0\%$) | **FORTE UNDER** | `red` (Vermelho) | Alta probabilidade de Under (Pouca ocorrência) |

---

#### B. Classificador Especial de Gols (`sinalPoissonGols`)
- **Arquivo:** [`src/lib/predictionEngine.js:162-169`](file:///c:/appo/src/lib/predictionEngine.js#L162-L169)
- **Mercados Aplicados:** Gols Total, Gols Casa e Gols Fora.
- **Rationale do Código:** *"Threshold mais alto que o padrão — gols têm zona OVER pouco confiável"*.
- **Tabela de Regras e Thresholds:**

| Faixa de Probabilidade ($p$) | Rótulo (Label) | Cor na UI | Significado Operacional |
| :--- | :--- | :--- | :--- |
| $p \ge 0.78$ ($78.0\%$) | **FORTE OVER** | `green` (Verde) | Exigência rigorosa para validar entrada de Over Gols |
| $0.70 \le p < 0.78$ ($70.0\% - 77.9\%$) | **OVER** | `yellow` (Amarelo) | Tendência moderadamente alta de gols |
| $0.32 < p < 0.70$ ($32.1\% - 69.9\%$) | **NEUTRO** | `gray` (Cinza) | **Zona Neutra Expandida** (Bloqueia apostas incertas) |
| $0.22 < p \le 0.32$ ($22.1\% - 32.0\%$) | **UNDER** | `gray` (Cinza) | Tendência a poucos gols |
| $p \le 0.22$ ($22.0\%$) | **FORTE UNDER** | `red` (Vermelho) | Alta probabilidade de Under Gols |

---

#### C. Classificador do Mercado Ambas Marcam (`sinalBTTS`)
- **Arquivo:** [`src/lib/predictionEngine.js:504-510`](file:///c:/appo/src/lib/predictionEngine.js#L504-L510)
- **Mercados Aplicados:** Ambas Marcam (BTTS).
- **Tabela de Regras e Thresholds:**

| Faixa de Probabilidade ($p$) | Rótulo (Label) | Cor na UI | Significado Operacional |
| :--- | :--- | :--- | :--- |
| $p \ge 0.72$ ($72.0\%$) | **SIM · FORTE** | `green` (Verde) | Alta probabilidade de ambos os times marcarem |
| $0.60 \le p < 0.72$ ($60.0\% - 71.9\%$) | **SIM · POSSÍVEL** | `yellow` (Amarelo) | Tendência favorável ao BTTS Sim |
| $0.45 < p < 0.60$ ($45.1\% - 59.9\%$) | **NEUTRO** | `gray` (Cinza) | Indefinição |
| $0.35 < p \le 0.45$ ($35.1\% - 45.0\%$) | **NÃO · POSSÍVEL** | `gray` (Cinza) | Tendência a pelo menos uma defesa segurar o zero |
| $p \le 0.35$ ($35.0\%$) | **NÃO · FORTE** | `red` (Vermelho) | Alta probabilidade de BTTS Não |

---

### 3. MECANISMO DO MOTOR DE RANKING DE APOSTAS (`BestBetsByMarket.jsx`)

O componente [`BestBetsByMarket.jsx`](file:///c:/appo/src/components/stats/BestBetsByMarket.jsx) executa um algoritmo em dois estágios para selecionar a melhor linha de cada mercado e ranqueá-las:

```
[1. Para cada mercado (Escanteios, Gols, Cartões, etc.)]
                          │
                          ▼
[2. Geração das Linhas Candidatas (linhasDinamicas)]
    - Linha Principal = floor(xTotal) + 0.5
    - Candidatas = [Principal - 3, ..., Principal + 3]
                          │
                          ▼
[3. Avaliação de Score por Linha (bestLine)]
    - Probabilidade Poisson + Blend de Liga: p
    - Sinal: sinalFn(p)
    - Distância: dist = |linha - linhaPrincipal|
    - Score = (1 - dist * 0.12) + signalBonus + (p >= 0.5 ? 0.05 : 0)
      * signalBonus: FORTE (+0.35), OVER/UNDER (+0.18), NEUTRO (+0.00)
                          │
                          ▼
[4. Escolha da Linha Vencedora do Mercado]
    - A linha que obtiver o maior Score é a eleita
                          │
                          ▼
[5. Cálculo da Força do Sinal (Strength)]
    - Strength = |p_linha_vencedora - 0.50|
                          │
                          ▼
[6. Ordenação Global dos Mercados]
    - sorted = mercados.sort((a, b) => b.best.strength - a.best.strength)
                          │
                          ▼
[7. Destaque do Top Pick (🏆 Sinal Mais Forte)]
    - Exibe o mercado posicionado em sorted[0] no banner verde inferior
    - Se todos os mercados estiverem na faixa neutra (40-60%), exibe aviso para NÃO apostar
```

---

### 4. QUADRO RESUMO DE CONSTANTES E PESOS DO RANKING ENGINE

| Elemento | Valor / Peso | Arquivo & Linha | Função no Sistema |
| :--- | :---: | :--- | :--- |
| **Threshold FORTE OVER Geral** | `0.75` (75%) | `predictionEngine.js:155` | Dispara o badge verde de alta confiança |
| **Threshold OVER Geral** | `0.65` (65%) | `predictionEngine.js:156` | Dispara o badge amarelo moderado |
| **Threshold UNDER Geral** | `0.35` (35%) | `predictionEngine.js:158` | Início da zona de Under |
| **Threshold FORTE UNDER Geral** | `0.25` (25%) | `predictionEngine.js:157` | Dispara o badge vermelho de Under |
| **Threshold FORTE OVER Gols** | `0.78` (78%) | `predictionEngine.js:164` | Exigência maior para sinal forte de gols |
| **Threshold OVER Gols** | `0.70` (70%) | `predictionEngine.js:165` | Sinal moderado de gols |
| **Threshold FORTE BTTS** | `0.72` (72%) | `predictionEngine.js:505` | Dispara sinal SIM · FORTE em BTTS |
| **Penalidade Distância de Linha** | `0.12` por linha | `BestBetsByMarket.jsx:44` | Evita sugerir linhas distantes do mercado real |
| **Bônus Sinal FORTE (Ranking)** | `+0.35` | `BestBetsByMarket.jsx:45` | Eleva a pontuação de linhas com sinal forte |
| **Bônus Sinal Normal (Ranking)** | `+0.18` | `BestBetsByMarket.jsx:45` | Eleva a pontuação de linhas com sinal moderado |
| **Bônus Probabilidade $\ge 50\%$** | `+0.05` | `BestBetsByMarket.jsx:46` | Pequeno bônus para aposta no sentido provável |
| **Cálculo da Força do Sinal** | $\|p - 0.50\|$ | `BestBetsByMarket.jsx:50` | Mede o quão distante a aposta está do 50/50 |

---
Nenhum arquivo do código-fonte foi alterado durante esta auditoria.
