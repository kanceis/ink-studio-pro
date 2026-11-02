import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { Artist } from '../types';
import {
  Palette,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Euro,
  Award,
  Phone,
  Mail,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

export const ArtistsView: React.FC = () => {
  const { artists, addArtist, updateArtist, deleteArtist, appointments, showToast } = useStudio();

  const [isAddingArtist, setIsAddingArtist] = useState(false);
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [specialtiesText, setSpecialtiesText] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(65);
  const [bio, setBio] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const handleOpenAdd = () => {
    setName('');
    setEmail('');
    setPhone('');
    setAvatarUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');
    setSpecialtiesText('Fineline, Blackwork');
    setCommissionRate(65);
    setBio('');
    setColor('#3b82f6');
    setEditingArtistId(null);
    setIsAddingArtist(true);
  };

  const handleOpenEdit = (artist: Artist) => {
    setName(artist.name);
    setEmail(artist.email);
    setPhone(artist.phone);
    setAvatarUrl(artist.avatarUrl);
    setSpecialtiesText(artist.specialties.join(', '));
    setCommissionRate(artist.commissionRate);
    setBio(artist.bio || '');
    setColor(artist.color || '#3b82f6');
    setEditingArtistId(artist.id);
    setIsAddingArtist(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      showToast('O nome do artista é obrigatório.', 'info');
      return;
    }

    const specialties = specialtiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingArtistId) {
      updateArtist(editingArtistId, {
        name,
        email,
        phone,
        avatarUrl,
        specialties,
        commissionRate,
        bio,
        color,
      });
    } else {
      addArtist({
        name,
        email,
        phone,
        avatarUrl:
          avatarUrl ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        specialties,
        commissionRate,
        active: true,
        workingDays: [1, 2, 3, 4, 5],
        bio,
        color,
      });
    }

    setIsAddingArtist(false);
    setEditingArtistId(null);
  };

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Palette className="w-5 h-5 text-zinc-500" />
            Artistas & Estatísticas de Trabalho
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Equipa residente e guest artists, repartição de comissões e performance de sessões.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Adicionar Artista
        </button>
      </div>

      {/* Artists Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {artists.map((artist) => {
          // Calculate statistics for this artist
          const artistAppointments = appointments.filter((a) => a.artistId === artist.id);
          const totalSessions = artistAppointments.length;
          const completedSessions = artistAppointments.filter((a) => a.status === 'completed' || a.status === 'confirmed').length;
          const totalRevenue = artistAppointments.reduce((acc, curr) => acc + curr.price, 0);
          const artistCut = totalRevenue * (artist.commissionRate / 100);
          const studioCut = totalRevenue - artistCut;
          const avgTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;

          return (
            <div
              key={artist.id}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
            >
              <div>
                {/* Artist Top Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={artist.avatarUrl}
                      alt={artist.name}
                      className="w-12 h-12 rounded-full object-cover border-2"
                      style={{ borderColor: artist.color }}
                    />
                    <div>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>{artist.name}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: artist.color }}
                          title="Cor na Agenda"
                        />
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Comissão: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{artist.commissionRate}%</span> (Estúdio: {100 - artist.commissionRate}%)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(artist)}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteArtist(artist.id)}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      title="Remover Artista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {artist.bio && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
                    {artist.bio}
                  </p>
                )}

                {/* Specialties tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {artist.specialties.map((spec, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    >
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Statistics Box */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Sessões Marcadas:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {totalSessions} sessões
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Faturação Total:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      €{totalRevenue.toFixed(2)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Artista ({artist.commissionRate}%): €{artistCut.toFixed(2)}
                    </span>
                    <span className="text-zinc-500">
                      Estúdio: €{studioCut.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact info footer */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                <span className="truncate max-w-[140px]">{artist.phone}</span>
                <span className="truncate max-w-[140px]">{artist.email}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Artist Modal */}
      {isAddingArtist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {editingArtistId ? 'Editar Artista' : 'Adicionar Novo Artista'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Nome do Artista *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+351 9..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="artista@estudio.com"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Taxa de Comissão (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Cor na Agenda</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-10 h-8 rounded border border-zinc-300 dark:border-zinc-700 cursor-pointer"
                    />
                    <span className="text-[11px] text-zinc-400">{color}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                  Especialidades (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={specialtiesText}
                  onChange={(e) => setSpecialtiesText(e.target.value)}
                  placeholder="Fineline, Blackwork, Realismo..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">URL da Foto de Perfil</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Bio / Apresentação</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Estilos predominantes, anos de experiência..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingArtist(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold cursor-pointer"
                >
                  {editingArtistId ? 'Guardar Artista' : 'Criar Artista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
