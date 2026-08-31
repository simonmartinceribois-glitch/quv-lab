/**
 * QUV-Lab — 05 Suivi & Validation des Étapes (PROMPT 6 - Sections 14, 15 & 18)
 * Tableau de bord d'étape, avancement par famille de mesure, et validation d'étape.
 */

import React, { useState } from 'react';
import { Trial, ExposureStage } from '../../types/trial';
import { MeasurementFamilyId } from '../../types/scientific';
import { globalTrialStore } from '../../services/trialStore';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  ChevronRight,
  ShieldCheck,
  Info,
  Save,
  Check,
  FileCheck,
  X
} from 'lucide-react';

interface Props {
  trial: Trial;
  selectedStageId: string;
  onSelectStageId: (stageId: string) => void;
  onNavigateToFamilyBench: (familyId: MeasurementFamilyId) => void;
  onTrialUpdated: () => void;
}

export function Tab05Stages({
  trial,
  selectedStageId,
  onSelectStageId,
  onNavigateToFamilyBench,
  onTrialUpdated
}: Props) {
  const currentStage = trial.stages.find((s) => s.id === selectedStageId) || trial.stages[0];

  const [actualHours, setActualHours] = useState<string>(
    currentStage.actualExposureHours !== undefined ? currentStage.actualExposureHours.toString() : ''
  );
  const [operatorId, setOperatorId] = useState<string>('Simon Martin (Technicien)');
  const [validationNotes, setValidationNotes] = useState<string>('');
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [saveHoursSuccess, setSaveHoursSuccess] = useState(false);

  const activePanels = trial.batches.flatMap((b) => b.panels).filter((p) => p.status === 'ACTIVE');
  const totalActivePanelsCount = activePanels.length;

  // Calcul des statistiques de complétude par famille pour l'étape courante
  const familyStats: Record<
    MeasurementFamilyId,
    { completed: number; total: number; warningCount: number; errorCount: number }
  > = {
    COLOR: { completed: 0, total: totalActivePanelsCount, warningCount: 0, errorCount: 0 },
    GLOSS: { completed: 0, total: totalActivePanelsCount, warningCount: 0, errorCount: 0 },
    PERSOZ: { completed: 0, total: totalActivePanelsCount, warningCount: 0, errorCount: 0 },
    OBSERVATIONS: { completed: 0, total: totalActivePanelsCount, warningCount: 0, errorCount: 0 }
  };

  for (const panel of activePanels) {
    for (const fam of trial.config.activeFamilies) {
      const key = `${currentStage.id}__${panel.id}__${fam}`;
      const rec = trial.acquisitions[key];
      if (rec && rec.computed) {
        familyStats[fam].completed++;
        if (rec.status === 'WARNING') familyStats[fam].warningCount++;
        if (rec.status === 'ERROR') familyStats[fam].errorCount++;
      }
    }
  }

  const allFamiliesComplete = trial.config.activeFamilies.every(
    (fam) => familyStats[fam].completed === totalActivePanelsCount && totalActivePanelsCount > 0
  );

  const handleSaveHours = () => {
    const val = parseFloat(actualHours);
    if (!isNaN(val)) {
      currentStage.actualExposureHours = val;
      globalTrialStore.saveTrial(trial);
      setSaveHoursSuccess(true);
      setTimeout(() => setSaveHoursSuccess(false), 2000);
      onTrialUpdated();
    }
  };

  const handleConfirmValidation = () => {
    globalTrialStore.validateStage(trial.id, currentStage.id, operatorId, validationNotes);
    setShowValidationModal(false);
    onTrialUpdated();
  };

  const isValidated = currentStage.status === 'VALIDATED';

  return (
    <div className="space-y-6">
      {/* Selector of stages */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {trial.stages.map((stage) => {
          const isSelected = stage.id === currentStage.id;
          const isVal = stage.status === 'VALIDATED';
          const isInProg = stage.status === 'IN_PROGRESS';

          return (
            <button
              key={stage.id}
              onClick={() => {
                onSelectStageId(stage.id);
                setActualHours(stage.actualExposureHours !== undefined ? stage.actualExposureHours.toString() : '');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isVal
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : isInProg
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isVal && <CheckCircle2 className="w-3.5 h-3.5" />}
              {isInProg && !isVal && <PlayCircle className="w-3.5 h-3.5" />}
              {stage.cycleIndex === 0 ? 'T0 (0 h)' : `${stage.scheduledExposureHours} h`}
            </button>
          );
        })}
      </div>

      {/* Stage Detail Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">{currentStage.name}</h3>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  isValidated
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentStage.status === 'IN_PROGRESS'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {currentStage.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Exposition théorique prévue : <strong>{currentStage.scheduledExposureHours} heures</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isValidated ? (
              <button
                type="button"
                onClick={() => setShowValidationModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                Valider l'Étape
              </button>
            ) : (
              <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Étape Validée par {currentStage.validatedBy} le {new Date(currentStage.validatedAt || '').toLocaleDateString('fr-FR')}
              </div>
            )}
          </div>
        </div>

        {/* Input Heures réelles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Heures réelles d'exposition (h)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                placeholder={currentStage.scheduledExposureHours.toString()}
                className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveHours}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                {saveHoursSuccess ? '✓' : 'Fixer'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Date effective du relevé
            </label>
            <input
              type="text"
              disabled
              value={currentStage.measuredAt ? new Date(currentStage.measuredAt).toLocaleString('fr-FR') : 'En cours...'}
              className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Panneaux actifs attendus
            </label>
            <div className="text-xs font-bold text-slate-900 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              {totalActivePanelsCount} éprouvettes sur {trial.batches.length} lots
            </div>
          </div>
        </div>
      </div>

      {/* Family Progress Cards */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Avancement des Campagnes par Famille de Mesure
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trial.config.activeFamilies.map((fam) => {
            const stats = familyStats[fam];
            const percent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            const isComplete = stats.completed === stats.total && stats.total > 0;

            return (
              <div
                key={fam}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {fam === 'COLOR'
                          ? '🎨 COULEUR (CIE L*a*b*)'
                          : fam === 'GLOSS'
                          ? '✨ BRILLANCE (GU 60°)'
                          : fam === 'PERSOZ'
                          ? '⏱️ DURETÉ PERSOZ'
                          : '🔍 OBSERVATIONS VISUELLES'}
                      </span>
                      {fam === 'PERSOZ' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800">
                          Recommandation Labo
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                        isComplete
                          ? 'bg-emerald-100 text-emerald-800'
                          : stats.completed > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {stats.completed} / {stats.total} ({percent}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isComplete ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Alerts info */}
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {stats.warningCount > 0 && (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {stats.warningCount} avec avertissement
                      </span>
                    )}
                    {stats.errorCount > 0 && (
                      <span className="text-rose-700 font-semibold">
                        {stats.errorCount} invalide(s)
                      </span>
                    )}
                    {stats.warningCount === 0 && stats.errorCount === 0 && isComplete && (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Toutes acquisitions conformes au protocole
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToFamilyBench(fam)}
                  className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-blue-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <PlayCircle className="w-4 h-4 text-blue-600" />
                  {isComplete ? 'Consulter la Campagne' : 'Ouvrir le Poste de Mesure'}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Validation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <h4 className="font-bold text-base text-slate-900">Validation de l'Étape {currentStage.name}</h4>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-800 uppercase tracking-wider">État des Familles :</div>
                {trial.config.activeFamilies.map((fam) => (
                  <div key={fam} className="flex justify-between">
                    <span>{fam} :</span>
                    <strong>{familyStats[fam].completed} / {familyStats[fam].total} éprouvettes</strong>
                  </div>
                ))}
              </div>

              {!allFamiliesComplete && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Campagne incomplète :</span> Certaines éprouvettes n'ont pas encore été mesurées pour toutes les familles actives.
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Opérateur Valideur *
              </label>
              <input
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Observations & Commentaires de Validation
              </label>
              <textarea
                rows={2}
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="ex: Relevés validés sans anomalies métrologiques majeures."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmValidation}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmer la Validation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
