# RELATÓRIO TÉCNICO DE AUDITORIA — FASE 1.5
## CALIBRATION ENGINE — SPORTS PREDICTION SYSTEM

Nenhum arquivo foi alterado ou modificado. Esta auditoria analisa detalhadamente o funcionamento do módulo de calibração e registro de resultados reais do **Sports Predictor**.

---

### 1. VEREDITO TÉCNICO: APRENDIZADO REAL vs ARMAZENAMENTO HISTÓRICO

> [!IMPORTANT]
> **VEREDITO:** **NÃO EXISTE APRENDIZADO DE MÁQUINA (ML) OU RECALCULAGEM AUTOMÁTICA DE PESOS.**
> 
> O sistema opera exclusivamente com **armazenamento histórico estático** e **diagnóstico visual descritivo (passivo)**. Quando uma partida é concluída e os resultados reais são salvos, os dados são apenas persistidos no banco de dados. Nenhum peso, constante, threshold ou probabilidade é ajustado automaticamente pelo código.

---

### 2. RESUMO OBJETIVO DAS PERGUNTAS DA AUDITORIA

| Questão | Resposta | Detalhamento |
| :--- | :---: | :--- |
| **Recalcula pesos?** | **NÃO** | Os pesos permanecem 100% hardcoded em `predictionEngine.js`. |
| **Aprende (Machine Learning)?** | **NÃO** | Não há algoritmo de regressão, gradiente descendente ou update online. |
| **Apenas salva histórico?** | **SIM** | Atualiza a coluna `real_results` e o `status = "completed"` na tabela `matches`. |
| **Ajusta probabilidades?** | **NÃO** | As probabilidades calculadas na análise original permanecem estáticas no banco. |
| **Altera constantes?** | **NÃO** | As constantes (`APP_GLOBALS`, `LEAGUE_WEIGHT`, fatores de mando) continuam fixas. |
| **Recalcula thresholds?** | **NÃO** | Os limites de decisão (`0.75`, `0.65`, `0.78`, etc.) permanecem inalterados. |

---

### 3. FLUXO DETALHADO: O QUE ACONTECE QUANDO UM JOGO TERMINA

```
[1. O usuário acessa a rota /match/:id (MatchDetail.jsx)]
                         │
                         ▼
[2. O usuário preenche os campos numéricos em "Resultados Reais"]
    - corners_home / corners_away, goals_home / goals_away, etc.
                         │
                         ▼
[3. O usuário clica no botão "Salvar" (handleSaveReal)]
                         │
                         ▼
[4. Processamento Automático do Lado do Cliente (Client-side)]
    - Calcula totais automáticos: _total = _home + _away
    - Calcula BTTS automático: btts = (goals_home > 0 && goals_away > 0) ? 1 : 0
                         │
                         ▼
[5. Atualização no Supabase (base44.entities.Match.update)]
    - Executa UPDATE na tabela matches:
      UPDATE matches 
      SET real_results = { ... }, status = 'completed', updated_date = ISO_NOW()
      WHERE id = :id;
                         │
                         ▼
[6. Visualização do Dashboard de Calibração (CalibrationView.jsx)]
    - O usuário acessa a aba "Calibração" no Home.jsx
    - CalibrationView busca partidas com status = 'completed'
    - Agrupa partidas em blocos de 10 jogos (BLOCK_SIZE = 10)
    - Executa estatística descritiva em memória React (calcBloco)
    - Exibe Viés (Previsto − Real), MAE (Erro Absoluto Médio) e Win Rate %
```

---

### 4. COMPONENTES E ARQUIVOS ENVOLVIDOS

