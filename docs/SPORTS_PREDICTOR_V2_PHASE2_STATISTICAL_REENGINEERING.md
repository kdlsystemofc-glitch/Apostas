# SPORTS PREDICTOR V2 — FASE 2: REENGENHARIA DO MODELO ESTATÍSTICO
## ESPECIFICAÇÃO TÉCNICA E MATEMÁTICA DO NOVO MOTOR PROBABILÍSTICO

---

### CONSELHO ESTATÍSTICO E QUANTITATIVO V2:
- **Football Data Scientist**
- **Senior Statistician**
- **Betting Quant**
- **Especialista em Modelagem Probabilística**

---

> **DIRETRIZ DA FASE 2:** NENHUM CÓDIGO-FONTE SERÁ ALTERADO NESTA ETAPA. Este documento é a especificação matemática completa, comparando a metodologia atual com os modelos quânticos modernos utilizados por sindicatos de apostas (Pinnacle/Syndicates) e definindo as equações formais do novo motor estatístico do **Sports Predictor V2**.

---

## 1. DIAGNÓSTICO PROFUNDO DO MODELO ATUAL

### 1.1 Tabela Comparativa de Limitações Estatísticas

| Componente | Modelo Atual (V1) | Problema / Viés Identificado | Impacto Estatístico | Solução Proposta no V2 |
| :--- | :--- | :--- | :--- | :--- |
| **Amostra de Dados** | Média simples de 5-10 jogos sem ajuste. | **Overfitting a amostras curtas** e sensibilidade extrema a ruídos recentes. | Elevado viés de amostragem. | **Bayesian Shrinkage** (Ponderação de Credibilidade para média da liga). |
| **Força do Oponente** | Amostras tratadas de forma idêntica. | **Opponent Rating Bias**: 5 gols contra time fraco = 5 gols contra time forte. | Distorção em jogos de disparidade de nível. | **Rating ELO / Glicko2 Multiplicativo**. |
| **Distribuição de Cartões e Faltas** | Distribuição de Poisson ($\mu = \sigma^2$). | **Violenta Sobredispersão** ($\sigma^2 \gg \mu$). Poisson afunila as probabilidades em caixas altas. | Subestimação grave de Over cartões/faltas. | **Distribuição Binomial Negativa (NB2)**. |
| **Mercado Ambas Marcam (BTTS)** | $P(\text{BTTS}) = (1 - e^{-\lambda_H})(1 - e^{-\lambda_A})$. | Assume **Independência Estocástica**. Ignora a correlação de Game Script pós-primeiro gol. | Subavaliação de BTTS Sim em jogos equilibrados. | **Matriz Bivariada Dixon-Coles Integrada**. |
| **Ajuste Dixon-Coles ($\tau$)** | $\rho = -0.13$ estático e global. | Não reflete as particularidades de empates por liga/campeonato. | Leve viés na probabilidade de empate. | **Estimador MLE por Liga / Família de Campeonatos**. |
| **Mercado de Handicap** | Ausente. | Não oferece linhas de Handicap Asiático (AH) ou DNB. | Restrição de mercados comerciais de alto volume. | **Integrador de Placares para Handicap Asiático e DNB**. |
| **Gestão de Risco / Stake** | Não calcula tamanho de aposta. | O usuário não sabe quanto apostar para proteger a banca. | Risco de ruína (Bankrupt Risk). | **Critério de Kelly Fracionário (Quarter Kelly)**. |

---

## 2. ESPECIFICAÇÃO MATEMÁTICA DO NOVO MODELO (SPORTS PREDICTOR V2)

---

### 2.1 Ponderação Bayesiana de Amostra (Bayesian Shrinkage)
Para evitar que uma sequência atípica de 5 jogos distorça as projeções, a expectativa de cada estatística é encolhida em direção à média histórica do campeonato ($\mu_{\text{liga}}$):

$$\lambda_{\text{bayes}} = w \cdot \lambda_{\text{observado}} + (1 - w) \cdot \mu_{\text{liga}}$$

Onde o fator de credibilidade $w$ é derivado do tamanho da amostra $n$ e da constante de amortecimento $k = 10$:

$$w = \frac{n}{n + k}$$

---

### 2.2 Ajuste por Rating ELO do Oponente
A intensidade de ataque do time A é ponderada pelo nível defensivo histórico do adversário B relativo à liga:

$$\gamma_{\text{oponente}} = \frac{\text{ELO}_{\text{adversário}}}{\text{ELO}_{\text{média\_liga}}} \implies \lambda_{\text{ajustado}} = \lambda_{\text{bayes}} \cdot (\gamma_{\text{oponente}})^{\alpha}$$

Onde $\alpha = 0.50$ é o coeficiente de atenuação da força do oponente.

---

### 2.3 Distribuição Binomial Negativa (NB2) para Cartões e Faltas
Para mercados com sobredispersão ($\sigma^2 > \mu$), a Função de Massa de Probabilidade (PMF) de Poisson é substituída pela Binomial Negativa:

