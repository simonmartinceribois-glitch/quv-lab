/**
 * QUV-Lab — 04 Calendrier d'Exposition (PROMPT 6 - Section 13)
 * Visualisation graphique et suivi chronologique des 13 étapes d'exposition.
 */

import React from 'react';
import { Trial, ExposureStage } from '../../types/trial';
import {
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  Circle,
  AlertCircle,
  Info
} from 'lucide-react';

interface Props {
  trial: Trial;
  onSelectStage?: (stageId: string) => void;
}

export function Tab04Calendar({ trial, onSelectStage }: Props) {
  const validatedCount = trial.stages.filter((s) => s.status === 'VALIDATED').length;
  const inProgressStage = trial.stages.find((s) => s.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Calendrier d'Exposition UV (NF EN 927-6)</h3>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
              13 Étapes (T0 + 12 Cycles)
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Cycles d'exposition de 168 h (1 semaine) • {validatedCount} validée(s) •{' '}
            {inProgressStage ? `Étape active : ${inProgressStage.name}` : 'Toutes étapes terminées'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Validée
          </span>
          <span className="flex items-center gap-1 font-semibold text-blue-700 ml-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> En cours
          </span>
          <span className="flex items-center gap-1 font-semibold text-slate-400 ml-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Planifiée
          </span>
        </div>
      </div>

      {/* Explication normative */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-800">Rythme des cycles de vieillissement</p>
          <p>
            Chaque cycle élémentaire de 168 h combine des phases d'exposition aux rayonnements UV-A (340 nm) et des condensations chaudes. Les heures réelles d'exposition sont consignées à chaque relevé métrologique.
          </p>
        </div>
      </div>

      {/* Timeline List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {trial.stages.map((stage) => {
          const isValidated = stage.status === 'VALIDATED';
          const isInProgress = stage.status === 'IN_PROGRESS';
          const isInitial = stage.cycleIndex === 0;
          const isFinal = stage.cycleIndex === 12;

          return (
            <div
              key={stage.id}
              onClick={() => onSelectStage && onSelectStage(stage.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                isInProgress
                  ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-xs'
                  : isValidated
                  ? 'border-emerald-200 bg-white hover:border-emerald-300 shadow-xs'
                  : 'border-slate-200 bg-slate-50/60 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isInProgress
                        ? 'bg-blue-600 text-white'
                        : isValidated
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isInitial ? 'T0' : `C${stage.cycleIndex}`}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{stage.name}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {stage.scheduledExposureHours} h prévues
                    </span>
                  </div>
                </div>

                <div>
                  {isValidated ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Validée
                    </span>
                  ) : isInProgress ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 flex items-center gap-1 animate-pulse">
                      <PlayCircle className="w-3 h-3" />
                      En cours
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                      <Circle className="w-2.5 h-2.5" />
                      Planifiée
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2 mt-2">
                <div className="flex justify-between">
                  <span>Heures réelles d'exposition :</span>
                  <strong className="text-slate-900 font-mono">
                    {stage.actualExposureHours !== undefined ? `${stage.actualExposureHours} h` : '—'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Date du relevé :</span>
                  <span>
                    {stage.measuredAt
                      ? new Date(stage.measuredAt).toLocaleDateString('fr-FR')
                      : new Date(stage.scheduledAt || '').toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {isValidated && stage.validatedBy && (
                  <div className="text-[10px] text-emerald-700 italic pt-1">
                    Validée par {stage.validatedBy} le {new Date(stage.validatedAt || '').toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
