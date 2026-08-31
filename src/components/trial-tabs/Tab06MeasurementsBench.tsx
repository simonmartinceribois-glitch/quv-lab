/**
 * QUV-Lab — 06 Poste de Paillasse & Saisie de Campagne (PROMPT 6 - Sections 14, 15, 16 & 17)
 * Ergonomie de paillasse optimisée : Campagne par Famille sur tous les lots et panneaux,
 * navigation rapide, calculs scientifiques instantanés, contrôle qualité temps-réel, NEXT automatique.
 */

import React, { useState, useEffect } from 'react';
import {
  Trial,
  PanelAcquisitionRecord,
  BatchDefinition,
  PanelDefinition,
  MediaReference
} from '../../types/trial';
import {
  MeasurementFamilyId,
  ScientificRuleSet,
  ColorRawData,
  GlossRawData,
  PersozRawData,
  VisualObservationsRawData,
  VisualObservationItem,
  QualityStatus
} from '../../types/scientific';
import { globalTrialStore, generateUUID } from '../../services/trialStore';
import {
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Camera,
  Upload,
  Layers,
  Sparkles,
  Save,
  Check,
  RotateCcw,
  Zap,
  Info,
  Sliders,
  ShieldCheck
} from 'lucide-react';

interface Props {
  trial: Trial;
  selectedStageId: string;
  selectedFamilyId: MeasurementFamilyId;
  ruleSet: ScientificRuleSet;
  onFamilyChange: (family: MeasurementFamilyId) => void;
  onTrialUpdated: () => void;
}

