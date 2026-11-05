# INK Studio Pro 🎨🖋️

Sistema de Gestão Completo para Estúdios de Tatuagem, Body Piercing e Artistas Independentes.

Desenvolvido com **React 19**, **TypeScript**, **Tailwind CSS**, **Vite** e suporte para Notificações PWA / Web Push.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18.x, 20.x ou superior recomendada)
- Gestor de pacotes `npm`, `pnpm` ou `bun`

### 1. Instalar as dependências
Abre a consola ou terminal na pasta raiz do projeto descompactado e executa:

```bash
npm install
```

### 2. Iniciar o servidor de desenvolvimento
Executa o comando:

```bash
npm run dev
```

O servidor iniciará em `http://localhost:3000` (ou na porta indicada no terminal). Abre o teu browser nessa morada!

### 3. Compilar para Produção
Para gerar a versão otimizada pronta para colocar em qualquer alojamento estático (Vercel, Netlify, Firebase Hosting, Cloudflare Pages, etc.):

```bash
npm run build
```

Os ficheiros finais serão gerados na pasta `dist/`.

---

## 🔐 Base de dados e acesso (Firebase)

Os dados do estúdio (stock, clientes, marcações, artistas, definições) ficam no **Cloud Firestore**, partilhados entre todos os dispositivos e disponíveis offline. Só entram contas Google que estejam na lista de membros do estúdio.

### Configuração inicial (uma vez)

