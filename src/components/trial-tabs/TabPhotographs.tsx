/**
 * QUV-Lab — Photothèque & Suivi Visuel (GATE 2.1 + GATE 2.2)
 * Module indépendant pour la gestion des photographies liées aux Éprouvettes et Étapes.
 * Permet le téléversement, le filtrage hiérarchique, la comparaison chronologique et côte-à-côte.
 *
 * GATE 2.2 — Règle stricte d'unicité active par (panelId, stageId) :
 * 1 seule photo active par éprouvette et par jalon.
 * En cas de nouveau cliché : remplacement contrôlé et archivage de l'ancien dans l'historique sans destruction.
 */

import React, { useState, useMemo } from 'react';
import { Trial, MediaReference, BatchDefinition, PanelDefinition, ExposureStage } from '../../types/trial';
import { globalTrialStore, generateUUID } from '../../services/trialStore';
import {
  Camera,
  Upload,
  Filter,
  Grid,
  Columns,
  Layers,
  Clock,
  Trash2,
  Maximize2,
  X,
  Plus,
  Calendar,
  User,
  Info,
  CheckCircle2,
  Tag,
  Compass,
  Eye,
  SlidersHorizontal,
  Download,
  AlertCircle,
  Archive,
  History,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

interface Props {
  trial: Trial;
  onTrialUpdated: () => void;
}

export function TabPhotographs({ trial, onTrialUpdated }: Props) {
  // Filtres
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');
  const [selectedStageId, setSelectedStageId] = useState<string>('ALL');
  const [selectedSpecimenRole, setSelectedSpecimenRole] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'GRID' | 'CHRONO_MATRIX' | 'SIDE_BY_SIDE'>('GRID');

  // Modal Ajout / Remplacement
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhotoBatchId, setNewPhotoBatchId] = useState<string>(trial.batches[0]?.id || '');
  const [newPhotoPanelId, setNewPhotoPanelId] = useState<string>(trial.batches[0]?.panels[0]?.id || '');
  const [newPhotoStageId, setNewPhotoStageId] = useState<string>(trial.stages[0]?.id || '');
  const [newPhotoCaption, setNewPhotoCaption] = useState<string>('');
  const [newPhotoFace, setNewPhotoFace] = useState<string>('Face externe');
  const [newPhotoOperator, setNewPhotoOperator] = useState<string>(trial.metadata.createdBy || 'Simon Martin (Technicien)');
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Lightbox
  const [lightboxMedia, setLightboxMedia] = useState<MediaReference | null>(null);

  // Mapping des éprouvettes
  const panelMap = useMemo(() => {
    const map = new Map<string, { panel: PanelDefinition; batch: BatchDefinition }>();
    trial.batches.forEach((batch) => {
      batch.panels.forEach((panel) => {
        map.set(panel.id, { panel, batch });
      });
    });
    return map;
  }, [trial.batches]);

  // Mapping des étapes
  const stageMap = useMemo(() => {
    const map = new Map<string, ExposureStage>();
    trial.stages.forEach((st) => {
      map.set(st.id, st);
    });
    return map;
  }, [trial.stages]);

  // Détection d'un cliché actif existant pour la sélection du modal
  const existingActivePhoto = useMemo(() => {
    if (!newPhotoPanelId || !newPhotoStageId) return null;
    return trial.mediaReferences.find(
      (m) =>
        m.type === 'PHOTO' &&
        m.panelId === newPhotoPanelId &&
        m.stageId === newPhotoStageId &&
        m.status !== 'ARCHIVED'
    ) || null;
  }, [trial.mediaReferences, newPhotoPanelId, newPhotoStageId]);

  // Liste filtrée des photos
  const filteredPhotos = useMemo(() => {
    return trial.mediaReferences.filter((media) => {
      if (media.type !== 'PHOTO') return false;

      // Filtrer les archivées sauf si demandé
      if (!showArchived && media.status === 'ARCHIVED') return false;

      if (selectedBatchId !== 'ALL') {
        const info = media.panelId ? panelMap.get(media.panelId) : null;
        if (!info || info.batch.id !== selectedBatchId) return false;
      }

      if (selectedStageId !== 'ALL' && media.stageId !== selectedStageId) {
        return false;
      }

      if (selectedSpecimenRole !== 'ALL' && media.panelId) {
        const info = panelMap.get(media.panelId);
        if (!info) return false;
        if (selectedSpecimenRole === 'WITNESS' && info.panel.label !== 'T') return false;
        if (selectedSpecimenRole === 'EXPOSED' && info.panel.label === 'T') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const captionMatch = media.caption?.toLowerCase().includes(q);
        const filenameMatch = media.filename?.toLowerCase().includes(q);
        const operatorMatch = media.capturedBy?.toLowerCase().includes(q);
        if (!captionMatch && !filenameMatch && !operatorMatch) return false;
      }

      return true;
    });
  }, [trial.mediaReferences, selectedBatchId, selectedStageId, selectedSpecimenRole, showArchived, searchQuery, panelMap]);

  // Gestion du fichier image
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setNewPhotoDataUrl(result);
      setUploadError(null);
    };
    reader.onerror = () => {
      setUploadError('Erreur lors de la lecture du fichier image.');
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = () => {
    if (!newPhotoPanelId || !newPhotoStageId) {
      setUploadError('Veuillez sélectionner une éprouvette et une étape.');
      return;
    }

    const info = panelMap.get(newPhotoPanelId);
    const stage = stageMap.get(newPhotoStageId);
    const label = info ? `${info.batch.reference}-${info.panel.label}` : 'Echantillon';
    const stageName = stage ? stage.name : 'Etape';
    const filename = `PHOTO_${label}_${stage ? stage.cycleIndex : 0}_${Date.now()}.jpg`;

    // Générer une image par défaut ou mockup si l'utilisateur n'a pas chargé d'image
    const defaultDataUrl =
      newPhotoDataUrl ||
      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%23f1f5f9"/><rect x="20" y="20" width="560" height="360" rx="12" fill="%23e2e8f0"/><text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%23475569">${label} • ${stageName}</text><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2364748b">${newPhotoFace} • ${new Date().toLocaleDateString('fr-FR')}</text></svg>`;

    try {
      globalTrialStore.attachPhoto({
        trialId: trial.id,
        panelId: newPhotoPanelId,
        stageId: newPhotoStageId,
        filename,
        caption: newPhotoCaption.trim() || `Cliché ${label} — ${stageName} (${newPhotoFace})`,
        operatorId: newPhotoOperator.trim() || 'Simon Martin (Technicien)',
        storageKey: defaultDataUrl
      });

      setShowAddModal(false);
      setNewPhotoCaption('');
      setNewPhotoDataUrl('');
      setUploadError(null);
      onTrialUpdated();
    } catch (err: any) {
      setUploadError(err.message || "Erreur lors de l'enregistrement de la photo");
    }
  };

  const handleDeletePhoto = (mediaId: string) => {
    if (!window.confirm('Confirmez-vous la suppression de cette photographie ?')) return;
    globalTrialStore.deletePhoto(trial.id, mediaId, trial.metadata.createdBy || 'OPERATOR');
    if (lightboxMedia?.id === mediaId) {
      setLightboxMedia(null);
    }
    onTrialUpdated();
  };

  // Liste des éprouvettes du lot sélectionné dans le modal
  const modalBatchPanels = useMemo(() => {
    const b = trial.batches.find((batch) => batch.id === newPhotoBatchId);
    return b ? b.panels : [];
  }, [trial.batches, newPhotoBatchId]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Photothèque & Suivi Visuel des Éprouvettes</h3>
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">
              GATE 2.2
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {trial.mediaReferences.filter((m) => m.type === 'PHOTO' && m.status !== 'ARCHIVED').length} cliché(s) actif(s) • Unicité stricte par couple (Éprouvette, Jalon)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('GRID')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'GRID' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              Galerie
            </button>
            <button
              onClick={() => setViewMode('CHRONO_MATRIX')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'CHRONO_MATRIX' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Matrice Temporelle
            </button>
            <button
              onClick={() => setViewMode('SIDE_BY_SIDE')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'SIDE_BY_SIDE' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Comparateur T vs E
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter / Remplacer un Cliché
          </button>
        </div>
      </div>

      {/* 2. Barre de Filtres */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            Filtres de consultation
          </div>
          <label className="flex items-center gap-2 cursor-pointer lowercase font-medium text-slate-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs">Afficher les clichés archivés / remplacés</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filtrer par Lot</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="ALL">Tous les lots ({trial.batches.length})</option>
              {trial.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.reference} — {b.productReference || b.woodSpecies}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filtrer par Étape / Cycle</label>
            <select
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="ALL">Toutes les étapes ({trial.stages.length})</option>
              {trial.stages.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.scheduledExposureHours}h)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rôle d'Éprouvette</label>
            <select
              value={selectedSpecimenRole}
              onChange={(e) => setSelectedSpecimenRole(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="ALL">Tous les rôles (T + Exposés)</option>
              <option value="WITNESS">Témoins seuls (T)</option>
              <option value="EXPOSED">Exposés seuls (1, 2, 3)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Recherche (légende, auteur...)</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ex: fissuration, T0, Simon..."
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* 3. Vue Principale selon le Mode */}
      {viewMode === 'GRID' && (
        <div>
          {filteredPhotos.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <Camera className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Aucun cliché photographique trouvé</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Aucune photo ne correspond aux filtres sélectionnés. Cliquez sur "Ajouter / Remplacer un Cliché" pour attacher une image à une éprouvette et une étape.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                Ajouter un Cliché
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPhotos.map((media) => {
                const info = media.panelId ? panelMap.get(media.panelId) : null;
                const stage = media.stageId ? stageMap.get(media.stageId) : null;
                const isWitness = info?.panel.label === 'T';
                const specimenLabel = info ? `${info.batch.reference}-${info.panel.label}` : 'Éprouvette';
                const isArchived = media.status === 'ARCHIVED';

                return (
                  <div
                    key={media.id}
                    className={`bg-white border rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${
                      isArchived ? 'border-amber-200 opacity-70 bg-amber-50/20' : 'border-slate-200'
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="relative aspect-4/3 bg-slate-100 overflow-hidden border-b border-slate-100 flex items-center justify-center">
                      <img
                        src={media.storageKey}
                        alt={media.caption || 'Photographie éprouvette'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />

                      {/* Top Overlay Badges */}
                      <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-900/80 text-white backdrop-blur-xs">
                          {specimenLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded backdrop-blur-xs ${
                            isWitness ? 'bg-purple-600/90 text-white' : 'bg-blue-600/90 text-white'
                          }`}
                        >
                          {isWitness ? 'Témoin' : 'Exposé'}
                        </span>
                        {isArchived && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-600 text-white flex items-center gap-0.5">
                            <Archive className="w-3 h-3" />
                            Archivé
                          </span>
                        )}
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLightboxMedia(media)}
                          className="p-2 rounded-full bg-white/90 text-slate-800 hover:bg-white hover:scale-110 transition-transform shadow-md"
                          title="Agrandir et inspecter"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(media.id)}
                          className="p-2 rounded-full bg-rose-600/90 text-white hover:bg-rose-700 hover:scale-110 transition-transform shadow-md"
                          title="Supprimer ce cliché"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Clock className="w-3 h-3 text-blue-600" />
                          {stage ? stage.name : 'Étape N/A'}
                        </span>
                        <span className="font-mono text-[10px]">
                          {stage?.scheduledExposureHours ?? 0}h
                        </span>
                      </div>

                      <p className="text-slate-800 font-medium text-xs line-clamp-2" title={media.caption}>
                        {media.caption || 'Aucune description'}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{media.capturedBy}</span>
                        <span>{new Date(media.capturedAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Matrice Chronologique */}
      {viewMode === 'CHRONO_MATRIX' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Matrice Chronologique d'Exposition</h4>
              <p className="text-xs text-slate-500">Visualisation de l'évolution visuelle de chaque éprouvette cycle par cycle (clichés actifs)</p>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="p-2.5 font-bold text-slate-700">Éprouvette</th>
                <th className="p-2.5 font-bold text-slate-700">Lot & Essence</th>
                {trial.stages.map((st) => (
                  <th key={st.id} className="p-2.5 font-bold text-slate-700 text-center font-mono">
                    {st.name}
                    <span className="block text-[10px] text-slate-400 font-normal">({st.scheduledExposureHours}h)</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trial.batches.flatMap((b) =>
                b.panels.map((p) => {
                  const isWitness = p.label === 'T';
                  const code = `${b.reference}-${p.label}`;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${isWitness ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                          {code}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600 whitespace-nowrap">
                        {b.woodSpecies || 'Bois'} ({b.productReference || '—'})
                      </td>
                      {trial.stages.map((st) => {
                        const photo = trial.mediaReferences.find(
                          (m) => m.type === 'PHOTO' && m.panelId === p.id && m.stageId === st.id && m.status !== 'ARCHIVED'
                        );

                        return (
                          <td key={st.id} className="p-2 text-center">
                            {photo ? (
                              <button
                                type="button"
                                onClick={() => setLightboxMedia(photo)}
                                className="inline-block relative group"
                              >
                                <img
                                  src={photo.storageKey}
                                  alt="Cliché"
                                  className="w-12 h-10 object-cover rounded border border-slate-200 group-hover:scale-110 transition-transform"
                                  referrerPolicy="no-referrer"
                                />
                              </button>
                            ) : (
                              <span className="text-slate-300 font-mono text-[10px]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Mode Comparateur Témoin T vs Exposés E */}
      {viewMode === 'SIDE_BY_SIDE' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Comparateur Visuel Témoin T vs Éprouvettes Exposées</h4>
            <p className="text-xs text-slate-500">Inspection visuelle comparative côte-à-côte à étape identique</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Témoin T */}
            <div className="p-4 bg-purple-50/40 border border-purple-200 rounded-2xl space-y-3">
              <h5 className="font-bold text-xs text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-700" />
                Témoin (Conservé à l'obscurité)
              </h5>
              {filteredPhotos.filter((m) => {
                const info = m.panelId ? panelMap.get(m.panelId) : null;
                return info?.panel.label === 'T' && m.status !== 'ARCHIVED';
              }).slice(0, 1).map((m) => (
                <div key={m.id} className="space-y-2">
                  <div className="aspect-4/3 bg-slate-900 rounded-xl overflow-hidden">
                    <img src={m.storageKey} alt="Témoin" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <p className="text-xs font-semibold text-purple-950">{m.caption}</p>
                </div>
              ))}
            </div>

            {/* Exposé E1 */}
            <div className="p-4 bg-blue-50/40 border border-blue-200 rounded-2xl space-y-3">
              <h5 className="font-bold text-xs text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-700" />
                Éprouvette Exposée (Cycles QUV)
              </h5>
              {filteredPhotos.filter((m) => {
                const info = m.panelId ? panelMap.get(m.panelId) : null;
                return info?.panel.label !== 'T' && m.status !== 'ARCHIVED';
              }).slice(0, 1).map((m) => (
                <div key={m.id} className="space-y-2">
                  <div className="aspect-4/3 bg-slate-900 rounded-xl overflow-hidden">
                    <img src={m.storageKey} alt="Exposé" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <p className="text-xs font-semibold text-blue-950">{m.caption}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Ajout / Remplacement de Cliché */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                {existingActivePhoto ? 'Remplacer le Cliché Photographique' : 'Nouveau Cliché Photographique'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 text-rose-900 rounded-xl border border-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Avertissement de remplacement si photo existante */}
            {existingActivePhoto && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Unicité & Remplacement contrôlé :</strong> Un cliché actif existe déjà pour cette éprouvette à cette étape (<em>{existingActivePhoto.filename}</em>). L'enregistrement de ce nouveau cliché archivera l'ancien dans l'historique sans le détruire.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Lot expérimental *
                </label>
                <select
                  value={newPhotoBatchId}
                  onChange={(e) => {
                    setNewPhotoBatchId(e.target.value);
                    const b = trial.batches.find((batch) => batch.id === e.target.value);
                    if (b && b.panels[0]) setNewPhotoPanelId(b.panels[0].id);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {trial.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference} ({b.woodSpecies})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Éprouvette ciblée *
                </label>
                <select
                  value={newPhotoPanelId}
                  onChange={(e) => setNewPhotoPanelId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {modalBatchPanels.map((p) => (
                    <option key={p.id} value={p.id}>
                      Éprouvette {p.label} ({p.label === 'T' ? 'Témoin' : 'Exposé'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  3. Étape d'exposition *
                </label>
                <select
                  value={newPhotoStageId}
                  onChange={(e) => setNewPhotoStageId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {trial.stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.scheduledExposureHours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. Face photographiée
                </label>
                <select
                  value={newPhotoFace}
                  onChange={(e) => setNewPhotoFace(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="Face externe">Face externe (exposée UV)</option>
                  <option value="Face interne">Face interne (non exposée)</option>
                  <option value="Tranche / Rive">Tranche / Rive</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  5. Fichier Image (Téléversement ou Glisser-Déposer)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelected}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {newPhotoDataUrl && (
                    <div className="mt-3 aspect-16/9 max-h-36 rounded-lg overflow-hidden border border-slate-200 mx-auto">
                      <img
                        src={newPhotoDataUrl}
                        alt="Aperçu"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  6. Observations / Légende du cliché
                </label>
                <textarea
                  rows={2}
                  value={newPhotoCaption}
                  onChange={(e) => setNewPhotoCaption(e.target.value)}
                  placeholder="Ex : Fissuration locale en zone centrale, début de farinage, décollement en tranche..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Opérateur de prise de vue
                </label>
                <input
                  type="text"
                  value={newPhotoOperator}
                  onChange={(e) => setNewPhotoOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSavePhoto}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                {existingActivePhoto ? 'Remplacer et Archiver l\'Ancien' : 'Enregistrer la Photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Lightbox d'Inspection Plein Écran */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2">
                    {lightboxMedia.filename}
                    {lightboxMedia.status === 'ARCHIVED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        ARCHIVÉ
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Capturé le {new Date(lightboxMedia.capturedAt).toLocaleString('fr-FR')} par {lightboxMedia.capturedBy}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLightboxMedia(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content & Metadata */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
              <div className="md:col-span-2 aspect-4/3 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src={lightboxMedia.storageKey}
                  alt={lightboxMedia.caption}
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Sidebar Metadata */}
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wider block text-[10px]">
                    Identifiants de Traçabilité
                  </span>
                  {lightboxMedia.panelId && panelMap.get(lightboxMedia.panelId) && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Éprouvette & Lot :</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {panelMap.get(lightboxMedia.panelId)?.batch.reference} —{' '}
                        {panelMap.get(lightboxMedia.panelId)?.panel.label}
                      </span>
                    </div>
                  )}

                  {lightboxMedia.stageId && stageMap.get(lightboxMedia.stageId) && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Étape :</span>
                      <span className="font-semibold text-slate-900">
                        {stageMap.get(lightboxMedia.stageId)?.name} (
                        {stageMap.get(lightboxMedia.stageId)?.scheduledExposureHours}h)
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 block text-[10px]">Statut Photothèque :</span>
                    <span className="font-bold text-slate-800">
                      {lightboxMedia.status === 'ARCHIVED' ? 'Archivé (remplacé par un cliché plus récent)' : 'Actif'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
                  <span className="font-bold text-blue-950 uppercase tracking-wider block text-[10px]">
                    Légende & Observation
                  </span>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {lightboxMedia.caption || 'Aucune observation enregistrée.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(lightboxMedia.id)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer ce cliché
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxMedia(null)}
                    className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