$$P(Y = k) = \frac{\Gamma(k + r)}{k! \, \Gamma(r)} \left(\frac{r}{r + \lambda}\right)^r \left(\frac{\lambda}{r + \lambda}\right)^k$$

Onde:
- $\lambda$ é a expectativa ajustada do evento.
- $r$ é o parâmetro de dispersão estatística ($r = 4.0$ para Cartões; $r = 12.0$ para Faltas).
- $\Gamma(n)$ é a Função Gamma.

---

### 2.4 Matriz Bivariada Dixon-Coles Integrada para BTTS e Placares
A probabilidade conjunta do placar $(i, j)$ é dada por:

$$P(X = i, Y = j) = P_{\text{pois}}(i, \lambda_H) \cdot P_{\text{pois}}(j, \lambda_A) \cdot \tau(i, j, \lambda_H, \lambda_A, \rho)$$

Onde a função de ajuste de correlação de baixos placares $\tau(i, j)$ é:

$$\tau(i, j) = \max\left(0, \begin{cases} 
1 - (\lambda_H \cdot \lambda_A \cdot \rho), & i=0, j=0 \\ 
1 + (\lambda_H \cdot \rho), & i=1, j=0 \\ 
1 + (\lambda_A \cdot \rho), & i=0, j=1 \\ 
1 - \rho, & i=1, j=1 \\ 
1.0, & \text{caso contrário} 
\end{cases}\right)$$

#### Cálculo Direto de Ambas Marcam (BTTS) via Matriz Bivariada:
Em vez de multiplicar termos independentes, o BTTS é integrado diretamente da matriz conjunta de placares:

$$P(\text{BTTS Sim}) = \sum_{i \ge 1} \sum_{j \ge 1} P(i, j) = 1 - \sum_{i=0}^8 P(i, 0) - \sum_{j=0}^8 P(0, j) + P(0, 0)$$

Isso elimina $100\%$ do viés de independência e captura a correlação real de gols!

---

### 2.5 Integrador de Handicap Asiático (AH) e Draw No Bet (DNB)
Através da matriz conjunta de placares $P(i, j)$, derivam-se as probabilidades exatas de todos os Handicaps Asiáticos:

- **Draw No Bet (DNB / AH 0.0):**
  $$P(\text{DNB Mandante}) = \frac{P_{\text{casa}}}{P_{\text{casa}} + P_{\text{fora}}}, \quad \text{OddJusta}_{\text{DNB}} = \frac{1}{P(\text{DNB Mandante})}$$

- **Handicap Asiático Mandante -0.5 (Vitória Simples):**
  $$P(\text{AH -0.5}) = \sum_{i > j} P(i, j) = P_{\text{casa}}$$

- **Handicap Asiático Mandante -1.5 (Vitória por 2+ Gols):**
  $$P(\text{AH -1.5}) = \sum_{i - j \ge 2} P(i, j)$$

---

### 2.6 Gestão de Banca via Critério de Kelly Fracionário (Quarter Kelly)
Para cada entrada com Valor Esperado Positivo ($EV > 0\%$), a porcentagem recomendada da banca total ($f^*$) é calculada via **Quarter Kelly** (recomenda-se $25\%$ do Kelly cheio para controle de volatilidade):

$$f^* = \max\left(0, \, 0.25 \times \frac{P_{\text{modelo}} \cdot \text{Odd}_{\text{casa}} - 1}{\text{Odd}_{\text{casa}} - 1}\right)$$

- **Exemplo:** $P_{\text{modelo}} = 60\%$ ($0.60$), $\text{Odd}_{\text{casa}} = 2.00$.
  $$f^* = 0.25 \times \frac{0.60 \cdot 2.00 - 1}{2.00 - 1} = 0.25 \times 0.20 = 0.05 \implies \mathbf{5.0\% \text{ da Banca}}$$

---

## 3. ARQUITETURA PROPOSTA PARA A IMPLEMENTAÇÃO (FASE 3)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ESTRUTURA DO MOTOR REENGENHARIZADO V2 (predictionEngineV2.js)               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Bayesian Shrinkage Layer   -> Aplica amortecimento k=10 a médias brutas. │
│ 2. ELO Adjuster Layer         -> Pondera força defensiva/ofensiva do rival. │
│ 3. Distribution Selector      -> Poisson (Gols/Cantos) vs NegBin (Cartões). │
│ 4. Bivariate Matrix Engine    -> Gera matriz 8x8 Dixon-Coles integrada.     │
│ 5. Market Odds & EV Engine    -> Deriva 1X2, Over/Under, BTTS, AH e DNB.    │
│ 6. Quarter-Kelly Risk Engine  -> Emite a sugestão de stake % da banca.       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---
Documentação técnica da Fase 2 concluída. Nenhuma linha de código foi alterada nesta etapa. Especificação matemática 100% pronta para validação antes da implementação na Fase 3.
