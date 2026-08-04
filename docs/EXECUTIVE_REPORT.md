# RELATÓRIO TÉCNICO EXECUTIVO DE AUDITORIA — FASE 1.8
## EXECUTIVE ARCHITECTURE & MATHEMATICAL AUDIT REPORT
### SPORTS PREDICTION SYSTEM

---

### 1. COMO O SISTEMA REALMENTE FUNCIONA

O **Sports Predictor** é uma aplicação React 18 / Vite baseada em um **motor estatístico determinístico de índices heurísticos ponderados e distribuição univariada de Poisson**.

```
[Entrada de Dados Brutos (StatsHub / Excel)]
                 │
                 ▼
[Parsing e Sanitização (parseStatsHubText)]
                 │
                 ▼
[Motor de Cálculo Core (predictionEngine.js)]
 ├── Índices de Intensidade (indice) e Resistência Logarítmica (resistencia)
 ├── Agregação Multifatorial com Pesos Hardcoded (68 parâmetros)
 ├── Multiplicadores Fixos de Mando de Campo
 └── Estimativa de Valores Esperados (lambda) por Mercado
                 │
                 ▼
[Camada de Ajuste e Calibração (leagueAdjustment.js)]
 ├── Fator Logarítmico por Campeonato (fatorLiga em [0.80, 1.20])
 └── Blend Linear Convexo (calibrarProb: 70% Modelo Poisson + 30% Histórico Liga)
                 │
                 ▼
[Motor de Classificação e Ranking (BestBetsByMarket.jsx)]
 ├── Classificação de Sinais (FORTE OVER, OVER, NEUTRO, UNDER, FORTE UNDER)
 └── Algoritmo bestLine (Score penalizado por distância de linha)
                 │
                 ▼
[Persistência e Armazenamento (base44Client.js -> Supabase PostgreSQL)]
 └── Salva análise inicial (results) e resultados reais pós-jogo (real_results)
```

**Conclusão de Funcionamento:** Não há inteligência artificial, regressão automatizada ou redes neurais. O sistema transforma médias recentes coladas em esperanças matemáticas ($\lambda$), calcula probabilidades acumuladas por Poisson, aplica ajustes de liga e seleciona a melhor aposta por pontuação heurística.

---

### 2. PONTOS FORTES

1. **Engenharia de Software Limpa e Reprodutível:** Código modular em JavaScript, bem formatado, livre de loops infinitos e totalmente determinístico.
2. **Resiliência a Dados Ausentes (`pesosDinamicos`):** Se alguma estatística não for informada no texto colado, o sistema filtra a métrica e recalcula a proporção dos pesos restantes para somarem 100%, evitando quebras ou escalas distorcidas.
3. **Conversão Correta de Esperança em Probabilidade:** O uso da Função de Distribuição Acumulada (CDF) de Poisson (`poissonOver`) para transformar $\lambda$ em probabilidade de Over/Under é a abordagem estatística adequada para contagem de eventos discretos.
4. **Compressão Logarítmica Defensiva (`resistencia`):** Aplicação de $\ln(1+x)$ com trava de teto (`cap = 2.0`) para conter o impacto desproporcional de times com estatísticas extremas (outliers).
5. **Ancoragem Híbrida com Perfis de Liga (`LEAGUE_WEIGHT = 0.30`):** Reduz o risco de previsões absurdas ao calibrar 30% da probabilidade com a frequência histórica real do campeonato importado do FootyStats.

---

### 3. PONTOS FRACOS

1. **Pesos 100% Manuais e Arbitrários:** Todos os 68 pesos e coeficientes do sistema foram atribuídos por intuição do desenvolvedor, sem ajuste por Máxima Verossimilhança (MLE) ou validação empírica em banco de dados histórico.
2. **Ausência de Contexto de Força / ELO / Tabela:** O modelo não considera o nível do adversário. Enfrentar o líder do campeonato ou o lanterna produz a mesma previsão se as médias coladas forem idênticas.
3. **Constantes Globais Estáticas (`APP_GLOBALS`):** As médias de referência (2.69 gols, 9.67 escanteios, 2.94 cartões) exigem alteração manual no código-fonte a cada 50 jogos.
4. **Ausência de Aprendizado Automático Pós-Jogo:** O módulo de "Calibração" apenas salva os resultados reais na tabela `matches`, sem atualizar pesos ou parâmetros no banco de dados.
5. **Vulnerabilidade ao Mando de Campo Específico:** Embora a tabela `league_profiles` guarde as médias de cantos/gols dos mandantes da liga (`avg_corners_home`), o cálculo da previsão ignora esses dados e usa multiplicadores universais hardcoded ($1.18$, $1.08$, $0.92$).

