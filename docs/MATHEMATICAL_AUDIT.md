# RELATÓRIO TÉCNICO DE AUDITORIA — FASE 1.7
## MATHEMATICAL AUDIT — SPORTS PREDICTION SYSTEM

Nenhum arquivo foi alterado ou modificado. Esta auditoria analisa detalhadamente a fundamentação matemática, estatística e probabilística do motor de previsão do **Sports Predictor**.

---

### 1. CHECKLIST DE MODELOS E MATEMÁTICA ESTATÍSTICA

| Modelo / Técnica | Presente no Sistema? | Como / Onde é Utilizado (se presente) | Substitutos / O que é usado no lugar |
| :--- | :---: | :--- | :--- |
| **Poisson (Univariada)** | **SIM** | Utilizado em `poissonOver()` ([`predictionEngine.js:146`](file:///c:/appo/src/lib/predictionEngine.js#L146)) para calcular probabilidades Over/Under via CDF acumulação de Poisson: $P(X > k) = 1 - \sum_{i=0}^k \frac{e^{-\lambda} \lambda^i}{i!}$. | — |
| **Bivariate Poisson** | **NÃO (PSEUDO)** | Não utiliza Bivariate Poisson real (sem parâmetro de covariância $\lambda_3$ nem ajuste Dixon-Coles $\tau(x,y)$ para placares baixos). | Multiplicação simples de duas distribuições Poisson independentes em `calcResultado()`: $P(X, Y) = P(X) \cdot P(Y)$. |
| **Skellam Distribution** | **NÃO** | O sistema não utiliza a Distribuição de Skellam para modelar a diferença de gols ($X - Y$). | Soma de células da matriz $9 \times 9$ de Poisson em `calcResultado()`. |
| **Elo Rating System** | **NÃO** | Não há cálculo de ratings dinâmicos de equipes (Elo, Glicko ou TrueSkill) ao longo do tempo. | Utiliza apenas as médias simples puras coladas da amostra recente de jogos do time. |
| **Bradley-Terry** | **NÃO** | Não utiliza modelo de comparação pareada logístico para força relativa dos times. | Substituído por Índices Relativos de Intensidade (`indice()`) e Âncora Base (`ancora()`). |
| **Bayes / Atualização Bayesiana** | **NÃO (PSEUDO)** | Não há inferência bayesiana formal (sem distribuições a priori, verossimilhança Gamma-Poisson ou amostragem MCMC). | Substituído por Mistura Linear Convexa estática (`calibrarProb()`): $P_{\text{final}} = P_{\text{modelo}} \cdot 0.70 + P_{\text{liga}} \cdot 0.30$. |
| **Monte Carlo** | **NÃO** | Não realiza simulações estocásticas por amostragem (ex: 10.000 iterações aleatórias). | Avaliação determinística direta da grade $9 \times 9 = 81$ placares de Poisson. |
| **Machine Learning** | **NÃO** | Ausência total de algoritmos supervisionados ou não-supervisionados (sem scikit-learn, PyTorch ou ONNX). | Regras matemáticas determinísticas e heurísticas com pesos estáticos. |
| **Regressão Logística** | **NÃO (PSEUDO)** | Em `calcBTTS()`, utiliza a fórmula matemática de uma função sigmoide logística $f(x) = \frac{1}{1 + e^{-1.3(x-2.8)}}$. | A curva **NÃO foi treinada** por regressão logística no dataset; suas constantes ($1.3$ e $2.8$) foram arbitradas manualmente. |
| **Random Forest / XGBoost** | **NÃO** | Nenhuma árvore de decisão ou algoritmo de Gradient Boosting é utilizado. | Sistema de índices ponderados com pesos manuais hardcoded. |
| **Outras Distribuições (Binomial Negativa, Normal, Weibull)** | **NÃO** | Não utiliza Binomial Negativa (necessária para tratar sobredispersão em faltas/cartões) nem Zero-Inflated Poisson. | Poisson univariada pura para todos os mercados. |

---

### 2. EXPLICAÇÃO TÉCNICA DO MÉTODO MATEMÁTICO REALMENTE UTILIZADO

O motor de previsão do sistema **NÃO É UM MODELO DE MACHINE LEARNING NEM DE ESTATÍSTICA BAYESIANA AVANÇADA**.

O método utilizado é um **Sistema Determinístico Heurístico de Índices Ponderados Multifatoriais combinado com Distribuição de Poisson Univariada e Mistura Linear de Liga**.

#### A Pipeline Matemática Real do Engine:

1. **Índice Relativo de Intensidade Ataque vs Defesa (`indice`):**
   $$I = \frac{\text{Atq.t}}{\frac{\text{Atq.t} + \text{Def.c}}{2}}$$
2. **Compressão Logarítmica Defensiva (`resistencia`):**
   $$R = \min\left( \frac{\ln(1 + \text{Def.c})}{\ln(1 + \text{Atq.t})}, 2.0 \right)$$
3. **Composição Ponderada Dinâmica (Pesos Manuais Hardcoded):**
   $$\lambda_{\text{bruto}} = \text{Âncora} \times (w_{\text{ofensivo}} \cdot I_{\text{ofensivo}} + w_{\text{defensivo}} \cdot I_{\text{defensivo}}) \times \text{FatorMando}$$
4. **Calibração Logarítmica por Campeonato (`fatorLiga`):**
   $$\lambda_{\text{ajustado}} = \lambda_{\text{bruto}} \times \text{Clamp}\left( 1 + 0.5 \ln\left(\frac{\text{avg}_{\text{liga}}}{\text{avg}_{\text{app}}}\right), 0.80, 1.20 \right)$$
5. **Avaliação Probabilística de Poisson (CDF Acumulada):**
   $$P(X > k) = 1 - \sum_{i=0}^{k} \frac{e^{-\lambda} \lambda^i}{i!}$$
6. **Mistura Linear Convexa de Liga (Blending):**
   $$P_{\text{final}} = P_{\text{Poisson}} \times 0.70 + P_{\text{Liga\_FootyStats}} \times 0.30$$

---

### 3. AVALIAÇÃO DA QUALIDADE ESTATÍSTICA DO MOTOR

### **NOTA DA QUALIDADE ESTATÍSTICA: 5.5 / 10 (Regular / Intermediário Heurístico)**

#### A. Pontos Fortes (+5.5 Pontos):
- **Engenharia Limpa e Determinística:** Código bem estruturado no JavaScript, legível, reprodutível e livre de bugs de execução.
- **Uso Correto de Poisson para Over/Under:** A aplicação da Distribuição de Poisson (PMF e CDF) para converter expectativas numéricas ($\lambda$) em porcentagens é conceitualmente correta para contagens de eventos discretos.
- **Re-normalização Dinâmica de Pesos (`pesosDinamicos`):** Excelente mecanismo de tolerância a falhas que reajusta a soma dos pesos para 100% caso alguma estatística não seja informada.
- **Resistência Logarítmica (`resistencia`):** Boa sacada estatística para aplicar utilidade marginal decrescente via $\ln(1+x)$ e conter a inflação por times outliers.
- **Calibração Externa de Liga:** O blend de 30% com o histórico real do campeonato importado do FootyStats reduz discrepâncias em ligas muito atípicas.

#### B. Pontos Críticos e Limitações Estatísticas (-4.5 Pontos):
- **1. Ausência de Ajuste por Sobredispersão (Overdispersion):** A Distribuição de Poisson assume que a média é igual à variância ($\mu = \sigma^2$). Em mercados como Cartões e Faltas, a variância real é muito maior que a média ($\sigma^2 > \mu$). Utilizar Poisson nesses mercados distorce a cauda da distribuição. O correto seria utilizar a **Distribuição Binomial Negativa**.
- **2. Suposição de Independência Estrita em Gols (Falta de Ajuste Dixon-Coles):** O cálculo do 1X2 assume $P(X, Y) = P(X)P(Y)$. Em partidas reais de futebol, placares baixos ($0-0, 1-1, 1-0$) possuem forte dependência. A ausência de ajuste de covariância (Dixon-Coles $\tau(x,y)$) subestima a probabilidade de empates.
- **3. Pesos 100% Manuais / Heurísticos:** Todos os 68 pesos foram atribuídos intuitivamente pelo programador, sem otimização formal por **Máxima Verossimilhança (MLE)**, regressão ou backtesting automatizado.
- **4. Sem Ajuste por Força da Tabela / Forma Recente (Elo Rating):** O modelo trata um time enfrentando o líder do campeonato exatamente da mesma forma que trataria enfrentando o lanterna, pois analisa apenas as médias absolutas coladas.

---
Nenhum arquivo do código-fonte foi alterado durante esta auditoria.