1. Na [consola do Firebase](https://console.firebase.google.com/), abre o projeto (por omissão `gen-lang-client-0172609399`, o que o AI Studio criou).
2. **Authentication → Sign-in method:** ativa o fornecedor **Google**.
3. **Authentication → Settings → Authorized domains:** adiciona o domínio onde a app vai estar (ex.: `ink-studio.pages.dev`).
4. **Firestore Database:** cria a base de dados (modo produção, região `europe-west`).
5. Publica as regras de segurança:
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules
   ```
6. Em **Firestore → Data**, cria a coleção `studios` com o documento `main` e estes campos:
   - `name` (string): nome do estúdio
   - `members` (array de strings): os e-mails Google autorizados, **em minúsculas**

   Para dar ou tirar acesso a alguém, edita esta lista.
7. Abre a app e entra com uma conta da lista. Na primeira vez podes importar os dados guardados nesse browser pela versão anterior, começar do zero ou carregar dados de exemplo.

### Usar outro projeto Firebase

Copia `.env.example` para `.env.local` e preenche as variáveis `VITE_FIREBASE_*`. Atualiza também o `.firebaserc`.

### Desenvolvimento e testes locais

```bash
npm run test:rules   # testa as regras de segurança no emulador (precisa de Java)
npm run emulators    # emuladores de Auth + Firestore para desenvolvimento
VITE_USE_FIREBASE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-ink-studio npm run dev
```

## 🌐 Backoffice do site (separador "Site & Portfólio")

A app gere o conteúdo do site público:

- **Portfólio** (Tattoo, Drawing, Art, Flash) por artista: fotos com título, estilo, publicado/rascunho, destaque e ordem.
  Os flashes têm número, tamanho, sessões, preço "desde" e se ainda estão disponíveis.
- **Loja:** originais (peça única), edições limitadas (com stock) e merch (link para a loja de print-on-demand).
  Originais e edições pagam-se no site com Stripe; o stock é descontado sozinho.
- **Encomendas:** as compras pagas no site, com morada de envio, para marcar como enviadas (com tracking).
- **Pedidos de marcação:** o formulário do site cria pedidos por artista; ao aceitar, o cliente é criado na ficha de clientes.
- **Estúdio & artistas:** nome, frase, bio, contactos, horário e o perfil público de cada artista (`meta/public`).

O site lê tudo diretamente do Firestore (só o que está publicado, ver `firestore.rules`).

### Fotos (Cloudflare R2)

As fotos são guardadas num bucket R2 através das Pages Functions em `functions/`:
`POST /api/images` (só membros do estúdio), `DELETE /api/images/<chave>` e `GET /img/<chave>` (público).
A app reduz as fotos para 2000px em WebP antes de as enviar.

1. No Cloudflare: **R2 → Create bucket** com o nome `arant-images`.
2. No projeto Pages da app: **Settings → Bindings → R2 bucket**, variável `IMAGES` → `arant-images`
   (ou usa o `wrangler.toml`, que já tem isto configurado).
3. Se o site estiver noutro domínio e precisar de chamar a API, junta-o a `ALLOWED_ORIGINS` no `wrangler.toml`.

Para testar localmente: `npm run build && npm run pages:dev` (API em `http://127.0.0.1:8788`; o `npm run dev` reencaminha `/api` e `/img` para lá).

### Pagamentos da loja (Stripe)

O carrinho do site chama `POST /api/checkout` com `{ items: [{ id, qty }], successUrl, cancelUrl }`.
A função reserva o stock no Firestore (numa única escrita atómica, por isso duas pessoas nunca compram a
última cópia), abre uma sessão Stripe Checkout e devolve `{ url }`. A reserva dura 30 minutos:

- pagamento concluído → o webhook cria a encomenda em `orders` e marca os originais como vendidos;
- sessão expirada ou pagamento falhado → o webhook devolve o stock.

Configuração (uma vez):

1. **Conta de serviço Google:** Firebase Console → Definições do projeto → Contas de serviço → *Gerar nova chave privada*.
   Guarda o JSON inteiro como segredo `GOOGLE_SERVICE_ACCOUNT` no Cloudflare (Pages → Settings → Variables and Secrets → *Encrypt*).
2. **Stripe:** copia a chave secreta (`sk_live_…`, ou `sk_test_…` para testar) para o segredo `STRIPE_SECRET_KEY`.
3. **Webhook:** Stripe → Developers → Webhooks → *Add endpoint* com o URL `https://<app>/api/stripe-webhook` e os eventos
   `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded` e
   `checkout.session.async_payment_failed`. Copia o *signing secret* (`whsec_…`) para o segredo `STRIPE_WEBHOOK_SECRET`.
4. Junta o domínio do site a `ALLOWED_ORIGINS` (os URLs de regresso do checkout têm de ser desse domínio).
5. Opcional: `SHIPPING_COUNTRIES` (por omissão `PT,ES,FR,DE,IT,NL,BE,GB,IE`).

Os portes são um só por encomenda: o maior "preço de envio" dos produtos no carrinho.
Se uma peça ficar "Reservada" sem ninguém a pagar (por exemplo, webhook mal configurado), muda o estado na app.

Sem `STRIPE_SECRET_KEY` o checkout responde `503 shop_closed` e o resto funciona normalmente.

### Publicar no Cloudflare Pages

Build command `npm run build`, output directory `dist`. Lembra-te de adicionar o domínio `*.pages.dev` aos *Authorized domains* do Firebase (passo 3).

---

## 📂 Estrutura do Projeto

```text
├── index.html                    # Ponto de entrada HTML e meta tags PWA
├── package.json                  # Dependências e scripts de execução
├── tsconfig.json                 # Configurações TypeScript
├── vite.config.ts                # Configurações do Vite e Tailwind CSS
├── public/                       # Ficheiros estáticos
└── src/
    ├── components/               # Componentes UI (Calendário, Clientes, Consentimento, etc.)
    │   ├── Header.tsx            # Barra de navegação e atalhos
    │   ├── CalendarView.tsx      # Agenda interativa de marcações
    │   ├── AppointmentsList.tsx  # Lista e filtros de sessões
    │   ├── ClientsView.tsx       # Gestão e ficha de clientes (CRM)
    │   ├── InventoryView.tsx     # Controlo de stock e tintas
    │   ├── NotificationCenter.tsx# Central de notificações e alertas 24h
    │   ├── ShareProjectModal.tsx # Modal de partilha e download do código
    │   └── ...
    ├── context/                  # Estado global (StudioContext)
    ├── data/                     # Dados iniciais e estruturas de base
    ├── types/                    # Definições de tipos TypeScript
    ├── App.tsx                   # Componente raiz da aplicação
    └── main.tsx                  # Ponto de arranque React
```

---

## ✨ Funcionalidades Incluídas
- 📅 **Agenda e Calendário Interativo:** Marcação de sessões de tatuagem e piercing com cálculo de duração e sinal/depósito.
- 🔔 **Central de Notificações Inteligente:** Alertas de confirmação imediatos e lembretes com antecedência de 24 horas antes da sessão.
- 👥 **Gestão de Clientes (CRM):** Histórico de tatuagens realizadas, alergias, notas médicas e contactos.
- 📝 **Termos de Responsabilidade e Consentimento:** Assinatura digital no ecrã (iPad/tablet/smartphone) e termos de consentimento informado.
- 📦 **Controlo de Stock e Material:** Monitorização de agulhas, tintas, anestésicos, luvas com alertas de stock baixo.
- 💰 **Relatórios Financeiros:** Faturação, sinais recebidos, estimativas e estatísticas de rendimento por artista.
- 📱 **100% Responsivo:** Otimizado para telemóveis, tablets (iPad) e computadores desktop.
