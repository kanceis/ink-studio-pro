import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Users,
  QrCode,
  Sparkles,
  Globe,
  Download,
  FolderArchive,
  Terminal,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'link' | 'qr' | 'collab' | 'source';
}

export const ShareProjectModal: React.FC<Props> = ({ isOpen, onClose, initialTab = 'link' }) => {
  const { showToast } = useStudio();
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'link' | 'source' | 'qr' | 'collab'>(initialTab);

  if (!isOpen) return null;

  // Determine current public URL or default to the preview instance
  const currentUrl =
    typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://ais-pre-xfnl2p6sdckswed33koypx-922080451446.europe-west2.run.app';

  const shareTitle = 'INK Studio Pro — Sistema de Gestão de Tatuagens & Body Piercing';
  const shareText =
    'Experimenta o INK Studio Pro: agenda de marcações, CRM de clientes, alertas 24h e controlo de stock para estúdios de tatuagem.';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = currentUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      showToast('Link da aplicação copiado com sucesso!', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Não foi possível copiar automaticamente.', 'error');
    }
  };

  const handleCopySnippet = async (text: string, id: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedCmd(id);
      showToast('Comando copiado para a área de transferência!', 'success');
      setTimeout(() => setCopiedCmd(null), 2500);
    } catch {
      showToast('Erro ao copiar comando.', 'error');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: currentUrl,
        });
        showToast('Link partilhado com sucesso!', 'success');
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  // Safe QR Code generation using QuickChart or SVG encoder
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    currentUrl
  )}&bgcolor=ffffff&color=18181b&margin=10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Partilhar & Descarregar Projeto
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Link público, código QR ou download do código fonte (.zip)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-5 bg-zinc-50/30 dark:bg-zinc-900/30 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('link')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'link'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Link da App
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'source'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Código Fonte (.ZIP)
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
              Download
            </span>
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'qr'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Código QR
          </button>
          <button
            onClick={() => setActiveTab('collab')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'collab'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Google AI Studio
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* TAB 1: LINK DA APP */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              {/* Quick source banner */}
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Procuras o ficheiro com o código fonte?</span>
                </div>
                <button
                  onClick={() => setActiveTab('source')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  Descarregar .ZIP
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Link Direto da Aplicação (Web & Mobile):
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-800 dark:text-zinc-200 truncate select-all">
                    {currentUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Copiar Link"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Partilhar via Telemóvel/iPad</span>
                </button>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir num Novo Separador</span>
                </a>
              </div>

              {/* Tip cards */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-750 space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Como o teu amigo pode instalar no telemóvel/iPad:
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Ele só precisa de abrir o link no Safari (iPhone/iPad) ou Chrome (Android), carregar em <strong>Partilhar</strong> e escolher <strong>"Adicionar ao Ecrã Principal"</strong>. Fica a funcionar exatamente como uma aplicação nativa!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CÓDIGO FONTE (.ZIP) */}
          {activeTab === 'source' && (
            <div className="space-y-4 text-xs">
              {/* Download banner box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-zinc-100 to-zinc-50 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-900 border border-emerald-300 dark:border-emerald-800/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      ink-studio-pro-source.zip
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-0.5">
                      Arquivo .ZIP limpo e pronto para desenvolvimento (~121 KB).
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-0.5">
                      Inclui TypeScript, React 19, Tailwind CSS, Vite, componentes, estilos e README.md.
                    </p>
                  </div>
                </div>

                <a
                  href="/ink-studio-pro-source.zip"
                  download="ink-studio-pro-source.zip"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4 animate-bounce" />
                  <span>Descarregar .ZIP</span>
                </a>
              </div>

              {/* What is included */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>O que está incluído:</span>
                  </div>
                  <ul className="text-zinc-600 dark:text-zinc-400 space-y-1 pl-5 list-disc text-[11px]">
                    <li>Todo o código fonte em TypeScript & React</li>
                    <li>Design e temas escuro/claro Tailwind CSS</li>
                    <li>Central de notificações & alertas 24h</li>
                    <li>CRM de clientes e agenda interativa</li>
                    <li>Ficheiro README.md com instruções passo a passo</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold mb-1">
                    <Terminal className="w-3.5 h-3.5 text-blue-500" />
                    <span>Requisitos para correr:</span>
                  </div>
                  <ul className="text-zinc-600 dark:text-zinc-400 space-y-1 pl-5 list-disc text-[11px]">
                    <li>Node.js (versão 18, 20 ou superior)</li>
                    <li>Qualquer editor de código (ex: VS Code)</li>
                    <li>Navegador web moderno (Chrome, Safari, Firefox, Edge)</li>
                  </ul>
                </div>
              </div>

              {/* Instructions steps */}
              <div className="p-4 rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Como correr no teu computador (3 passos):
                  </span>
                </div>

                {/* Step 1 */}
                <div className="space-y-1">
                  <p className="text-[11px] text-zinc-400">
                    <strong>1.</strong> Descompacta o ficheiro <code className="text-emerald-400">ink-studio-pro-source.zip</code> no teu computador e abre o terminal nessa pasta.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-1">
                  <p className="text-[11px] text-zinc-400">
                    <strong>2.</strong> Instala as dependências necessárias:
                  </p>
                  <div className="flex items-center justify-between px-3 py-2 bg-black/60 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300">
                    <span>npm install</span>
                    <button
                      onClick={() => handleCopySnippet('npm install', 'step2')}
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                      title="Copiar comando"
                    >
                      {copiedCmd === 'step2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="space-y-1">
                  <p className="text-[11px] text-zinc-400">
                    <strong>3.</strong> Inicia a aplicação no teu computador:
                  </p>
                  <div className="flex items-center justify-between px-3 py-2 bg-black/60 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300">
                    <span>npm run dev</span>
                    <button
                      onClick={() => handleCopySnippet('npm run dev', 'step3')}
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                      title="Copiar comando"
                    >
                      {copiedCmd === 'step3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 pt-1">
                  Depois abre <strong className="text-white">http://localhost:3000</strong> no teu browser!
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: QR CODE */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-4 py-2">
              <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-md">
                <img
                  src={qrCodeUrl}
                  alt="QR Code da Aplicação"
                  className="w-48 h-48 rounded-lg object-contain"
                  loading="lazy"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Digitaliza com a câmara do telemóvel
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
                  O teu amigo pode apontar a câmara do iPhone ou Android para este código para abrir o estúdio de imediato.
                </p>
              </div>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar Link para Enviar no WhatsApp</span>
              </button>
            </div>
          )}

          {/* TAB 4: COLLAB */}
          {activeTab === 'collab' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Partilhar o Projeto no Google AI Studio (Edição / Desenvolvimento)</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Se o teu amigo também quiser <strong>ver o código, conversar com o AI ou colaborar na construção do projeto</strong>:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-700 dark:text-zinc-300 pl-1">
                  <li>
                    Olha para a <strong>barra de ferramentas superior do Google AI Studio</strong> (canto superior direito do ecrã).
                  </li>
                  <li>
                    Clica no botão azul/cinzento <strong>"Share"</strong> (Partilhar).
                  </li>
                  <li>
                    Introduz o e-mail Google do teu amigo ou gera um link de acesso de colaborador.
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Resumo das opções de partilha:
                </p>
                <div className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">1. Como Utilizador / Cliente:</span>
                    <span>Basta enviares o link público direto ou o código QR (aba "Link da App"). Ele não precisa de conta Google nem de programar.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">2. Ficheiro com Código (.ZIP):</span>
                    <span>Descarrega o arquivo na aba <strong>"Código Fonte (.ZIP)"</strong> para enviar por e-mail ou pendrive.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">3. Como Programador no AI Studio:</span>
                    <span>Usa o botão <strong>"Share"</strong> no topo da interface do Google AI Studio.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <a
            href="/ink-studio-pro-source.zip"
            download="ink-studio-pro-source.zip"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descarregar ink-studio-pro-source.zip (~121 KB)</span>
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

