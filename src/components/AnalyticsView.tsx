import React from 'react';
import { useStudio } from '../context/StudioContext';
import {
  TrendingUp,
  Euro,
  Users,
  Calendar,
  Package,
  Award,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { appointments, artists, clients, inventory, expiringItems, lowStockItems } = useStudio();

  // Financial calculations
  const totalRevenue = appointments.reduce((sum, a) => sum + a.price, 0);
  const totalDeposits = appointments.reduce((sum, a) => sum + (a.deposit || 0), 0);
  const confirmedSessions = appointments.filter((a) => a.status === 'confirmed').length;
  const completedSessions = appointments.filter((a) => a.status === 'completed').length;

  const totalConsentSigned = clients.filter((c) => c.clinicalHistory.consentSigned).length;
  const totalClients = clients.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-zinc-500" />
          Relatório de Gestão & Faturação do Estúdio
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Métricas consolidadas de faturação, volume de sessões, comissões de artistas e conformidade de termos clínicos.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Faturação Total</span>
            <Euro className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
            €{totalRevenue.toFixed(2)}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 block">
            €{totalDeposits.toFixed(2)} em sinais garantidos
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Sessões Agendadas</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {appointments.length}
          </p>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {confirmedSessions} confirmadas • {completedSessions} concluídas
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Clientes Registados</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {totalClients}
          </p>
          <span className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 block">
            {totalConsentSigned} consentimentos assinados ({Math.round((totalConsentSigned / (totalClients || 1)) * 100)}%)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Saúde do Stock</span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {inventory.length} artigos
          </p>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
            {expiringItems.length} a expirar • {lowStockItems.length} baixo stock
          </span>
        </div>
      </div>

      {/* Artist Breakdown Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Award className="w-4 h-4 text-zinc-500" />
          Desempenho por Artista & Repartição de Comissões
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                <th className="pb-2">Artista</th>
                <th className="pb-2">Sessões</th>
                <th className="pb-2">Faturação Bruta</th>
                <th className="pb-2">Comissão (%)</th>
                <th className="pb-2 text-right">Repartição Artista</th>
                <th className="pb-2 text-right">Margem Estúdio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {artists.map((artist) => {
                const artistAppts = appointments.filter((a) => a.artistId === artist.id);
                const revenue = artistAppts.reduce((sum, a) => sum + a.price, 0);
                const artistCut = revenue * (artist.commissionRate / 100);
                const studioCut = revenue - artistCut;

                return (
                  <tr key={artist.id} className="py-2.5">
                    <td className="py-2.5 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: artist.color }}
                      />
                      <span>{artist.name}</span>
                    </td>
                    <td className="py-2.5 text-zinc-600 dark:text-zinc-400">
                      {artistAppts.length}
                    </td>
                    <td className="py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                      €{revenue.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-zinc-600 dark:text-zinc-400">
                      {artist.commissionRate}%
                    </td>
                    <td className="py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      €{artistCut.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
                      €{studioCut.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