export function Tab06MeasurementsBench({
  trial,
  selectedStageId,
  selectedFamilyId,
  ruleSet,
  onFamilyChange,
  onTrialUpdated
}: Props) {
  const currentStage = trial.stages.find((s) => s.id === selectedStageId) || trial.stages[0];
  const isInitialStage = currentStage.cycleIndex === 0;

  // Liste plate des panneaux actifs
  const activePanelsList = trial.batches.flatMap((b) =>
    b.panels.filter((p) => p.status === 'ACTIVE').map((p) => ({ batch: b, panel: p }))
  );

  const [selectedPanelId, setSelectedPanelId] = useState<string>(
    activePanelsList.length > 0 ? activePanelsList[0].panel.id : ''
  );

  const [operatorId, setOperatorId] = useState<string>('Simon Martin (Technicien)');
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [showValidationSummaryModal, setShowValidationSummaryModal] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Panneau actif sélectionné
  const currentPanelItem = activePanelsList.find((item) => item.panel.id === selectedPanelId) || activePanelsList[0];
  const currentBatch = currentPanelItem?.batch;
  const currentPanel = currentPanelItem?.panel;

  // Configuration de la famille active
  const famConfig = trial.config.familyConfigs[selectedFamilyId];
  const colorCount = famConfig?.countConfig?.configuredCount || 4;
  const persozCount = famConfig?.countConfig?.configuredCount || 3;
  const glossSeries = famConfig?.seriesConfig?.configuredConfiguration.seriesCount || 2;
  const glossReadingsPerSeries = famConfig?.seriesConfig?.configuredConfiguration.readingsPerSeries || 2;

  // Acquisition en cours
  const acqKey = `${currentStage.id}__${currentPanel?.id}__${selectedFamilyId}`;
  const currentRecord = trial.acquisitions[acqKey];

  // --- ÉTATS LOCAUX DE SAISIE RAPIDE ---
  // Couleur : tableau de points L, a, b
  const [colorReadings, setColorReadings] = useState<{ L: string; a: string; b: string }[]>(() => {
    return Array.from({ length: colorCount }, () => ({ L: '', a: '', b: '' }));
  });

  // Brillance : séries de points
  const [glossSeriesData, setGlossSeriesData] = useState<{ orientation: string; values: string[] }[]>(() => {
    return [
      { orientation: 'Sens du fil', values: Array.from({ length: glossReadingsPerSeries }, () => '') },
      { orientation: 'Perpendiculaire', values: Array.from({ length: glossReadingsPerSeries }, () => '') }
    ];
  });

  // Persoz : répétitions en secondes
  const [persozValues, setPersozValues] = useState<string[]>(() => {
    return Array.from({ length: persozCount }, () => '');
  });

  // Observations : liste de cotations
  const [observations, setObservations] = useState<VisualObservationItem[]>([
    { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
    { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
    { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
    { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
    { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Aspect uniforme' }
  ]);

  // Synchronisation lors du changement de panneau ou famille
  useEffect(() => {
    if (!currentPanel) return;
    const rec = trial.acquisitions[`${currentStage.id}__${currentPanel.id}__${selectedFamilyId}`];

    if (selectedFamilyId === 'COLOR') {
      const raw = rec?.raw as ColorRawData;
      if (raw && Array.isArray(raw.readings)) {
        const arr = Array.from({ length: colorCount }, (_, i) => {
          const pt = raw.readings[i];
          return {
            L: pt?.L !== null && pt?.L !== undefined ? pt.L.toString() : '',
            a: pt?.a !== null && pt?.a !== undefined ? pt.a.toString() : '',
            b: pt?.b !== null && pt?.b !== undefined ? pt.b.toString() : ''
          };
        });
        setColorReadings(arr);
      } else {
        setColorReadings(Array.from({ length: colorCount }, () => ({ L: '', a: '', b: '' })));
      }
    } else if (selectedFamilyId === 'GLOSS') {
      const raw = rec?.raw as GlossRawData;
      if (raw && Array.isArray(raw.series)) {
        const arr = raw.series.map((s) => ({
          orientation: s.orientation,
          values: s.readings.map((r) => (r.value !== null && r.value !== undefined ? r.value.toString() : ''))
        }));
        setGlossSeriesData(arr);
      } else {
        setGlossSeriesData([
          { orientation: 'Sens du fil', values: Array.from({ length: glossReadingsPerSeries }, () => '') },
          { orientation: 'Perpendiculaire', values: Array.from({ length: glossReadingsPerSeries }, () => '') }
        ]);
      }
    } else if (selectedFamilyId === 'PERSOZ') {
      const raw = rec?.raw as PersozRawData;
      if (raw && Array.isArray(raw.readings)) {
        const arr = raw.readings.map((r) =>
          r.dampingTimeSeconds !== null && r.dampingTimeSeconds !== undefined ? r.dampingTimeSeconds.toString() : ''
        );
        setPersozValues(arr);
      } else {
        setPersozValues(Array.from({ length: persozCount }, () => ''));
      }
    } else if (selectedFamilyId === 'OBSERVATIONS') {
      const raw = rec?.raw as VisualObservationsRawData;
      if (raw && Array.isArray(raw.observations)) {
        setObservations(raw.observations);
      } else {
        setObservations([
          { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Aspect uniforme' }
        ]);
      }
    }
  }, [selectedPanelId, selectedFamilyId, currentStage.id]);

  // Fonction d'enregistrement du panneau courant
  const handleSaveCurrentPanel = (autoAdvance = true) => {
    if (!currentPanel || !currentBatch) return;

    let rawPayload: unknown = null;

    if (selectedFamilyId === 'COLOR') {
      rawPayload = {
        readings: colorReadings.map((pt, idx) => ({
          pointIndex: idx + 1,
          L: pt.L !== '' ? parseFloat(pt.L) : null,
          a: pt.a !== '' ? parseFloat(pt.a) : null,
          b: pt.b !== '' ? parseFloat(pt.b) : null
        }))
      } as ColorRawData;
    } else if (selectedFamilyId === 'GLOSS') {
      rawPayload = {
        series: glossSeriesData.map((s, sIdx) => ({
          seriesIndex: sIdx + 1,
          orientation: s.orientation,
          readings: s.values.map((v, rIdx) => ({
            pointIndex: rIdx + 1,
            value: v !== '' ? parseFloat(v) : null
          }))
        })),
        instrumentMetadata: { instrumentId: 'TRI-GLOSS-60-LAB', geometry: '60' }
      } as GlossRawData;
    } else if (selectedFamilyId === 'PERSOZ') {
      rawPayload = {
        readings: persozValues.map((v, idx) => ({
          pointIndex: idx + 1,
          dampingTimeSeconds: v !== '' ? parseFloat(v) : null
        })),
        unit: 'SECONDS',
        instrumentMetadata: { temperatureCelsius: 21.5, relativeHumidityPercent: 50 }
      } as PersozRawData;
    } else if (selectedFamilyId === 'OBSERVATIONS') {
      rawPayload = {
        observations,
        assessedBy: operatorId,
        assessedAt: new Date().toISOString()
      } as VisualObservationsRawData;
    }

    globalTrialStore.recordAcquisition({
      trialId: trial.id,
      stageId: currentStage.id,
      batchId: currentBatch.id,
      panelId: currentPanel.id,
      familyId: selectedFamilyId,
      raw: rawPayload,
      operatorId
    });

    setSaveSuccessMsg(`Enregistré : ${currentBatch.reference} — ${currentPanel.label}`);
    setTimeout(() => setSaveSuccessMsg(null), 2000);
    onTrialUpdated();

    // NEXT automatique vers le panneau suivant incomplet
    if (autoAdvance) {
      const currentIdx = activePanelsList.findIndex((item) => item.panel.id === currentPanel.id);
      // Chercher d'abord le prochain incomplet
      const nextIncomplete = activePanelsList.find((item, idx) => {
        if (idx <= currentIdx) return false;
        const key = `${currentStage.id}__${item.panel.id}__${selectedFamilyId}`;
        const r = trial.acquisitions[key];
        return !r || !r.computed;
      });

      if (nextIncomplete) {
        setSelectedPanelId(nextIncomplete.panel.id);
      } else if (currentIdx < activePanelsList.length - 1) {
        setSelectedPanelId(activePanelsList[currentIdx + 1].panel.id);
      }
    }
  };

  // Remplissage rapide / Import simulation
  const handleFastPrefill = () => {
    if (selectedFamilyId === 'COLOR') {
      setColorReadings([
        { L: '62.5', a: '8.4', b: '24.2' },
        { L: '62.3', a: '8.5', b: '24.1' },
        { L: '62.6', a: '8.3', b: '24.3' },
        { L: '62.4', a: '8.4', b: '24.2' }
      ]);
    } else if (selectedFamilyId === 'GLOSS') {
      setGlossSeriesData([
        { orientation: 'Sens du fil', values: ['44.5', '44.8'] },
        { orientation: 'Perpendiculaire', values: ['43.2', '43.6'] }
      ]);
    } else if (selectedFamilyId === 'PERSOZ') {
      setPersozValues(['85.2', '84.8', '85.5']);
    }
  };

  // Association de photo
  const handleAttachPhoto = () => {
    if (!currentPanel) return;
    const filename = `photo-${currentPanel.label}-${currentStage.cycleIndex}-${Date.now()}.jpg`;
    globalTrialStore.attachPhoto({
      trialId: trial.id,
      panelId: currentPanel.id,
      stageId: currentStage.id,
      filename,
      caption: photoCaption || `Éprouvette ${currentPanel.label} à l'étape ${currentStage.name}`,
      operatorId
    });
    setPhotoCaption('');
    setSaveSuccessMsg('Photographie légendée associée');
    setTimeout(() => setSaveSuccessMsg(null), 2000);
    onTrialUpdated();
  };

  const computed = currentRecord?.computed as any;

  // Calcul du résumé de la campagne pour la famille
  const completedPanelsCount = activePanelsList.filter((item) => {
    const k = `${currentStage.id}__${item.panel.id}__${selectedFamilyId}`;
    const r = trial.acquisitions[k];
    return r && r.computed;
  }).length;

  const totalPanelsCount = activePanelsList.length;
  const isFamilyCampaignComplete = completedPanelsCount === totalPanelsCount && totalPanelsCount > 0;

  const currentStageIndex = trial.stages.findIndex((s) => s.id === currentStage.id);
  const stageStepNumber = currentStageIndex >= 0 ? currentStageIndex + 1 : currentStage.cycleIndex + 1;
  const totalStagesCount = trial.stages.length || 13;

  const stageHoursDisplay =
    currentStage.cycleIndex === 0
      ? 'T0 — 0 h'
      : `${currentStage.scheduledExposureHours} h`;

  const stageActionLabel =
    currentStage.stageType === 'INITIAL_PRE_EXPOSURE'
      ? 'MESURES INITIALES AVANT EXPOSITION'
      : currentStage.stageType === 'FINAL_POST_EXPOSURE'
      ? 'MESURES FINALES APRÈS EXPOSITION'
      : "MESURES EN COURS D'EXPOSITION";

  return (
    <div className="space-y-6">
      {/* 1. TOP BAR : Sélecteur de Famille de Mesure & Étape Active Normative */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-mono font-bold tracking-wider uppercase">
              ÉTAPE {stageStepNumber} / {totalStagesCount}
            </span>
            <span className="text-sm font-bold text-white font-mono">{stageHoursDisplay}</span>
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
              {stageActionLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Poste de Mesure de Paillasse par Famille • {currentStage.name}
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {(['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'] as MeasurementFamilyId[]).map((fam) => {
            const isSelected = selectedFamilyId === fam;
            const isEnabled = trial.config.activeFamilies.includes(fam);
            if (!isEnabled) return null;

            return (
              <button
                key={fam}
                onClick={() => onFamilyChange(fam)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>
                  {fam === 'COLOR'
                    ? '🎨 Couleur'
                    : fam === 'GLOSS'
                    ? '✨ Brillance'
                    : fam === 'PERSOZ'
                    ? '⏱️ Persoz'
                    : '🔍 Observations'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. GRILLE PANORAMIQUE DES ÉPROUVETTES */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Éprouvettes de la Campagne ({completedPanelsCount}/{totalPanelsCount})
            </span>
            <span className="text-xs text-slate-500 font-mono">
              • {Math.round((completedPanelsCount / (totalPanelsCount || 1)) * 100)}% complété
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowValidationSummaryModal(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isFamilyCampaignComplete
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Validation Campagne ({selectedFamilyId})
          </button>
        </div>

        {/* Matrice des boutons d'éprouvettes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {activePanelsList.map(({ batch, panel }) => {
            const isSelected = panel.id === currentPanel?.id;
            const rec = trial.acquisitions[`${currentStage.id}__${panel.id}__${selectedFamilyId}`];
            const isDone = !!rec && !!rec.computed;
            const hasWarning = rec?.status === 'WARNING';
            const hasError = rec?.status === 'ERROR';

            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => setSelectedPanelId(panel.id)}
                className={`p-2 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/20'
                    : isDone
                    ? hasError
                      ? 'border-rose-300 bg-rose-50/50'
                      : hasWarning
                      ? 'border-amber-300 bg-amber-50/50'
                      : 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                }`}
              >
                <div className="text-[10px] text-slate-500 font-mono truncate">{batch.reference}</div>
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="text-slate-900">{panel.label}</span>
                  <span>
                    {isDone ? (
                      hasError ? (
                        '🔴'
                      ) : hasWarning ? (
                        '🟡'
                      ) : (
                        '🟢'
                      )
                    ) : (
                      '⚪'
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. POSTE DE SAISIE DE PAILLASSE DU PANNEAU ACTIF */}
      {currentPanel && currentBatch && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonne Gauche : Formulaire de saisie (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            {/* Header du panneau */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-md bg-blue-100 text-blue-800">
                    {currentBatch.reference}
                  </span>
                  <h4 className="text-lg font-bold text-slate-900">Éprouvette {currentPanel.label}</h4>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentBatch.coatingSystem || 'Finition standard'} • Essence : {currentBatch.woodSpecies || 'Chêne'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFastPrefill}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
                  title="Pré-remplissage rapide pour test"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Test Rapide
                </button>
              </div>
            </div>

            {/* Formulaire spécifique à la famille */}
            {/* --- COULEUR --- */}
            {selectedFamilyId === 'COLOR' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Saisie des {colorCount} coordonnées colorimétriques (CIE L*a*b*)
                  </span>
                  <span className="text-xs text-slate-500 font-mono">D65 / 10°</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-2 px-3 text-left">Point</th>
                        <th className="py-2 px-3 text-center">L* (Clarté)</th>
                        <th className="py-2 px-3 text-center">a* (Axe Vert-Rouge)</th>
                        <th className="py-2 px-3 text-center">b* (Axe Bleu-Jaune)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {colorReadings.map((reading, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">Pt #{idx + 1}</td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.01"
                              value={reading.L}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColorReadings(colorReadings.map((r, i) => (i === idx ? { ...r, L: val } : r)));
                              }}
                              placeholder="ex: 62.4"
                              className="w-24 px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.01"
                              value={reading.a}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColorReadings(colorReadings.map((r, i) => (i === idx ? { ...r, a: val } : r)));
                              }}
                              placeholder="ex: 8.2"
                              className="w-24 px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.01"
                              value={reading.b}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColorReadings(colorReadings.map((r, i) => (i === idx ? { ...r, b: val } : r)));
                              }}
                              placeholder="ex: 24.1"
                              className="w-24 px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- BRILLANCE --- */}
            {selectedFamilyId === 'GLOSS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Saisie Brillance 60° par Séries & Orientations
                  </span>
                  <span className="text-xs text-slate-500 font-mono">NF EN 927-6 Clause 6.3.3</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {glossSeriesData.map((series, sIdx) => (
                    <div key={sIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 font-mono">
                          Série #{sIdx + 1} : {series.orientation}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {series.values.map((val, rIdx) => (
                          <div key={rIdx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 font-mono">Relevé #{rIdx + 1} :</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.1"
                                value={val}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setGlossSeriesData(
                                    glossSeriesData.map((s, i) =>
                                      i === sIdx
                                        ? { ...s, values: s.values.map((v, j) => (j === rIdx ? newVal : v)) }
                                        : s
                                    )
                                  );
                                }}
                                placeholder="ex: 45.0"
                                className="w-24 px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-[11px] font-bold text-slate-400">GU</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- PERSOZ --- */}
            {selectedFamilyId === 'PERSOZ' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                    Saisie du Temps d'Amortissement Persoz (Secondes)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800">
                    Recommandation Labo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {persozValues.map((val, idx) => (
                    <div key={idx} className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-purple-900">Répétition #{idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          value={val}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setPersozValues(persozValues.map((v, i) => (i === idx ? newVal : v)));
                          }}
                          placeholder="ex: 85.0"
                          className="w-full px-2 py-1.5 text-center font-bold bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-xs font-bold text-purple-700">s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- OBSERVATIONS --- */}
            {selectedFamilyId === 'OBSERVATIONS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Cotations des Défauts d'Aspect (ISO 4628 / ISO 2409)
                  </span>
                  <span className="text-xs text-slate-500 font-mono">0 = Intact, 5 = Altération Sévère</span>
                </div>

                <div className="space-y-2.5">
                  {observations.map((obs, idx) => (
                    <div
                      key={obs.category}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="sm:w-1/3">
                        <span className="font-bold text-slate-900">{obs.categoryLabel}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-slate-500 font-semibold">Note :</label>
                        <select
                          value={obs.rating}
                          onChange={(e) => {
                            const rVal = parseInt(e.target.value, 10);
                            setObservations(
                              observations.map((o, i) =>
                                i === idx
                                  ? {
                                      ...o,
                                      rating: rVal,
                                      status: rVal === 0 ? 'CONFORME' : 'OBSERVE',
                                      comment: rVal === 0 ? 'Aucun' : `Défaut note ${rVal}`
                                    }
                                  : o
                              )
                            );
                          }}
                          className="px-2 py-1 font-bold bg-white border border-slate-300 rounded-lg"
                        >
                          <option value={0}>0 — Aucun défaut</option>
                          <option value={1}>1 — Très léger</option>
                          <option value={2}>2 — Modéré</option>
                          <option value={3}>3 — Prononcé (Alerte)</option>
                          <option value={4}>4 — Très prononcé</option>
                          <option value={5}>5 — Rupture / Destruction</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={obs.comment || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setObservations(observations.map((o, i) => (i === idx ? { ...o, comment: val } : o)));
                          }}
                          placeholder="Remarques éventuelles..."
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photographie & Légende */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-600" />
                Associer une Photographie Légendée
              </span>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="Légende (ex: Micro-fissures visibles au niveau du joint de colle)"
                  className="flex-1 text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleAttachPhoto}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Associer Photo
                </button>
              </div>
            </div>

            {/* Actions de validation du panneau */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div>
                {saveSuccessMsg && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fadeIn">
                    <Check className="w-4 h-4" />
                    {saveSuccessMsg}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveCurrentPanel(false)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCurrentPanel(true)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider ce Panneau & Passer au Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Colonne Droite : Calculs Scientifiques Instantanés & Contrôle Qualité (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Card Qualité du relevé */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Contrôle Qualité Temps-Réel
                </h5>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    computed?.qualityAssessment?.status === 'GOOD'
                      ? 'bg-emerald-100 text-emerald-800'
                      : computed?.qualityAssessment?.status === 'WARNING'
                      ? 'bg-amber-100 text-amber-800'
                      : computed?.qualityAssessment?.status === 'INVALID'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {computed?.qualityAssessment?.status || 'EN_ATTENTE'}
                </span>
              </div>

              {computed?.qualityAssessment ? (
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Points valides :</span>
                    <strong className="text-slate-900">
                      {computed.qualityAssessment.validCount} / {computed.qualityAssessment.totalCount}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Complétude :</span>
                    <strong className="text-emerald-700">
                      {computed.qualityAssessment.completionRatePercent}%
                    </strong>
                  </div>

                  {/* Alertes éventuelles */}
                  {currentRecord?.alerts && currentRecord.alerts.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                        Alertes Métrologiques :
                      </span>
                      {currentRecord.alerts.map((al, aIdx) => (
                        <div
                          key={aIdx}
                          className={`p-2 rounded-lg text-[11px] font-medium flex items-start gap-1.5 ${
                            al.severity === 'BLOCKING'
                              ? 'bg-rose-50 border border-rose-200 text-rose-800'
                              : 'bg-amber-50 border border-amber-200 text-amber-900'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{al.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Saisissez les points et enregistrez pour déclencher l'évaluation.
                </div>
              )}
            </div>

            {/* Card Grandeurs Calculées Instantanées */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                Grandeurs Dérivées (Moteur PROMPT 5)
              </h5>

              {computed ? (
                <div className="space-y-2.5 text-xs text-slate-700 font-mono">
                  {/* COULEUR */}
                  {selectedFamilyId === 'COLOR' && (
                    <>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Moyenne L* :</span>
                        <strong>{computed.meanL !== null ? computed.meanL.toFixed(2) : '—'}</strong>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Moyenne a* :</span>
                        <strong>{computed.meanA !== null ? computed.meanA.toFixed(2) : '—'}</strong>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Moyenne b* :</span>
                        <strong>{computed.meanB !== null ? computed.meanB.toFixed(2) : '—'}</strong>
                      </div>
                      {!isInitialStage && (
                        <div className="flex justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-bold">
                          <span>Écart Total ΔE*ab :</span>
                          <span>{computed.deltaE !== null ? computed.deltaE.toFixed(2) : '—'}</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* BRILLANCE */}
                  {selectedFamilyId === 'GLOSS' && (
                    <>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Moyenne Brillance :</span>
                        <strong>{computed.meanGloss !== null ? `${computed.meanGloss.toFixed(1)} GU` : '—'}</strong>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Écart-type s :</span>
                        <strong>{computed.stdDevGloss !== null ? computed.stdDevGloss.toFixed(2) : '—'}</strong>
                      </div>
                      {!isInitialStage && (
                        <div className="flex justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-bold">
                          <span>Taux de Rétention :</span>
                          <span>
                            {computed.retentionRatePercent !== null
                              ? `${computed.retentionRatePercent.toFixed(1)} %`
                              : '—'}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* PERSOZ */}
                  {selectedFamilyId === 'PERSOZ' && (
                    <>
                      <div className="flex justify-between p-2 bg-purple-50 rounded-lg text-purple-950">
                        <span>Moyenne Amortissement :</span>
                        <strong>
                          {computed.meanDampingTime !== null ? `${computed.meanDampingTime.toFixed(1)} s` : '—'}
                        </strong>
                      </div>
                      <div className="flex justify-between p-2 bg-purple-50 rounded-lg text-purple-950">
                        <span>Coeff. Variation CV% :</span>
                        <strong>
                          {computed.coefficientOfVariationPercent !== null
                            ? `${computed.coefficientOfVariationPercent.toFixed(1)} %`
                            : '—'}
                        </strong>
                      </div>
                    </>
                  )}

                  {/* OBSERVATIONS */}
                  {selectedFamilyId === 'OBSERVATIONS' && (
                    <>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-slate-500">Synthèse :</span>
                        <div className="font-sans font-bold text-slate-900 mt-1">{computed.summary}</div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">Aucun calcul disponible.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÉCAPITULATIF AVANT VALIDATION DE CAMPAGNE FAMILLE */}
      {showValidationSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-base text-slate-900">
                  Validation de Campagne — {selectedFamilyId}
                </h4>
              </div>
              <button
                onClick={() => setShowValidationSummaryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="font-bold uppercase tracking-wider text-slate-700 mb-1">
                Bilan de Complétude & Qualité :
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  Panneaux actifs attendus : <strong>{totalPanelsCount}</strong>
                </div>
                <div>
                  Panneaux mesurés : <strong>{completedPanelsCount}</strong>
                </div>
                <div>
                  Taux de réalisation :{' '}
                  <strong className="text-emerald-700">
                    {Math.round((completedPanelsCount / (totalPanelsCount || 1)) * 100)}%
                  </strong>
                </div>
                <div>
                  Statut de campagne :{' '}
                  <strong className={isFamilyCampaignComplete ? 'text-emerald-700' : 'text-amber-700'}>
                    {isFamilyCampaignComplete ? 'COMPLÈTE' : 'INCOMPLÈTE'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>
                La validation atteste de la complétude et de la qualité métrologique des relevés pour cette famille à l'étape <strong>{currentStage.name}</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowValidationSummaryModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300"
              >
                Fermer
              </button>

              <div className="flex items-center gap-2">
                {selectedFamilyId !== 'OBSERVATIONS' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowValidationSummaryModal(false);
                      const fams: MeasurementFamilyId[] = ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'];
                      const curIdx = fams.indexOf(selectedFamilyId);
                      if (curIdx < fams.length - 1) {
                        onFamilyChange(fams[curIdx + 1]);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    Passer à la Famille Suivante
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