#### A. Ingestão e Persistência do Resultado Real
- **Arquivo:** [`src/pages/MatchDetail.jsx`](file:///c:/appo/src/pages/MatchDetail.jsx#L36-L77)
- **Função:** `handleSaveReal()`
- **Comportamento:** Captura os inputs de formulário `realResults`, calcula agregados somados (`corners_total`, `goals_total`, `shots_total`, `cards_total`, `fouls_total`, `saves_total`, `totalshots_total`) e deriva a flag booleana de BTTS (`btts = (gh > 0 && ga > 0) ? 1 : 0`). Atualiza a partida via API `base44.entities.Match.update()`.

#### B. Painel Diagnóstico de Calibração (Auditoria Manual)
- **Arquivo:** [`src/components/stats/CalibrationView.jsx`](file:///c:/appo/src/components/stats/CalibrationView.jsx#L5-L69)
- **Funções:** `CalibrationView()` e `calcBloco(matches)`
- **Comportamento:** Carrega as partidas concluídas via `base44.entities.Match.list("-date", 200)`, separa em blocos de 10 jogos e calcula em memória:
  - **Média Prevista:** $\bar{P} = \frac{1}{N} \sum P_i$
  - **Média Real:** $\bar{R} = \frac{1}{N} \sum R_i$
  - **Viés (Bias):** $\text{Viés} = \bar{P} - \bar{R}$ (Positivo = Modelo superestima; Negativo = Modelo subestima).
  - **MAE (Mean Absolute Error):** $\text{MAE} = \frac{1}{N} \sum |P_i - R_i|$
  - **Win Rate %:** % de acertos da linha principal ($X.5$).
  - **Classificação Visual:**
    - $|\text{Viés}| < 0.30$ ➔ `"✓ Calibrado"` (verde)
    - $0.30 \le |\text{Viés}| < 0.70$ ➔ `"⚠ Leve viés"` (amarelo)
    - $|\text{Viés}| \ge 0.70$ ➔ `"✗ Revisar"` (vermelho)

---

### 5. PROVA DE CÓDIGO: CONFIRMAÇÃO DE AUSÊNCIA DE APRENDIZADO AUTOMÁTICO

A ausência de recalculagem ou aprendizado automático é evidenciada pela própria documentação interna presente no componente [`CalibrationView.jsx`](file:///c:/appo/src/components/stats/CalibrationView.jsx#L178-L182):

```jsx
// Trecho retirado de src/components/stats/CalibrationView.jsx (linhas 177-183):

<div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
  <p className="text-xs text-amber-800">
    <strong>Lembrete:</strong> os pesos do modelo são hipóteses manuais, não calibrados por dados. 
    Com 30+ jogos você já consegue identificar se algum mercado está sistematicamente errado. 
    Com 100+ jogos, vale ajustar os pesos no código.
  </p>
</div>
```

Além disso, em [`src/lib/leagueAdjustment.js`](file:///c:/appo/src/lib/leagueAdjustment.js#L12-L13):

```javascript
// Trecho retirado de src/lib/leagueAdjustment.js (linhas 12-13):

// Médias globais do app (recalcular manualmente a cada ~50 jogos)
// Representa a média de TODOS os jogos já analisados no app
export const APP_GLOBALS = {
  avg_goals:   2.69,
  avg_corners: 9.67,
  avg_cards:   2.94,
};
```

Ambos os trechos confirmam que qualquer calibração ou reajuste de pesos exige **intervenção humana manual diretamente no código-fonte JS**.

---

### 6. ESTRUTURA NO BANCO DE DADOS & CAMPOS UTILIZADOS

- **Banco de Dados:** Supabase PostgreSQL
- **Tabela Primária:** `matches` ([`src/api/base44Client.js:60`](file:///c:/appo/src/api/base44Client.js#L60))

#### Esquema de Campos Relacionados à Calibração:

| Campo | Tipo no Supabase | Descrição / Conteúdo |
| :--- | :--- | :--- |
| `id` | `uuid` / `text` | Identificador único da partida |
| `status` | `text` | Status da partida: `"pending"` (criada) ou `"completed"` (com resultado real) |
| `results` | `json` / `jsonb` | Objeto contendo os xValores e probabilidades gerados na análise original |
| `real_results` | `json` / `jsonb` | Objeto contendo os valores reais pós-jogo digitados pelo usuário |
| `updated_date` | `timestamp` / `iso` | Data e hora do registro do resultado real |

#### Estrutura Interna do Objeto `real_results` (JSON):
```json
{
  "corners_home": 6,
  "corners_away": 4,
  "corners_total": 10,
  "goals_home": 2,
  "goals_away": 1,
  "goals_total": 3,
  "shots_home": 5,
  "shots_away": 3,
  "shots_total": 8,
  "cards_home": 2,
  "cards_away": 3,
  "cards_total": 5,
  "fouls_home": 12,
  "fouls_away": 14,
  "fouls_total": 26,
  "saves_home": 2,
  "saves_away": 3,
  "saves_total": 5,
  "totalshots_home": 14,
  "totalshots_away": 10,
  "totalshots_total": 24,
  "btts": 1
}
```

---
Nenhum arquivo do código-fonte foi alterado durante esta auditoria.
