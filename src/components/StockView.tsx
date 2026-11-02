import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { InventoryCategory, InventoryItem } from '../types';
import {
  Package,
  Plus,
  AlertTriangle,
  Clock,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const StockView: React.FC = () => {
  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    adjustStockQuantity,
    expiringItems,
    lowStockItems,
    showToast,
  } = useStudio();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('needles');
  const [quantity, setQuantity] = useState<number>(10);
  const [unit, setUnit] = useState('caixas (20 un)');
  const [minStockAlert, setMinStockAlert] = useState<number>(5);
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [brand, setBrand] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpenAdd = () => {
    setName('');
    setCategory('needles');
    setQuantity(10);
    setUnit('caixas (20 un)');
    setMinStockAlert(5);
    setLotNumber(`LOTE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    // default 6 months from now
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    setExpirationDate(d.toISOString().split('T')[0]);
    setBrand('');
    setSupplier('');
    setNotes('');
    setEditingItemId(null);
    setIsAddingItem(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setName(item.name);
    setCategory(item.category);
    setQuantity(item.quantity);
    setUnit(item.unit);
    setMinStockAlert(item.minStockAlert);
    setLotNumber(item.lotNumber);
    setExpirationDate(item.expirationDate);
    setBrand(item.brand || '');
    setSupplier(item.supplier || '');
    setNotes(item.notes || '');
    setEditingItemId(item.id);
    setIsAddingItem(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !expirationDate) {
      showToast('Nome e data de validade são obrigatórios.', 'info');
      return;
    }

    if (editingItemId) {
      updateInventoryItem(editingItemId, {
        name,
        category,
        quantity,
        unit,
        minStockAlert,
        lotNumber,
        expirationDate,
        brand,
        supplier,
        notes,
      });
    } else {
      addInventoryItem({
        name,
        category,
        quantity,
        unit,
        minStockAlert,
        lotNumber,
        expirationDate,
        brand,
        supplier,
        notes,
      });
    }

    setIsAddingItem(false);
    setEditingItemId(null);
  };

  const getExpirationStatus = (expDateStr: string) => {
    const now = new Date();
    const exp = new Date(`${expDateStr}T00:00:00`);
    const diffMs = exp.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return {
        label: `EXPIRADO (${Math.abs(days)}d atrás)`,
        color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
        badge: 'bg-rose-500',
        urgent: true,
      };
    }
    if (days <= 15) {
      return {
        label: `Expira em ${days} dias`,
        color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
        badge: 'bg-rose-500',
        urgent: true,
      };
    }
    if (days <= 30) {
      return {
        label: `Expira em ${days} dias`,
        color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        badge: 'bg-amber-500',
        urgent: true,
      };
    }
    return {
      label: `Válido (${days} dias)`,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badge: 'bg-emerald-500',
      urgent: false,
    };
  };

  const categoryLabels: { [key in InventoryCategory]: string } = {
    needles: 'Agulhas & Cartuchos',
    inks: 'Tintas & Pigmentos',
    hygiene: 'Higiene & Antissépticos',
    aftercare: 'Cuidados Pós-Tatuagem',
    disposables: 'Descartáveis & Luvas',
    equipment: 'Equipamento',
  };

  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.lotNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-zinc-500" />
            Gestão de Stock & Prazos de Validade
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Controlo de materiais perecíveis esterilizados, lotes de tintas, luvas e alertas automáticos de validade.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Material / Lote
        </button>
      </div>

      {/* Top Alert Cards: Expiring Items + Low Stock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Expiring materials alert card */}
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            expiringItems.length > 0
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div
            className={`p-2 rounded-lg ${
              expiringItems.length > 0 ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/20 text-emerald-600'
            }`}
          >
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold">
              {expiringItems.length > 0
                ? `${expiringItems.length} materiais perecíveis a expirar em breve!`
                : 'Todas as validades em dia'}
            </h4>
            <p className="text-xs opacity-90 mt-0.5">
              {expiringItems.length > 0
                ? 'Verifica os lotes de cartuchos, tintas e antissépticos assinalados a vermelho/amarelo para descarte ou substituição.'
                : 'Nenhum material perecível com validade a expirar nos próximos 30 dias.'}
            </p>
          </div>
        </div>

        {/* Low Stock alert card */}
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            lowStockItems.length > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100'
          }`}
        >
          <div
            className={`p-2 rounded-lg ${
              lowStockItems.length > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold">
              {lowStockItems.length > 0
                ? `${lowStockItems.length} artigos com stock abaixo do limite`
                : 'Níveis de stock adequados'}
            </h4>
            <p className="text-xs opacity-90 mt-0.5">
              {lowStockItems.length > 0
                ? 'Artigos críticos como luvas ou cartuchos precisam de encomenda a fornecedores.'
                : 'Todos os materiais possuem quantidade acima do limite de segurança.'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Pesquisar material, lote #, marca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
              selectedCategory === 'all'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
            }`}
          >
            Todos ({inventory.length})
          </button>
          {Object.entries(categoryLabels).map(([catKey, catLabel]) => {
            const count = inventory.filter((i) => i.category === catKey).length;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCategory === catKey
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                {catLabel} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Inventory Items List / Grid (Optimized for iPad & Mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const expStatus = getExpirationStatus(item.expirationDate);
          const isLowStock = item.quantity <= item.minStockAlert;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl bg-white dark:bg-zinc-900 border transition-all flex flex-col justify-between shadow-xs ${
                expStatus.urgent || isLowStock
                  ? 'border-amber-300 dark:border-amber-800/60'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div>
                {/* Header: Category & Expiration Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {categoryLabels[item.category] || item.category}
                  </span>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${expStatus.color}`}
                  >
                    {expStatus.label}
                  </span>
                </div>

                {/* Name & Brand */}
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                  {item.name}
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {item.brand && <span>{item.brand} • </span>}
                  <span className="font-mono text-[11px]">Lote: {item.lotNumber}</span>
                </p>

                {item.notes && (
                  <p className="text-[11px] text-zinc-400 mt-2 p-1.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
                    {item.notes}
                  </p>
                )}

                {/* Expiration date explicit */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-2.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Validade: <strong className="text-zinc-700 dark:text-zinc-300">{item.expirationDate}</strong></span>
                </div>
              </div>

              {/* Bottom: Quantity Adjuster (iPad/touch friendly buttons) */}
              <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-lg font-black ${
                        isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {item.quantity}
                    </span>
                    <span className="text-xs text-zinc-500">{item.unit}</span>
                  </div>
                  {isLowStock && (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block">
                      ⚠️ Stock Baixo (Mín: {item.minStockAlert})
                    </span>
                  )}
                </div>

                {/* Direct +/- touch buttons (minimum 44x44px for iPad/phone) */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustStockQuantity(item.id, -1)}
                    disabled={item.quantity <= 0}
                    className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 active:scale-95"
                    title="Diminuir 1"
                  >
                    -
                  </button>
                  <button
                    onClick={() => adjustStockQuantity(item.id, 1)}
                    className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 font-bold flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                    title="Adicionar 1"
                  >
                    +
                  </button>

                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md cursor-pointer ml-1"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteInventoryItem(item.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 rounded-md cursor-pointer"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Inventory Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {editingItemId ? 'Editar Material de Stock' : 'Registar Novo Material Perecível'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Nome do Material / Artigo *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Cartuchos Kwadron 03RL, Tinta Dynamic Black..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  >
                    <option value="needles">Agulhas & Cartuchos</option>
                    <option value="inks">Tintas & Pigmentos</option>
                    <option value="hygiene">Higiene & Antissépticos</option>
                    <option value="aftercare">Cuidados Pós-Tatuagem</option>
                    <option value="disposables">Descartáveis & Luvas</option>
                    <option value="equipment">Equipamento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Marca</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex: Kwadron, Cheyenne..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Nº de Lote (Lot #)</label>
                  <input
                    type="text"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="Ex: LOTE-2026-90"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Data de Validade *</label>
                  <input
                    type="date"
                    required
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Unidade</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="caixas, un, frascos"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Alerta Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Fornecedor</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ex: Killer Ink, Barber DTS..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Notas / Instruções de Conservação</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Local de arrumação, data de abertura..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold cursor-pointer"
                >
                  {editingItemId ? 'Guardar Alterações' : 'Adicionar ao Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
