# ESPECIFICAÇÃO TÉCNICA MESTRE E GUIA COMPLETO PARA INTELIGÊNCIA ARTIFICIAL
## MASTER AI SPECIFICATION & HANDOVER GUIDE FOR SPORTS PREDICTOR V2

> **AVISO IMPORTANTE PARA OUTRAS IAs / DESENVOLVEDORES:** Este é o **documento definitivo e unificado** sobre o sistema **Sports Predictor V2**. Ele reúne toda a engenharia reversa, matemática estatística, dicionário completo de estatísticas do StatsHub, cruzamento de parâmetros ofensivos/defensivos, Binomial Negativa (NB2), Ambas Marcam Bivariado, Handicaps Asiáticos, Gestão Quarter-Kelly em R$, Clean Architecture (5 camadas), Zustand Stores, Supabase Repository Pattern, Design System Dark Glassmorphism, 1-Second Glance Decision Card e conformidade com acessibilidade WCAG 2.1 AA. NENHUMA informação foi omitida.

---

## 1. DESIGN SYSTEM & INTERFACE PREMIUM (DARK GLASSMORPHISM)

O **Sports Predictor V2** utiliza uma estética visual de nível profissional inspirada em terminais quantitativos de alta frequência:

- **Fundo / Canvas:** `#090d16` (Slate 950 Deep).
- **Cards e Superfícies:** `#131b2e` (Slate 900 Glass com `backdrop-blur-md` e borda `#1e293b`).
- **Hero Decision Card ("Pick Principal do Modelo"):**
  - Implementa o **1-Second Glance Test**: em menos de 1 segundo o usuário visualiza:
    - 🎯 Aposta Recomendada (1X2)
    - 📈 Confiança %
    - 💎 Odd Justa ($1/P$)
    - 🔥 EV+ Real (%)
    - 💰 **Stake Sugerida em Reais (R$)** via Quarter-Kelly.
- **`BankrollWidget.jsx`:** Permite configurar a Banca Total em R$ e a fração de Kelly diretamente no Header.

---

## 2. ARQUITETURA DE 5 CAMADAS (CLEAN ARCHITECTURE)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DOMAIN LAYER (src/domain/ & src/lib/predictionEngine.js)                │
│ • Motor probabilístico síncrono puro (zero dependência de React/UI).        │
│ • Poisson, Binomial Negativa NB2, Dixon-Coles Bivariado, Quarter-Kelly.     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. SERVICES & REPOSITORY LAYER (src/services/supabase & parsers)            │
│ • MatchRepository: Abstração CRUD de partidas e perfis no Supabase.         │
│ • statsHubParser: Serviço de ingestão e relatório visual de erros no texto. │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. STATE & DATA FETCHING LAYER (src/store/)                                 │
│ • useMatchStore (Zustand): Estado global de partidas ativas e histórico.    │
│ • useBankrollStore (Zustand): Gestão de banca em R$ e fração Kelly.         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. HOOKS LAYER (src/hooks/)                                                 │
│ • Abstrações de cálculo memoizado, sincronização e gestão de risco.         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. PRESENTATION LAYER (src/components/ & src/pages/)                        │
│ • BankrollWidget, MatchResultBlock, MarketBlock com Dark Glassmorphism.    │
│ • Code-Splitting com React.lazy() no App.jsx (Bundle inicial < 470 kB).      │
│ • ErrorBoundary global de resiliência visual.                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. PARSER E DICIONÁRIO COMPLETO DAS ESTATÍSTICAS DO STATSHUB

O parser `parseStatsHubText(text)` lê a tabela de estatísticas colada e extrai os valores numéricos. Cada estatística no StatsHub traz duas colunas essenciais:
- **`t` (Team / Feito):** Média por jogo produzida pelo próprio time.
- **`c` (Conceded / Cedido):** Média por jogo concedida pelo time ao adversário.

### Tabela Mestra de Mapeamento (`STAT_MAP`):

| Nome Original no StatsHub | Chave Interna | Função no Cruzamento V2 |
| :--- | :--- | :--- |
| **Goals** | `goals` | Base da expectativa de gols ($xG$). |
| **Corners** | `corners` | Base do cálculo de escanteios ($xC$). |
| **Cards** | `cards` | Base de cartões via Binomial Negativa (NB2). |
| **Yellow Cards** | `yellow_cards` | Fator dominante (35%) em cartões. |
| **Red Cards** | `red_cards` | Indisciplina complementar. |
| **Expected Goals (xG)** | `xg` | Fator dominante (25%) em gols. |
| **Shots On Target** | `shots_on_target` | Fator decisivo em Gols, Cantos, Chutes no Gol e Defesas. |
| **Shots In The Box** | `shots_in_box` | Indicador de presença na área. |
| **Total Shots** | `total_shots` | Medida de volume ofensivo geral. |
| **Clearances** | `clearances` | Fator defensivo de resistência (40%). |
| **Goalkeeper Saves** | `gk_saves` | Defesas efetuadas pelo goleiro. |
| **Fouls** | `fouls` | Faltas via Binomial Negativa (NB2, $r=12.0$). |
| **Tackles** | `tackles` | Fator de combate físico. |
| **Interception Won** | `interceptions` | Faltas táticas / cortes de passe. |

---

## 4. O CRUZAMENTO MATEMÁTICO E MOTOR V2

### 4.1 Primitivas Matemáticas V2

1. **Bayesian Shrinkage (`bayesianShrinkage`):**
   $$\lambda_{\text{bayes}} = \left(\frac{n}{n + 10}\right) \lambda_{\text{obs}} + \left(1 - \frac{n}{n + 10}\right) \mu_{\text{liga}}$$

2. **Âncora de Equilíbrio (`ancora`):**
   $$A(\text{atk}, \text{def}) = \frac{\text{atk.faz} + \text{def.cede}}{2}$$

3. **Índice de Intensidade Relativa (`indice`):**
   $$I(f, c) = \frac{f}{(f + c) / 2}$$

4. **Resistência Defensiva Logarítmica (`resistencia`):**
   $$R(\text{cedidoDef}, \text{feitoAtk}) = \min\left(\frac{\ln(1 + \text{cedidoDef})}{\ln(1 + \text{feitoAtk})}, 2.0\right)$$

5. **Distribuição Binomial Negativa (`negativeBinomialOver`):**
   $$P(Y = k) = \exp\left(\ln\Gamma(k + r) - \ln\Gamma(r) - \ln(k!) + r \ln p + k \ln(1 - p)\right), \quad p = \frac{r}{r + \lambda}$$

6. **Gestão de Risco Quarter-Kelly (`calcularQuarterKelly`):**
   $$f^* = \max\left(0, \, 0.25 \times \frac{P \cdot \text{Odd}_{\text{casa}} - 1}{\text{Odd}_{\text{casa}} - 1}\right)$$

---

## 5. LINHAS COMERCIAIS REAIS (`COMMERCIAL_LINES`)

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

## 6. BANCO DE DADOS SUPABASE & RLS

- Tabela `matches` protegida por **Row Level Security (RLS)** via `supabase/schema.sql`.

---
Este documento consolida 100% da arquitetura V2 do **Sports Predictor**, servindo como fonte única da verdade para Agentes de IA e Desenvolvedores.