---

### 4. ERROS MATEMÁTICOS ENCONTRADOS

#### A. Presunção de Independência Estrita em Gols no Mercado 1X2
- **Localização:** [`src/lib/predictionEngine.js:415-423`](file:///c:/appo/src/lib/predictionEngine.js#L415-L423)
- **Falha Matemática:** O modelo calcula $P(X=i, Y=j) = P(X=i) \cdot P(Y=j)$, assumindo independência total entre os gols do mandante e do visitante. No futebol real, gols são correlacionados (especialmente em jogos truncados com empates em $0-0$ e $1-1$). Esta falha **subestima sistematicamente a probabilidade de empate** no mercado 1X2.

#### B. Instabilidade na Razão Logarítmica de Resistência
- **Localização:** [`src/lib/predictionEngine.js:120`](file:///c:/appo/src/lib/predictionEngine.js#L120)
- **Falha Matemática:** Na fórmula $\frac{\ln(1 + \text{cedidoDef})}{\ln(1 + \text{feitoAtk})}$, quando $\text{feitoAtk}$ é um valor decimal próximo de zero (ex: $0.1$), o denominador aproxima-se de zero ($\ln(1.1) \approx 0.095$), fazendo o quociente inflar desproporcionalmente e atingir o teto `2.0` de forma artificial.

#### C. Violação de Axiomas Probabilísticos no Desconto de BTTS
- **Localização:** [`src/lib/predictionEngine.js:296-298`](file:///c:/appo/src/lib/predictionEngine.js#L296-L298)
- **Falha Matemática:** Multiplicar a probabilidade conjunta $P(A \cap B)$ por um fator sigmoidal empírico $0.62 + 0.36 / (1 + e^{-1.3(xG-2.8)})$ é uma manipulação algébrica sem respaldo na teoria dos conjuntos probabilísticos, podendo gerar inconsistências com as probabilidades marginais $P(A)$ e $P(B)$.

---

### 5. ERROS ESTATÍSTICOS ENCONTRADOS

#### A. Violação da Equi-dispersão de Poisson ($\mu = \sigma^2$) em Cartões e Faltas
- **Falha Estatística:** A Distribuição de Poisson pressupõe rigorosamente que a média é igual à variância. Mercados de indisciplina (cartões e faltas) possuem alta sobredispersão ($\sigma^2 \gg \mu$). O uso de Poisson nesses mercados afunila a distribuição, **subestimando severamente as probabilidades nas caixas (Over altos e Under baixos)**.

#### B. Vício de Amostragem Pequena (Small Sample Bias / Overfitting)
- **Falha Estatística:** As estatísticas coladas representam amostras pequenas (últimos 5 a 10 jogos). O sistema não aplica **Shrinkage Bayesiano** (Regressão à Média da Liga / Estimação de James-Stein), fazendo com que sequências atípicas temporárias distorçam radicalmente a expectativa matemática.

#### C. Ignorância das Médias Reais de Mando da Liga Importada
- **Falha Estatística:** O formulário importa o CSV do FootyStats com campos precisos como `avg_corners_home` e `avg_corners_away`. No entanto, o motor descarta essas médias reais e aplica constantes arbitrárias ($+18\%$ para cantos casa, $+8\%$ para gols casa).

---

### 6. MERCADOS POCO CONFIÁVEIS (NÃO RECOMENDADOS PARA APOSTAS REAIS)

1. **Chutes Totais (`calcTotalShots`):** Rotulado no próprio código como `lowConfidence: true` ("em recalibração — baixa confiabilidade"). Possui fraca correlação defensiva e alta volatilidade.
2. **Faltas (`calcFaltas`):** Possui aviso de código: `"⚠ Mercado com alta variância — sinais removidos das recomendações automáticas"`. Depende excessivamente do critério do árbitro e do clima do jogo, não das médias dos times.
3. **Cartões (`calcCartoes`):** Prejudicado pela sobredispersão de Poisson. Sofre forte interferência do perfil do árbitro e postura tática do jogo.
4. **Empate / 1X2 (`calcResultado`):** Taxa de acerto comprometida pela ausência do fator de correlação de Dixon-Coles para empates.

---

### 7. MERCADOS CONFIÁVEIS (BOA CORRELAÇÃO E ESTABILIDADE)

1. **Escanteios Total e Por Time (`calcCorners`):** O mercado mais sólido do sistema. Possui 10 fatores cruzados de forte correlação estatística (chutes na área, cruzamentos, defesas do goleiro).
2. **Gols Total e Por Time (`calcGols`):** Apresenta excelente estrutura ponderada (xG, Big Chances, Chutes no Gol) e se beneficia bastante do blend com a liga.
3. **Chutes no Gol (`calcShotsOnTarget`):** Relação direta e estável entre volume ofensivo e defesas exigidas dos goleiros.

---

### 8. ALGORITMOS QUE DEVERIAM SER SUBSTITUÍDOS

| Algoritmo Atual | Algoritmo Substituto Recomendado | Benefício Técnico |
| :--- | :--- | :--- |
| **Poisson Independente 1X2** | **Modelo Bivariado de Dixon-Coles** | Adiciona o parâmetro de correção $\tau(x,y)$ para inflacionar corretamente empates e placares baixos ($0-0, 1-1$). |
| **Poisson para Cartões/Faltas** | **Distribuição Binomial Negativa** | Incorpora o parâmetro de dispersão $\phi$, ajustando a variância real ($\sigma^2 > \mu$) e corrigindo as caixas. |
| **Pesos Manuais Hardcoded** | **Regressão Logística / Otimização MLE** | Ajusta estatisticamente os 68 pesos através de Máxima Verossimilhança sobre um dataset histórico real. |
| **Ranking Heurístico `bestLine`** | **Cálculo de EV+ & Critério de Kelly** | Compara a probabilidade estimada com as Odds reais da casa: $EV = (P \cdot \text{Odd}) - 1$, ranqueando apostas por valor esperado real. |

---

### 9. MELHORIAS RECOMENDADAS

1. **Introdução de Rating ELO / Glicko2:** Incorporar a força relativa do oponente para ponderar o peso dos 5 jogos recentes.
2. **Uso das Médias de Mando do CSV FootyStats:** Substituir os multiplicadores fixos ($1.18, 1.08$) pelas médias reais de mandante/visitante (`avg_corners_home`, `avg_goals_home`) presentes na tabela `league_profiles`.
3. **Inclusão da Estatística do Árbitro:** Adicionar o nome/média de cartões do árbitro da partida na fórmula de `calcCartoes()` e `calcFaltas()`.
4. **Shrinkage Bayesiano:** Ponderar a amostra pequena do time com a média da liga: $\lambda_{\text{ajustado}} = \frac{n}{n + k} \bar{X}_{\text{time}} + \frac{k}{n + k} \bar{X}_{\text{liga}}$.

---

### 10. ROADMAP COMPLETO PARA NÍVEL PROFISSIONAL (PROFESSIONAL-GRADE ECOSISTEM)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 1: RECONSTRUÇÃO DA BASE MATEMÁTICA (Semanas 1-2)                      │
│ • Implementar Modelo Bivariado de Dixon-Coles para 1X2 e Placares.          │
│ • Implementar Distribuição Binomial Negativa para Cartões e Faltas.         │
│ • Aplicar Shrinkage Bayesiano (Regressão à Média da Liga).                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 2: AUTOMAÇÃO DA PIPELINE DE DADOS (Semanas 3-4)                        │
│ • Substituir colar manual de texto por integração via API (Football-Data).  │
│ • Estruturar tabela de Árbitros e Ratings ELO automáticos das equipes.      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 3: OTIMIZAÇÃO E TREINAMENTO DE MODELOS (Semanas 5-6)                    │
│ • Treinar pesos por Máxima Verossimilhança (MLE) ou XGBoost em 50.000 jogos.│
│ • Validação cruzada com Brier Score, Log Loss e ROC-AUC.                    │
│ • Auto-aprendizado online pós-jogo (SGD Weight Updating no Supabase).       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 4: ENGINE DE APOSTAS VALOR ESPERADO (EV+) & GEFA (Semanas 7-8)         │
│ • Ingestão automática de Odds em tempo real via API (Bet365 / Pinnacle).    │
│ • Cálculo de Expected Value: EV = (Prob_Modelo * Odds) - 1.                 │
│ • Gestão de Banca automatizada via Critério de Kelly Fracionado (1/4 Kelly). │
└─────────────────────────────────────────────────────────────────────────────┘
```

---
Nenhum arquivo do código-fonte foi alterado durante esta auditoria.
