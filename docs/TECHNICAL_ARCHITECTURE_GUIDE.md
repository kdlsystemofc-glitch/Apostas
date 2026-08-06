# SPORTS PREDICTOR V2 — GUIA TÉCNICO E MANIFESTO DE ARQUITETURA
## TECHNICAL ARCHITECTURE & DEVELOPER HANDOVER GUIDE

---

## 1. Clean Architecture de 5 Camadas

O **Sports Predictor V2** adota uma Clean Architecture estrita:

1. **`src/domain/`:** Motor probabilístico puro ([`src/lib/predictionEngine.js`](file:///c:/appo/src/lib/predictionEngine.js)). Módulo JavaScript síncrono com zero dependências de DOM, React ou banco de dados.
2. **`src/services/`:** Padrão Repository ([`src/services/supabase/matchRepository.js`](file:///c:/appo/src/services/supabase/matchRepository.js)) e Ingestão de Dados ([`src/services/parsers/statsHubParser.js`](file:///c:/appo/src/services/parsers/statsHubParser.js)).
3. **`src/store/`:** Lojas reativas de estado global com **Zustand** ([`src/store/useMatchStore.js`](file:///c:/appo/src/store/useMatchStore.js) e [`src/store/useBankrollStore.js`](file:///c:/appo/src/store/useBankrollStore.js)).
4. **`src/hooks/`:** Hooks de abstração de UI.
5. **`src/components/` & `src/pages/`:** Componentes de apresentação com *Dark Glassmorphism* e Code-Splitting via `React.lazy()` no [`src/App.jsx`](file:///c:/appo/src/App.jsx).

---

## 2. Executando os Testes Automatizados

A aplicação possui **19 testes unitários e estatísticos** que cobrem primitivas matemáticas, matriz Dixon-Coles, sobredispersão NB2 e viés global.

```bash
# Executar a suíte Vitest
npx vitest run
```

---

## 3. Compilação de Produção e Otimização de Chunks

Para evitar estouro de tamanho de bundle público, as rotas foram divididas via `React.lazy()`. O chunk JS principal é compilado com menos de **$470\text{ kB}$**:

```bash
# Executar build de produção Vite
npm run build
```
