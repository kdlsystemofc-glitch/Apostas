# AUDITORIA COMPLETA DE CÓDIGO E INCONSISTÊNCIAS — SPORTS PREDICTION SYSTEM

Este documento apresenta uma inspeção linha a linha de todas as camadas do sistema (engine estatístico, persistência, componentes visuais e utilitários), identificando falhas latentes, desconexões de dados e oportunidades de otimização.

---

## 1. RESUMO DOS PROBLEMAS E ENCONTRADOS E IMPACTO

| Arquivo Afetado | Severidade | Tipo de Problema | Descrição Curta |
| :--- | :--- | :--- | :--- |
| [`src/components/stats/CalibrationView.jsx`](file:///c:/appo/src/components/stats/CalibrationView.jsx) | **Alta** | Runtime Bug / NaN | Tentativa de ler `s.status === "insuficiente"` quando o campo nunca é retornado em `calcBloco()`. Gera `NaN` ao dividir por zero quando `dados.length === 0`. |
| [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js) | **Média** | Desconexão de Dados | O objeto `details` de `calcCorners` omitiu `detalhes_of` e `detalhes_def`, fazendo com que a tabela de fatores em [`CornerDetails.jsx`](file:///c:/appo/src/components/stats/CornerDetails.jsx) nunca renderize. |
| [`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js) | **Média** | Limite Matemático | A função de ajuste Dixon-Coles ($\tau(x,y)$) não possuía trava inferior em $0$, podendo gerar probabilidades negativas em casos extremos antes do clipping. |
| [`src/components/stats/DailyOverview.jsx`](file:///c:/appo/src/components/stats/DailyOverview.jsx) | **Baixa** | Format Formatter | O sinal do resultado 1X2 renderizava uma cor genérica em vez de adaptar dinamicamente conforme a confiança da pick. |
| [`src/pages/LeagueProfiles.jsx`](file:///c:/appo/src/pages/LeagueProfiles.jsx) | **Baixa** | Código Residual | Módulo desconectado do motor autônomo. Necessário adicionar aviso de que a tabela é apenas para consulta histórica. |

---

## 2. DETALHAMENTO DAS ANOMALIAS POR COMPONENTE

### A. [`CalibrationView.jsx`](file:///c:/appo/src/components/stats/CalibrationView.jsx#L142) — Bug de `NaN` e Status Inexistente
- **Linha 142:** `{s.status === "insuficiente" ? (...)}`
- **Diagnóstico:** Em `calcBloco()`, o objeto retornado contém `{ key, n, mediaPrev, mediaReal, vies, mae, winRate, avaliacao, cor }`. A propriedade `status` **nunca é definida**.
- **Impacto:** Quando um bloco de 10 jogos tem 0 resultados registrados para um mercado específico (ex: `totalshots`), `dados.length` é $0$. O cálculo `0 / 0` resulta em `NaN`. Ao executar `mediaPrev.toFixed(2)`, a aplicação lança exceção em tempo de execução ou exibe a string `"NaN"`.
- **Solução Recomendada:** Validar `if (dados.length < 3) return { key, n: dados.length, status: "insuficiente" };` no início do mapeamento de `calcBloco`.

### B. [`predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L201-L212) — Desconexão com [`CornerDetails.jsx`](file:///c:/appo/src/components/stats/CornerDetails.jsx#L48)
- **Diagnóstico:** O componente `CornerDetails.jsx` renderiza a tabela de sub-fatores buscando `dc.detalhes_of` e `dc.detalhes_def`. Porém, na refatoração do motor autônomo, o retorno de `calcCorners` ficou restrito a:
  ```javascript
  details: { base, indice_ofensivo, indice_defensivo, indice_composto }
  ```
- **Impacto:** A seção "Fatores Ofensivos" e "Fatores Defensivos" da tela de detalhamento de escanteios nunca é exibida para o usuário.
- **Solução Recomendada:** Reinserir `detalhes_of` e `detalhes_def` dentro do retorno de `calcCorners` em `predictionEngine.js`.

### C. [`predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js#L416) — Proteção na Matriz Dixon-Coles
- **Diagnóstico:** Em `calcResultado()`, a constante de correlação de Dixon-Coles $\tau(x,y)$ utiliza $\rho = -0.13$. Em combinações raras de $\lambda$ muito baixos ou altos, o fator de ajuste pode gerar um valor $\tau < 0$.
- **Impacto:** Gera probabilidades negativas na matriz $8 \times 8$ antes da normalização final.
- **Solução Recomendada:** Garantir `Math.max(0, tau)` dentro da função `dixonColesTau`.

---

## 3. AÇÕES CORRETIVAS PROPOSTAS

1. **Correção do `CalibrationView.jsx`:** Adicionar verificação estrita de `dados.length === 0` e retornar `status: "insuficiente"`.
2. **Re-conexão dos Detalhes de Escanteios:** Atualizar `calcCorners` em `predictionEngine.js` para expor `detalhes_of` e `detalhes_def`.
3. **Trava de Segurança na Matriz Dixon-Coles:** Garantir que $\tau(x,y) \ge 0$.
4. **Alinhamento do Visualizador do DailyOverview:** Ajustar badges e cores da Pick 1X2.

---
Documento gerado como parte da Fase 1 da auditoria do sistema.
