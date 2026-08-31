/**
 * QUV-Lab — 02 Lots & Panneaux (PROMPT 6 v6.1 - Sections 8, 9 & 10)
 * Gère le référentiel permanent de l'essai : Lots, Caractéristiques détaillées,
 * Éprouvettes stables (XX1C-P01...), et Exclusion Motivée sans suppression physique.
 */

import React, { useState } from 'react';
import { Trial, BatchDefinition, PanelDefinition } from '../../types/trial';
import { globalTrialStore, generateUUID } from '../../services/trialStore';
import {
  Layers,
  Plus,
  Ban,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  FileText,
  User,
  Calendar,
  Lock,
  Tag,
  Sparkles,
  Sliders
} from 'lucide-react';

interface Props {
  trial: Trial;
  onTrialUpdated: () => void;
}

export function Tab02LotsPanels({ trial, onTrialUpdated }: Props) {
  const [selectedPanelForExclusion, setSelectedPanelForExclusion] = useState<{
    panel: PanelDefinition;
    batch: BatchDefinition;
  } | null>(null);
  const [exclusionReason, setExclusionReason] = useState('');
  const [operatorId, setOperatorId] = useState('Simon Martin (Technicien)');
  const [exclusionError, setExclusionError] = useState<string | null>(null);

  // Ajout de nouveau lot (si non verrouillé)
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [newBatchRef, setNewBatchRef] = useState('');
  const [newBatchWood, setNewBatchWood] = useState('Pin sylvestre standardisé');
  const [newBatchProduct, setNewBatchProduct] = useState('');
  const [newBatchSupplier, setNewBatchSupplier] = useState('');
  const [newBatchCoating, setNewBatchCoating] = useState('');
  const [newBatchCoatCount, setNewBatchCoatCount] = useState(3);
  const [newBatchPrep, setNewBatchPrep] = useState('Ponçage grain P120');
  const [newBatchMethod, setNewBatchMethod] = useState('Pinceau');
  const [newBatchConditions, setNewBatchConditions] = useState('21°C, 55% HR');
  const [newBatchDate, setNewBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [newBatchDrying, setNewBatchDrying] = useState('7 jours à 20°C/65% HR');
  const [newBatchNotes, setNewBatchNotes] = useState('');
  const [newBatchPanelCount, setNewBatchPanelCount] = useState(4);

  const isLocked = trial.configurationStatus === 'LOCKED';

  const handleOpenExclusion = (batch: BatchDefinition, panel: PanelDefinition) => {
    setSelectedPanelForExclusion({ batch, panel });
    setExclusionReason('');
    setExclusionError(null);
  };

  const handleConfirmExclusion = () => {
    if (!selectedPanelForExclusion) return;
    if (!exclusionReason.trim()) {
      setExclusionError('Le motif d\'exclusion du panneau est obligatoire.');
      return;
    }

    try {
      globalTrialStore.excludePanel(
        trial.id,
        selectedPanelForExclusion.panel.id,
        exclusionReason.trim(),
        operatorId
      );
      setSelectedPanelForExclusion(null);
      onTrialUpdated();
    } catch (err: any) {
      setExclusionError(err.message || 'Erreur lors de l\'exclusion');
    }
  };

  const handleAddBatch = () => {
    if (isLocked) return;
    if (!newBatchRef.trim()) return;

    const batchId = generateUUID();
    const panels: PanelDefinition[] = [];
    for (let p = 1; p <= newBatchPanelCount; p++) {
      panels.push({
        id: generateUUID(),
        batchId,
        index: p,
        label: `P0${p}`.slice(-3),
        status: 'ACTIVE'
      });
    }

    const newBatch: BatchDefinition = {
      id: batchId,
      trialId: trial.id,
      reference: newBatchRef.trim(),
      orderIndex: trial.batches.length + 1,
      woodSpecies: newBatchWood.trim() || undefined,
      productReference: newBatchProduct.trim() || undefined,
      manufacturerOrSupplier: newBatchSupplier.trim() || undefined,
      coatingSystem: newBatchCoating.trim() || undefined,
      coatCount: newBatchCoatCount,
      substratePreparation: newBatchPrep.trim() || undefined,
      applicationMethod: newBatchMethod.trim() || undefined,
      applicationConditions: newBatchConditions.trim() || undefined,
      applicationDate: newBatchDate,
      dryingOrConditioningTime: newBatchDrying.trim() || undefined,
      batchNotes: newBatchNotes.trim() || undefined,
      panels
    };

    trial.batches.push(newBatch);
    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || 'OPERATOR',
      action: 'CREATE_BATCH',
      entityType: 'BATCH',
      entityId: batchId,
      details: { reference: newBatch.reference, panelCount: newBatchPanelCount }
    });

    globalTrialStore.saveTrial(trial);
    setShowAddBatchModal(false);
    setNewBatchRef('');
    setNewBatchCoating('');
    onTrialUpdated();
  };

  const totalActivePanels = trial.batches.reduce(
    (acc, b) => acc + b.panels.filter((p) => p.status === 'ACTIVE').length,
    0
  );
  const totalPanels = trial.batches.reduce((acc, b) => acc + b.panels.length, 0);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">Référentiel Permanent : Lots & Panneaux</h3>
          <p className="text-xs text-slate-500">
            {trial.batches.length} lots expérimentaux • {totalActivePanels} éprouvettes actives sur {totalPanels} totaux
          </p>
        </div>

        {!isLocked ? (
          <button
            type="button"
            onClick={() => {
              setNewBatchRef(`LOT XX${trial.batches.length + 1}C`);
              setShowAddBatchModal(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un Lot
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">
            <Lock className="w-4 h-4 text-slate-500" />
            <span>Référentiel verrouillé (Acquisitions en cours)</span>
          </div>
        )}
      </div>

      {/* Explication & Règle Métier */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-800">Principe de pérennité des éprouvettes (PROMPT 6)</p>
          <p>
            Chaque panneau possède un identifiant pérenne et immuable (ex : <code>LOT XX1C-P01</code>). Les acquisitions pointent toujours vers ces éprouvettes. L'exclusion d'un panneau est motivée et conserve l'historique sans destruction physique.
          </p>
        </div>
      </div>

      {/* Liste des Lots */}
      <div className="space-y-6">
        {trial.batches.map((batch) => {
          const activePanels = batch.panels.filter((p) => p.status === 'ACTIVE').length;
          const excludedPanels = batch.panels.filter((p) => p.status === 'EXCLUDED').length;

          return (
            <div
              key={batch.id}
              className="border border-slate-200 rounded-2xl bg-white p-5 shadow-xs space-y-4"
            >
              {/* Batch Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs font-mono">
                    #{batch.orderIndex}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 font-mono">{batch.reference}</h4>
                      {batch.productReference && (
                        <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-slate-100 text-slate-700">
                          {batch.productReference}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      {batch.coatingSystem || 'Système non spécifié'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                    {activePanels} actif(s)
                  </span>
                  {excludedPanels > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 font-bold border border-rose-200">
                      {excludedPanels} exclu(s)
                    </span>
                  )}
                  <span className="text-slate-400 font-mono text-[11px]">UUID: {batch.id.slice(0, 8)}</span>
                </div>
              </div>

              {/* Batch Detailed Metadata Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Essence</span>
                  <span className="font-semibold text-slate-800">{batch.woodSpecies || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Fabricant / Fournisseur</span>
                  <span className="font-semibold text-slate-800">{batch.manufacturerOrSupplier || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Couches & Méthode</span>
                  <span className="font-semibold text-slate-800">
                    {batch.coatCount ? `${batch.coatCount} couches` : ''} {batch.applicationMethod ? `(${batch.applicationMethod})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Conditions / Séchage</span>
                  <span className="font-semibold text-slate-800">
                    {batch.applicationConditions || batch.dryingOrConditioningTime || '—'}
                  </span>
                </div>
                {batch.batchNotes && (
                  <div className="col-span-2 sm:col-span-4 pt-1 border-t border-slate-200/60 text-slate-600">
                    <span className="text-slate-400 font-bold mr-1">Remarques :</span>
                    {batch.batchNotes}
                  </div>
                )}
              </div>

              {/* Panels Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {batch.panels.map((panel) => {
                  const isExcluded = panel.status === 'EXCLUDED';
                  return (
                    <div
                      key={panel.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                        isExcluded
                          ? 'border-rose-200 bg-rose-50/60 opacity-80'
                          : 'border-slate-200 bg-white hover:border-blue-300 shadow-2xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {batch.reference}-{panel.label}
                          </span>
                          {!isExcluded && (
                            <button
                              type="button"
                              title="Exclure ce panneau de manière motivée"
                              onClick={() => handleOpenExclusion(batch, panel)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                              isExcluded ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {panel.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{panel.index}</span>
                        </div>
                      </div>

                      {isExcluded && (
                        <div className="mt-2 pt-2 border-t border-rose-200 text-[10px] text-rose-800 space-y-0.5">
                          <p className="font-bold">Motif :</p>
                          <p className="italic line-clamp-2">{panel.exclusionReason}</p>
                          <p className="text-[9px] text-rose-600 mt-0.5">
                            Par {panel.excludedBy} le {new Date(panel.excludedAt || '').toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Exclusion Motivée */}
      {selectedPanelForExclusion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-bold text-base text-slate-900">Exclusion Motivée d'Éprouvette</h4>
              </div>
              <button
                onClick={() => setSelectedPanelForExclusion(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              Vous vous apprêtez à exclure l'éprouvette{' '}
              <strong>
                {selectedPanelForExclusion.batch.reference} — {selectedPanelForExclusion.panel.label}
              </strong>
              . Elle ne sera plus prise en compte dans les calculs inter-panneaux ultérieurs, mais ses données antérieures resteront tracées.
            </div>

            {exclusionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                {exclusionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Opérateur Responsable *
              </label>
              <input
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Motif Obligatoire de l'Exclusion *
              </label>
              <textarea
                rows={3}
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
                placeholder="Explication technique : défaut de substrat, fissuration accidentelle, fente bois..."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPanelForExclusion(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmExclusion}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Confirmer l'Exclusion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout Nouveau Lot */}
      {showAddBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Ajouter un Lot Expérimental
              </h4>
              <button
                onClick={() => setShowAddBatchModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Référence Lot *
                </label>
                <input
                  type="text"
                  value={newBatchRef}
                  onChange={(e) => setNewBatchRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  placeholder="Ex: LOT XX4C"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre de Panneaux
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={newBatchPanelCount}
                  onChange={(e) => setNewBatchPanelCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Essence de bois
                </label>
                <input
                  type="text"
                  value={newBatchWood}
                  onChange={(e) => setNewBatchWood(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Produit / Finition
                </label>
                <input
                  type="text"
                  value={newBatchProduct}
                  onChange={(e) => setNewBatchProduct(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Ex: LAS-04"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Système de finition
                </label>
                <input
                  type="text"
                  value={newBatchCoating}
                  onChange={(e) => setNewBatchCoating(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Description du système..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddBatchModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAddBatch}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Créer le Lot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
