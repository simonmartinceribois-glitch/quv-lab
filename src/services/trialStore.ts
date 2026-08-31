/**
 * QUV-Lab — Magasin d'Essais & Service de Gestion Métier (PROMPT 6)
 * Gère la persistance locale, les maquettes d'essai de référence, le verrouillage de configuration,
 * l'enregistrement des acquisitions par famille, les validations d'étape et l'audit trail.
 */

import {
  Trial,
  TrialMetadata,
  CommonCharacteristics,
  BatchDefinition,
  PanelDefinition,
  ExposureStage,
  ExposureStageType,
  PanelAcquisitionRecord,
  AuditEvent,
  MediaReference,
  TrialProtocolConfig
} from '../types/trial';
import {
  UUID,
  MeasurementFamilyId,
  ScientificRuleSet,
  ColorRawData,
  GlossRawData,
  PersozRawData,
  VisualObservationsRawData,
  ScientificRuleOrigin,
  ScientificReport,
  ScientificReportStatus,
  ScientificReportReviewComment
} from '../types/scientific';
import { getDefaultScientificRuleSet, createCountConfiguration, createSeriesConfiguration } from '../scientific/ruleSet';
import { recalculateAcquisition } from '../scientific/recalculator';
import { createConfigChangeEvent } from '../scientific/auditEngine';
import { buildScientificReport } from './reportGenerator';

const STORAGE_KEY = 'quv_lab_trials_v1_2';

/**
 * Générateur d'UUID simple
 */
export function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Génère les 13 étapes d'exposition standard NF EN 927-6 (T0 + 12 cycles de 168h)
 */
export function generateStandardExposureStages(trialId: UUID): ExposureStage[] {
  const stages: ExposureStage[] = [];
  const baseDate = new Date('2026-08-30T08:00:00Z');

  // Étape initiale T0 (0 h) — MESURES INITIALES AVANT EXPOSITION
  stages.push({
    id: `stage-${trialId}-0`,
    trialId,
    cycleIndex: 0,
    stageType: 'INITIAL_PRE_EXPOSURE',
    name: 'T0 — MESURES INITIALES AVANT EXPOSITION',
    scheduledExposureHours: 0,
    actualExposureHours: 0,
    scheduledAt: baseDate.toISOString(),
    measuredAt: baseDate.toISOString(),
    status: 'VALIDATED',
    validatedBy: 'SM',
    validatedAt: '2026-08-30T12:00:00Z',
    notes: 'Mesures initiales de référence réalisées avant toute exposition UV.'
  });

  // 12 Cycles de 168h (168h à 2016h)
  for (let i = 1; i <= 12; i++) {
    const cycleHours = i * 168;
    const scheduledDate = new Date(baseDate.getTime() + i * 7 * 24 * 3600 * 1000);
    const isFinal = i === 12;

    stages.push({
      id: `stage-${trialId}-${i}`,
      trialId,
      cycleIndex: i,
      stageType: isFinal ? 'FINAL_POST_EXPOSURE' : 'INTERMEDIATE_DURING_EXPOSURE',
      name: isFinal
        ? '2016 h — MESURES FINALES APRÈS EXPOSITION'
        : `${cycleHours} h — MESURES EN COURS D'EXPOSITION`,
      scheduledExposureHours: cycleHours,
      actualExposureHours: i === 1 ? 168 : i === 2 ? 335.8 : undefined,
      scheduledAt: scheduledDate.toISOString(),
      measuredAt: i === 1 ? '2026-09-06T14:30:00Z' : i === 2 ? '2026-09-13T10:15:00Z' : undefined,
      status: i === 1 ? 'VALIDATED' : i === 2 ? 'IN_PROGRESS' : 'NOT_STARTED',
      validatedBy: i === 1 ? 'SM' : undefined,
      validatedAt: i === 1 ? '2026-09-06T17:00:00Z' : undefined,
      notes: i === 1 ? 'Relevé intermédiaire 168h validé sans anomalie.' : undefined
    });
  }

  return stages;
}

/**
 * Crée un essai de démonstration complet représentatif d'une campagne active
 */
function createDemoTrial(ruleSet: ScientificRuleSet): Trial {
  const trialId = 'quv-trial-2026-042';

  const metadata: TrialMetadata = {
    reference: 'QUV-2026-042',
    title: 'Système Lasurage Chêne Haute Durabilité',
    projectOrClient: 'Projet X — Ceribois & Partenaires',
    coatingSystemDescription: 'Système 3 couches lasure acrylique microporeuse en phase aqueuse',
    substrateDescription: 'Chêne européen (Quercus robur) quartier/faux-quartier 150×75×15 mm',
    createdBy: 'Simon Martin (Technicien Labo)',
    generalNotes: 'Campagne de vieillissement accéléré selon NF EN 927-6 (cycles UV-A 340nm + condensation).'
  };

  const commonCharacteristics: CommonCharacteristics = {
    dimensions: {
      lengthMm: 150,
      widthMm: 75,
      thicknessMm: 15,
      unit: 'mm'
    },
    substrateNature: 'Bois massif',
    materialType: 'Chêne européen (Quercus robur)',
    woodGrainOrientation: 'Sur quartier (NF EN 927-6)',
    preparationNotes: 'Rabotage fin, ponçage grain P120, dépoussiérage, stabilisation 7 jours à 20°C / 65% HR',
    conditioningNotes: 'Conditionnement selon NF EN 927-6 §5 (20±2°C, 65±5% HR jusqu\'à masse constante)',
    generalProtocolNotes: 'Toutes les éprouvettes ont été préparées sur le même lot d\'approvisionnement de bois.'
  };

  const batches: BatchDefinition[] = [
    {
      id: `batch-${trialId}-1`,
      trialId,
      reference: 'LOT XX1C',
      orderIndex: 1,
      coatingSystem: 'Lasure Acrylique Standard (Témoin)',
      woodSpecies: 'Chêne',
      productReference: 'LAS-STD-01',
      manufacturerOrSupplier: 'Fournisseur Alpha',
      coatCount: 3,
      substratePreparation: 'Ponçage P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: '2026-08-20',
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      batchNotes: 'Lot témoin sans agent anti-UV renforcé',
      panels: [
        { id: `panel-${trialId}-1-1`, batchId: `batch-${trialId}-1`, index: 1, label: 'P01', status: 'ACTIVE' },
        { id: `panel-${trialId}-1-2`, batchId: `batch-${trialId}-1`, index: 2, label: 'P02', status: 'ACTIVE' },
        { id: `panel-${trialId}-1-3`, batchId: `batch-${trialId}-1`, index: 3, label: 'P03', status: 'ACTIVE' },
        { id: `panel-${trialId}-1-4`, batchId: `batch-${trialId}-1`, index: 4, label: 'P04', status: 'ACTIVE' }
      ]
    },
    {
      id: `batch-${trialId}-2`,
      trialId,
      reference: 'LOT XX2C',
      orderIndex: 2,
      coatingSystem: 'Lasure Formulation Anti-UV HALS 1.5%',
      woodSpecies: 'Chêne',
      productReference: 'LAS-UV15-02',
      manufacturerOrSupplier: 'Fournisseur Alpha',
      coatCount: 3,
      substratePreparation: 'Ponçage P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: '2026-08-20',
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      batchNotes: 'Formulation avec stabilisants lumière HALS',
      panels: [
        { id: `panel-${trialId}-2-1`, batchId: `batch-${trialId}-2`, index: 1, label: 'P01', status: 'ACTIVE' },
        { id: `panel-${trialId}-2-2`, batchId: `batch-${trialId}-2`, index: 2, label: 'P02', status: 'ACTIVE' },
        { id: `panel-${trialId}-2-3`, batchId: `batch-${trialId}-2`, index: 3, label: 'P03', status: 'ACTIVE' },
        { id: `panel-${trialId}-2-4`, batchId: `batch-${trialId}-2`, index: 4, label: 'P04', status: 'ACTIVE' }
      ]
    },
    {
      id: `batch-${trialId}-3`,
      trialId,
      reference: 'LOT XX3C',
      orderIndex: 3,
      coatingSystem: 'Lasure Nano-TiO2 Hybride 2.0%',
      woodSpecies: 'Chêne',
      productReference: 'LAS-NANO-03',
      manufacturerOrSupplier: 'Fournisseur Bêta',
      coatCount: 3,
      substratePreparation: 'Ponçage P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: '2026-08-20',
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      batchNotes: 'Formulation nano-charges minérales absorbantes',
      panels: [
        { id: `panel-${trialId}-3-1`, batchId: `batch-${trialId}-3`, index: 1, label: 'P01', status: 'ACTIVE' },
        { id: `panel-${trialId}-3-2`, batchId: `batch-${trialId}-3`, index: 2, label: 'P02', status: 'ACTIVE' },
        { id: `panel-${trialId}-3-3`, batchId: `batch-${trialId}-3`, index: 3, label: 'P03', status: 'ACTIVE' },
        { id: `panel-${trialId}-3-4`, batchId: `batch-${trialId}-3`, index: 4, label: 'P04', status: 'ACTIVE' }
      ]
    }
  ];

  const protocolConfig: TrialProtocolConfig = {
    standardReference: 'NF EN 927-6',
    activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'],
    familyConfigs: {
      COLOR: {
        familyId: 'COLOR',
        enabled: true,
        countConfig: createCountConfiguration('COLOR', 4, ruleSet)
      },
      GLOSS: {
        familyId: 'GLOSS',
        enabled: true,
        seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, ruleSet)
      },
      PERSOZ: {
        familyId: 'PERSOZ',
        enabled: true,
        countConfig: createCountConfiguration('PERSOZ', 3, ruleSet)
      },
      OBSERVATIONS: {
        familyId: 'OBSERVATIONS',
        enabled: true
      }
    }
  };

  const stages = generateStandardExposureStages(trialId);

  const auditTrail: AuditEvent[] = [
    {
      id: 'audit-1',
      trialId,
      timestamp: '2026-08-30T08:15:00Z',
      operatorId: 'SM',
      action: 'CREATE_TRIAL',
      entityType: 'TRIAL',
      entityId: trialId,
      details: { reference: 'QUV-2026-042', title: metadata.title }
    },
    {
      id: 'audit-2',
      trialId,
      timestamp: '2026-08-30T08:20:00Z',
      operatorId: 'SM',
      action: 'CONFIGURE_PROTOCOL',
      entityType: 'PROTOCOL',
      entityId: 'ALL',
      details: { activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'], colorPoints: 4, glossSeries: '2x2' }
    },
    {
      id: 'audit-3',
      trialId,
      timestamp: '2026-08-30T08:35:00Z',
      operatorId: 'SM',
      action: 'CREATE_BATCH',
      entityType: 'BATCH',
      entityId: batches[0].id,
      details: { reference: 'LOT XX1C', panelCount: 4 }
    },
    {
      id: 'audit-4',
      trialId,
      timestamp: '2026-08-30T08:40:00Z',
      operatorId: 'SM',
      action: 'CREATE_BATCH',
      entityType: 'BATCH',
      entityId: batches[1].id,
      details: { reference: 'LOT XX2C', panelCount: 4 }
    },
    {
      id: 'audit-5',
      trialId,
      timestamp: '2026-08-30T08:45:00Z',
      operatorId: 'SM',
      action: 'CREATE_BATCH',
      entityType: 'BATCH',
      entityId: batches[2].id,
      details: { reference: 'LOT XX3C', panelCount: 4 }
    },
    {
      id: 'audit-6',
      trialId,
      timestamp: '2026-08-30T09:00:00Z',
      operatorId: 'SYSTEM',
      action: 'LOCK_TRIAL_CONFIGURATION',
      entityType: 'CONFIG',
      entityId: trialId,
      details: { reason: 'Première acquisition scientifique réalisée sur T0.' }
    },
    {
      id: 'audit-7',
      trialId,
      timestamp: '2026-08-30T12:00:00Z',
      operatorId: 'SM',
      action: 'VALIDATE_STAGE',
      entityType: 'STAGE',
      entityId: stages[0].id,
      details: { stageName: 'T0 — Avant exposition', status: 'VALIDATED' }
    },
    {
      id: 'audit-8',
      trialId,
      timestamp: '2026-09-06T17:00:00Z',
      operatorId: 'SM',
      action: 'VALIDATE_STAGE',
      entityType: 'STAGE',
      entityId: stages[1].id,
      details: { stageName: '168 h — Cycle 1', status: 'VALIDATED' }
    }
  ];

  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-08-30T08:15:00Z',
    updatedAt: '2026-09-13T10:30:00Z',
    metadata,
    commonCharacteristics,
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    config: protocolConfig,
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches,
    acquisitions: {},
    auditTrail,
    mediaReferences: []
  };

  // Remplir les acquisitions pour T0 (validé), 168h (validé), et 336h (en cours)
  seedDemoAcquisitions(trial, ruleSet);

  return trial;
}

/**
 * Génère des acquisitions réalistes pour le scénario de démo
 */
function seedDemoAcquisitions(trial: Trial, ruleSet: ScientificRuleSet): void {
  const stageT0 = trial.stages[0];
  const stage168 = trial.stages[1];
  const stage336 = trial.stages[2];

  // Base L*a*b* par lot
  const baseColors: Record<string, { L: number; a: number; b: number }> = {
    'LOT XX1C': { L: 62.4, a: 8.2, b: 24.1 },
    'LOT XX2C': { L: 61.8, a: 8.5, b: 23.8 },
    'LOT XX3C': { L: 63.1, a: 7.9, b: 24.6 }
  };

  // Base Gloss par lot
  const baseGloss: Record<string, number> = {
    'LOT XX1C': 45.2,
    'LOT XX2C': 48.0,
    'LOT XX3C': 46.5
  };

  // Base Persoz par lot
  const basePersoz: Record<string, number> = {
    'LOT XX1C': 82.0,
    'LOT XX2C': 88.0,
    'LOT XX3C': 91.0
  };

  for (const batch of trial.batches) {
    const cBase = baseColors[batch.reference] || { L: 60, a: 8, b: 24 };
    const gBase = baseGloss[batch.reference] || 45;
    const pBase = basePersoz[batch.reference] || 85;

    for (let pIdx = 0; pIdx < batch.panels.length; pIdx++) {
      const panel = batch.panels[pIdx];

      // --- T0 ---
      // Couleur T0
      const colorRawT0: ColorRawData = {
        readings: [
          { pointIndex: 1, L: +(cBase.L + 0.1 * pIdx).toFixed(2), a: +(cBase.a - 0.05 * pIdx).toFixed(2), b: +(cBase.b + 0.1).toFixed(2) },
          { pointIndex: 2, L: +(cBase.L - 0.2 + 0.1 * pIdx).toFixed(2), a: +(cBase.a + 0.02 * pIdx).toFixed(2), b: +(cBase.b - 0.1).toFixed(2) },
          { pointIndex: 3, L: +(cBase.L + 0.15 + 0.05 * pIdx).toFixed(2), a: +(cBase.a - 0.01).toFixed(2), b: +(cBase.b + 0.05).toFixed(2) },
          { pointIndex: 4, L: +(cBase.L - 0.05 + 0.08 * pIdx).toFixed(2), a: +(cBase.a + 0.04).toFixed(2), b: +(cBase.b - 0.02).toFixed(2) }
        ]
      };
      recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'COLOR', colorRawT0, ruleSet);

      // Brillance T0
      const glossRawT0: GlossRawData = {
        series: [
          {
            seriesIndex: 1,
            orientation: 'Sens du fil',
            readings: [
              { pointIndex: 1, value: +(gBase + 0.3 * pIdx).toFixed(1) },
              { pointIndex: 2, value: +(gBase - 0.2 + 0.2 * pIdx).toFixed(1) }
            ]
          },
          {
            seriesIndex: 2,
            orientation: 'Perpendiculaire',
            readings: [
              { pointIndex: 1, value: +(gBase - 1.2 + 0.3 * pIdx).toFixed(1) },
              { pointIndex: 2, value: +(gBase - 0.8 + 0.1 * pIdx).toFixed(1) }
            ]
          }
        ],
        instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
      };
      recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'GLOSS', glossRawT0, ruleSet);

      // Persoz T0
      const persozRawT0: PersozRawData = {
        readings: [
          { pointIndex: 1, dampingTimeSeconds: +(pBase + pIdx).toFixed(1) },
          { pointIndex: 2, dampingTimeSeconds: +(pBase - 1 + pIdx).toFixed(1) },
          { pointIndex: 3, dampingTimeSeconds: +(pBase + 1 + pIdx).toFixed(1) }
        ],
        unit: 'SECONDS',
        instrumentMetadata: { instrumentId: 'PERSOZ-PENDULUM-02', temperatureCelsius: 21.5, relativeHumidityPercent: 50.2 }
      };
      recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'PERSOZ', persozRawT0, ruleSet);

      // Observations T0
      const obsRawT0: VisualObservationsRawData = {
        observations: [
          { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Revêtement uniforme et lisse' }
        ],
        assessedBy: 'SM',
        assessedAt: '2026-08-30T11:45:00Z'
      };
      recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'OBSERVATIONS', obsRawT0, ruleSet);

      // --- 168h ---
      const dL168 = batch.reference === 'LOT XX1C' ? 1.8 : batch.reference === 'LOT XX2C' ? 0.9 : 0.6;
      const dG168 = batch.reference === 'LOT XX1C' ? -4.5 : batch.reference === 'LOT XX2C' ? -2.2 : -1.5;

      const colorRaw168: ColorRawData = {
        readings: [
          { pointIndex: 1, L: +(cBase.L + dL168 + 0.1 * pIdx).toFixed(2), a: +(cBase.a + 0.4).toFixed(2), b: +(cBase.b + 0.8).toFixed(2) },
          { pointIndex: 2, L: +(cBase.L + dL168 - 0.1).toFixed(2), a: +(cBase.a + 0.5).toFixed(2), b: +(cBase.b + 0.7).toFixed(2) },
          { pointIndex: 3, L: +(cBase.L + dL168 + 0.2).toFixed(2), a: +(cBase.a + 0.3).toFixed(2), b: +(cBase.b + 0.9).toFixed(2) },
          { pointIndex: 4, L: +(cBase.L + dL168 - 0.05).toFixed(2), a: +(cBase.a + 0.45).toFixed(2), b: +(cBase.b + 0.75).toFixed(2) }
        ]
      };
      recordAcquisitionDirect(trial, stage168.id, batch.id, panel.id, 'COLOR', colorRaw168, ruleSet);

      const glossRaw168: GlossRawData = {
        series: [
          {
            seriesIndex: 1,
            orientation: 'Sens du fil',
            readings: [
              { pointIndex: 1, value: +(gBase + dG168 + 0.2 * pIdx).toFixed(1) },
              { pointIndex: 2, value: +(gBase + dG168 - 0.1).toFixed(1) }
            ]
          },
          {
            seriesIndex: 2,
            orientation: 'Perpendiculaire',
            readings: [
              { pointIndex: 1, value: +(gBase + dG168 - 1.0).toFixed(1) },
              { pointIndex: 2, value: +(gBase + dG168 - 0.6).toFixed(1) }
            ]
          }
        ],
        instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
      };
      recordAcquisitionDirect(trial, stage168.id, batch.id, panel.id, 'GLOSS', glossRaw168, ruleSet);

      const persozRaw168: PersozRawData = {
        readings: [
          { pointIndex: 1, dampingTimeSeconds: +(pBase - 2 + pIdx).toFixed(1) },
          { pointIndex: 2, dampingTimeSeconds: +(pBase - 3 + pIdx).toFixed(1) },
          { pointIndex: 3, dampingTimeSeconds: +(pBase - 1 + pIdx).toFixed(1) }
        ],
        unit: 'SECONDS'
      };
      recordAcquisitionDirect(trial, stage168.id, batch.id, panel.id, 'PERSOZ', persozRaw168, ruleSet);

      const obsRaw168: VisualObservationsRawData = {
        observations: [
          { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Légère modification de brillance' }
        ],
        assessedBy: 'SM'
      };
      recordAcquisitionDirect(trial, stage168.id, batch.id, panel.id, 'OBSERVATIONS', obsRaw168, ruleSet);

      // --- 336h (En cours - Lot 1 & Lot 2 remplis, Lot 3 partiel) ---
      if (batch.reference === 'LOT XX1C' || (batch.reference === 'LOT XX2C' && pIdx < 3)) {
        const dL336 = batch.reference === 'LOT XX1C' ? 3.4 : 1.7;
        const dG336 = batch.reference === 'LOT XX1C' ? -9.2 : -4.1;

        const colorRaw336: ColorRawData = {
          readings: [
            { pointIndex: 1, L: +(cBase.L + dL336 + 0.1).toFixed(2), a: +(cBase.a + 0.8).toFixed(2), b: +(cBase.b + 1.4).toFixed(2) },
            { pointIndex: 2, L: +(cBase.L + dL336 - 0.2).toFixed(2), a: +(cBase.a + 0.9).toFixed(2), b: +(cBase.b + 1.3).toFixed(2) },
            { pointIndex: 3, L: +(cBase.L + dL336 + 0.3).toFixed(2), a: +(cBase.a + 0.7).toFixed(2), b: +(cBase.b + 1.5).toFixed(2) },
            { pointIndex: 4, L: +(cBase.L + dL336).toFixed(2), a: +(cBase.a + 0.85).toFixed(2), b: +(cBase.b + 1.35).toFixed(2) }
          ]
        };
        recordAcquisitionDirect(trial, stage336.id, batch.id, panel.id, 'COLOR', colorRaw336, ruleSet);

        const glossRaw336: GlossRawData = {
          series: [
            {
              seriesIndex: 1,
              orientation: 'Sens du fil',
              readings: [
                { pointIndex: 1, value: +(gBase + dG336).toFixed(1) },
                { pointIndex: 2, value: +(gBase + dG336 - 0.5).toFixed(1) }
              ]
            },
            {
              seriesIndex: 2,
              orientation: 'Perpendiculaire',
              readings: [
                { pointIndex: 1, value: +(gBase + dG336 - 1.8).toFixed(1) },
                { pointIndex: 2, value: +(gBase + dG336 - 1.2).toFixed(1) }
              ]
            }
          ],
          instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
        };
        recordAcquisitionDirect(trial, stage336.id, batch.id, panel.id, 'GLOSS', glossRaw336, ruleSet);
      }
    }
  }
}

/**
 * Génère l'essai de validation de référence QUV-2026-VAL-01 (PROMPT 8 - Section 51)
 * Cas d'école complet avec T0 et 2016 h validés
 */
export function createValidationTrial(ruleSet: ScientificRuleSet): Trial {
  const trialId = 'trial-quv-2026-val-01';
  const metadata: TrialMetadata = {
    reference: 'QUV-2026-VAL-01',
    title: 'Évaluation de durabilité accélérée - Lasure Haute Durabilité Pro',
    projectOrClient: 'FINITIONS PRO SA',
    createdBy: 'SM',
    generalNotes:
      'Objectif : vieillissement accéléré selon NF EN 927-6 (Cycle A, 2016 h) pour qualification produit. ' +
      'Opérateur : Dr. S. Martin (Responsable Laboratoire). Laboratoire : QUV-Lab France — Métrologie & Matériaux. ' +
      'Référence normative : NF EN 927-6 (Cycle A - 2016 h). ' +
      'Période prévue : du 2026-03-01 au 2026-05-24.'
  };

  const commonCharacteristics = {
    materialType: 'Pin sylvestre (Pinus sylvestris L.)',
    woodSpecies: 'Pin sylvestre',
    substratePreparation: 'Rabotage fin selon NF EN 927-6, dépoussiérage et conditionnement 20°C/65% HR',
    testFaces: 'Face radiale exposée',
    exposureCycle: 'Cycle A (NF EN 927-6 - UV-A 340 nm + Condensation + Pulvérisation)',
    chamberModel: 'QUV/spray (Q-Lab Corp)'
  };

  const protocolConfig: TrialProtocolConfig = {
    standardReference: 'NF EN 927-6',
    activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'],
    familyConfigs: {
      COLOR: { familyId: 'COLOR', enabled: true },
      GLOSS: { familyId: 'GLOSS', enabled: true },
      PERSOZ: { familyId: 'PERSOZ', enabled: true },
      OBSERVATIONS: { familyId: 'OBSERVATIONS', enabled: true }
    }
  };

  const stages: ExposureStage[] = [];
  stages.push({
    id: `val-st-0`,
    trialId,
    cycleIndex: 0,
    stageType: 'INITIAL_PRE_EXPOSURE',
    name: 'T0 — MESURES INITIALES AVANT EXPOSITION',
    scheduledExposureHours: 0,
    status: 'VALIDATED'
  });

  for (let c = 1; c <= 11; c++) {
    const hours = c * 168;
    stages.push({
      id: `val-st-${hours}`,
      trialId,
      cycleIndex: c,
      stageType: 'INTERMEDIATE_DURING_EXPOSURE',
      name: `${hours} h — MESURES EN COURS D'EXPOSITION`,
      scheduledExposureHours: hours,
      status: 'VALIDATED'
    });
  }

  stages.push({
    id: `val-st-2016`,
    trialId,
    cycleIndex: 12,
    stageType: 'FINAL_POST_EXPOSURE',
    name: '2016 h — MESURES FINALES APRÈS EXPOSITION',
    scheduledExposureHours: 2016,
    status: 'VALIDATED'
  });

  const batch: BatchDefinition = {
    id: 'val-batch-1',
    trialId,
    reference: 'LOT A - FINITIONS PRO',
    productReference: 'Lasure Haute Durabilité Pro',
    orderIndex: 1,
    coatingSystem: 'Lasure Haute Durabilité Pro (3 couches satin)',
    woodSpecies: 'Pin sylvestre',
    manufacturerOrSupplier: 'FINITIONS PRO SA',
    panels: [
      { id: 'val-p1', batchId: 'val-batch-1', index: 1, label: 'P01', status: 'ACTIVE' },
      { id: 'val-p2', batchId: 'val-batch-1', index: 2, label: 'P02', status: 'ACTIVE' },
      { id: 'val-p3', batchId: 'val-batch-1', index: 3, label: 'P03', status: 'ACTIVE' },
      { id: 'val-p4', batchId: 'val-batch-1', index: 4, label: 'P04', status: 'ACTIVE' }
    ]
  };

  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-05-24T18:00:00Z',
    metadata,
    commonCharacteristics,
    status: 'COMPLETED',
    configurationStatus: 'LOCKED',
    config: protocolConfig,
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [batch],
    acquisitions: {},
    auditTrail: [
      {
        id: 'val-audit-1',
        trialId,
        timestamp: '2026-03-01T08:00:00Z',
        operatorId: 'SM',
        action: 'CREATE_TRIAL',
        entityType: 'TRIAL',
        entityId: trialId
      },
      {
        id: 'val-audit-2',
        trialId,
        timestamp: '2026-05-24T18:00:00Z',
        operatorId: 'SM',
        action: 'VALIDATE_STAGE',
        entityType: 'STAGE',
        entityId: 'val-st-2016'
      }
    ],
    mediaReferences: []
  };

  // Remplissage T0 : Persoz = 178 s, Gloss = 44.1 GU, Color L=65.20, a=8.40, b=18.10
  const stage0 = stages[0];
  for (const panel of batch.panels) {
    const pIdx = panel.index;
    const colorRaw0: ColorRawData = {
      readings: [
        { pointIndex: 1, L: +(65.20 + 0.1 * pIdx).toFixed(2), a: +(8.40 + 0.05 * pIdx).toFixed(2), b: +(18.10 - 0.1 * pIdx).toFixed(2) },
        { pointIndex: 2, L: +(65.20 - 0.1 * pIdx).toFixed(2), a: +(8.40 - 0.05 * pIdx).toFixed(2), b: +(18.10 + 0.1 * pIdx).toFixed(2) },
        { pointIndex: 3, L: +(65.20 + 0.05).toFixed(2), a: +(8.40 + 0.02).toFixed(2), b: +(18.10).toFixed(2) },
        { pointIndex: 4, L: +(65.20 - 0.05).toFixed(2), a: +(8.40 - 0.02).toFixed(2), b: +(18.10).toFixed(2) }
      ]
    };
    recordAcquisitionDirect(trial, stage0.id, batch.id, panel.id, 'COLOR', colorRaw0, ruleSet);

    const glossRaw0: GlossRawData = {
      series: [
        {
          seriesIndex: 1,
          orientation: 'Sens du fil',
          readings: [
            { pointIndex: 1, value: +(44.3 + 0.1 * pIdx).toFixed(1) },
            { pointIndex: 2, value: +(44.1 - 0.1 * pIdx).toFixed(1) }
          ]
        },
        {
          seriesIndex: 2,
          orientation: 'Perpendiculaire',
          readings: [
            { pointIndex: 1, value: +(43.9 + 0.1 * pIdx).toFixed(1) },
            { pointIndex: 2, value: +(44.1).toFixed(1) }
          ]
        }
      ],
      instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
    };
    recordAcquisitionDirect(trial, stage0.id, batch.id, panel.id, 'GLOSS', glossRaw0, ruleSet);

    const persozRaw0: PersozRawData = {
      readings: [
        { pointIndex: 1, dampingTimeSeconds: +(178 + (pIdx % 2 === 0 ? 1 : -1)).toFixed(1) },
        { pointIndex: 2, dampingTimeSeconds: +(178 - (pIdx % 2 === 0 ? 1 : -1)).toFixed(1) },
        { pointIndex: 3, dampingTimeSeconds: 178.0 }
      ],
      unit: 'SECONDS'
    };
    recordAcquisitionDirect(trial, stage0.id, batch.id, panel.id, 'PERSOZ', persozRaw0, ruleSet);

    const obsRaw0: VisualObservationsRawData = {
      observations: [
        { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'État initial intact' },
        { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'État initial intact' },
        { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'État initial intact' },
        { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'État initial intact' },
        { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Film homogène régulier' }
      ],
      assessedBy: 'SM'
    };
    recordAcquisitionDirect(trial, stage0.id, batch.id, panel.id, 'OBSERVATIONS', obsRaw0, ruleSet);
  }

  // Remplissage étapes intermédiaires (168h à 1848h)
  for (let c = 1; c <= 11; c++) {
    const stage = stages[c];
    const fraction = c / 12;
    const currentL = 65.20 - 3.92 * fraction;
    const currentA = 8.40 + 0.75 * fraction;
    const currentB = 18.10 + 3.20 * fraction;
    const currentGloss = 44.1 - 16.2 * fraction;
    const currentPersoz = 178.0 - 27.0 * fraction;

    for (const panel of batch.panels) {
      const colorRaw: ColorRawData = {
        readings: [
          { pointIndex: 1, L: +(currentL + 0.05).toFixed(2), a: +(currentA + 0.02).toFixed(2), b: +(currentB + 0.03).toFixed(2) },
          { pointIndex: 2, L: +(currentL - 0.05).toFixed(2), a: +(currentA - 0.02).toFixed(2), b: +(currentB - 0.03).toFixed(2) },
          { pointIndex: 3, L: +(currentL).toFixed(2), a: +(currentA).toFixed(2), b: +(currentB).toFixed(2) },
          { pointIndex: 4, L: +(currentL).toFixed(2), a: +(currentA).toFixed(2), b: +(currentB).toFixed(2) }
        ]
      };
      recordAcquisitionDirect(trial, stage.id, batch.id, panel.id, 'COLOR', colorRaw, ruleSet);

      const glossRaw: GlossRawData = {
        series: [
          {
            seriesIndex: 1,
            orientation: 'Sens du fil',
            readings: [
              { pointIndex: 1, value: +(currentGloss + 0.2).toFixed(1) },
              { pointIndex: 2, value: +(currentGloss - 0.2).toFixed(1) }
            ]
          },
          {
            seriesIndex: 2,
            orientation: 'Perpendiculaire',
            readings: [
              { pointIndex: 1, value: +(currentGloss - 0.1).toFixed(1) },
              { pointIndex: 2, value: +(currentGloss + 0.1).toFixed(1) }
            ]
          }
        ],
        instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
      };
      recordAcquisitionDirect(trial, stage.id, batch.id, panel.id, 'GLOSS', glossRaw, ruleSet);

      const persozRaw: PersozRawData = {
        readings: [
          { pointIndex: 1, dampingTimeSeconds: +(currentPersoz + 0.5).toFixed(1) },
          { pointIndex: 2, dampingTimeSeconds: +(currentPersoz - 0.5).toFixed(1) },
          { pointIndex: 3, dampingTimeSeconds: +(currentPersoz).toFixed(1) }
        ],
        unit: 'SECONDS'
      };
      recordAcquisitionDirect(trial, stage.id, batch.id, panel.id, 'PERSOZ', persozRaw, ruleSet);

      const obsRaw: VisualObservationsRawData = {
        observations: [
          { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Néant' },
          { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Néant' },
          { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Néant' },
          { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Néant' }
        ],
        assessedBy: 'SM'
      };
      recordAcquisitionDirect(trial, stage.id, batch.id, panel.id, 'OBSERVATIONS', obsRaw, ruleSet);
    }
  }

  // Remplissage étape finale 2016 h
  const stage2016 = stages[12];
  for (const panel of batch.panels) {
    const colorRaw2016: ColorRawData = {
      readings: [
        { pointIndex: 1, L: 61.28, a: 9.15, b: 21.30 },
        { pointIndex: 2, L: 61.28, a: 9.15, b: 21.30 },
        { pointIndex: 3, L: 61.28, a: 9.15, b: 21.30 },
        { pointIndex: 4, L: 61.28, a: 9.15, b: 21.30 }
      ]
    };
    recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'COLOR', colorRaw2016, ruleSet);

    const glossRaw2016: GlossRawData = {
      series: [
        {
          seriesIndex: 1,
          orientation: 'Sens du fil',
          readings: [
            { pointIndex: 1, value: 27.9 },
            { pointIndex: 2, value: 27.9 }
          ]
        },
        {
          seriesIndex: 2,
          orientation: 'Perpendiculaire',
          readings: [
            { pointIndex: 1, value: 27.9 },
            { pointIndex: 2, value: 27.9 }
          ]
        }
      ],
      instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
    };
    recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'GLOSS', glossRaw2016, ruleSet);

    const persozRaw2016: PersozRawData = {
      readings: [
        { pointIndex: 1, dampingTimeSeconds: 151.0 },
        { pointIndex: 2, dampingTimeSeconds: 151.0 },
        { pointIndex: 3, dampingTimeSeconds: 151.0 }
      ],
      unit: 'SECONDS'
    };
    recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'PERSOZ', persozRaw2016, ruleSet);

    const obsRaw2016: VisualObservationsRawData = {
      observations: [
        { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun cloquage après 2016 h' },
        { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun écaillage après 2016 h' },
        { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun craquelage après 2016 h' },
        { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun farinage après 2016 h' },
        { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Perte de brillance satinée régulière, légère matification' }
      ],
      assessedBy: 'SM'
    };
    recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'OBSERVATIONS', obsRaw2016, ruleSet);
  }

  return trial;
}

function recordAcquisitionDirect(
  trial: Trial,
  stageId: UUID,
  batchId: UUID,
  panelId: UUID,
  familyId: MeasurementFamilyId,
  raw: unknown,
  ruleSet: ScientificRuleSet
): PanelAcquisitionRecord {
  const key = `${stageId}__${panelId}__${familyId}`;
  const record: PanelAcquisitionRecord = {
    id: `acq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    trialId: trial.id,
    stageId,
    batchId,
    panelId,
    familyId,
    raw,
    computed: null,
    status: 'COMPLETE',
    alerts: [],
    trace: {
      createdBy: 'SM',
      createdAt: new Date().toISOString(),
      source: 'MANUAL_KEYPAD'
    },
    mediaIds: []
  };

  const { updatedRecord } = recalculateAcquisition(record, trial, ruleSet);
  trial.acquisitions[key] = updatedRecord;
  return updatedRecord;
}

/**
 * Service TrialStore complet
 */
export class TrialStoreService {
  private trials: Map<UUID, Trial> = new Map();
  private ruleSet: ScientificRuleSet;

  constructor() {
    this.ruleSet = getDefaultScientificRuleSet();
    this.loadFromStorage();
  }

  /**
   * Migration non-destructive de la terminologie des étapes d'exposition (v6.1 -> v6.2)
   * Préserve intégralement les UUIDs, acquisitions, RAW, résultats calculés, horodatages, lots et auditTrail.
   */
  public migrateTrialTerminology(trial: Trial): Trial {
    if (!trial || !Array.isArray(trial.stages)) return trial;

    trial.stages.forEach((stage, idx) => {
      const isFinal = stage.cycleIndex === 12 || (stage.cycleIndex > 0 && idx === trial.stages.length - 1);
      const isInitial = stage.cycleIndex === 0;

      if (isInitial) {
        stage.stageType = 'INITIAL_PRE_EXPOSURE';
        if (!stage.name || stage.name.includes('MESURES INITIALES') || stage.name.trim() === 'T0') {
          stage.name = 'T0 — MESURES INITIALES AVANT EXPOSITION';
        }
      } else if (isFinal) {
        stage.stageType = 'FINAL_POST_EXPOSURE';
        if (!stage.name || stage.name.includes('MESURES FINALES') || stage.name.includes('2016 h')) {
          stage.name = `${stage.scheduledExposureHours || 2016} h — MESURES FINALES APRÈS EXPOSITION`;
        }
      } else {
        // Cycles intermédiaires (168 h à 1848 h)
        stage.stageType = 'INTERMEDIATE_DURING_EXPOSURE';
        if (stage.name && stage.name.includes('MESURES APRÈS EXPOSITION')) {
          stage.name = stage.name.replace('MESURES APRÈS EXPOSITION', "MESURES EN COURS D'EXPOSITION");
        } else if (!stage.name || stage.name.trim() === `${stage.scheduledExposureHours} h`) {
          stage.name = `${stage.scheduledExposureHours} h — MESURES EN COURS D'EXPOSITION`;
        }
      }
    });

    return trial;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Trial[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((t) => {
            const migrated = this.migrateTrialTerminology(t);
            this.trials.set(migrated.id, migrated);
          });
          return;
        }
      }
    } catch {
      // ignore
    }

    // Initialisation avec démo et essai de validation si vide
    const demo = createDemoTrial(this.ruleSet);
    const valTrial = createValidationTrial(this.ruleSet);
    this.trials.set(demo.id, demo);
    this.trials.set(valTrial.id, valTrial);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      const list = Array.from(this.trials.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  public getTrials(): Trial[] {
    return Array.from(this.trials.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getTrial(id: UUID): Trial | undefined {
    return this.trials.get(id);
  }

  public getAllTrials(): Trial[] {
    return this.getTrials();
  }

  public saveTrial(trial: Trial): void {
    trial.updatedAt = new Date().toISOString();
    this.trials.set(trial.id, trial);
    this.saveToStorage();
  }

  public resetToDemo(): Trial {
    this.trials.clear();
    const demo = createDemoTrial(this.ruleSet);
    this.trials.set(demo.id, demo);
    this.saveToStorage();
    return demo;
  }

  /**
   * Crée un nouvel essai depuis l'assistant (PROMPT 6 v6.1)
   */
  public createTrial(params: {
    metadata: TrialMetadata;
    commonCharacteristics?: CommonCharacteristics;
    batches: {
      reference: string;
      coatingSystem?: string;
      woodSpecies?: string;
      productReference?: string;
      manufacturerOrSupplier?: string;
      coatCount?: number;
      substratePreparation?: string;
      applicationMethod?: string;
      applicationConditions?: string;
      applicationDate?: string;
      dryingOrConditioningTime?: string;
      batchNotes?: string;
      panelCount: number;
    }[];
    activeFamilies: MeasurementFamilyId[];
    familyConfigs?: Partial<TrialProtocolConfig['familyConfigs']>;
  }): Trial {
    const trialId = generateUUID();
    const now = new Date().toISOString();

    const createdBatches: BatchDefinition[] = params.batches.map((b, bIdx) => {
      const batchId = generateUUID();
      const panels: PanelDefinition[] = [];
      for (let p = 1; p <= (b.panelCount || 4); p++) {
        panels.push({
          id: generateUUID(),
          batchId,
          index: p,
          label: `P0${p}`.slice(-3),
          status: 'ACTIVE'
        });
      }
      return {
        id: batchId,
        trialId,
        reference: b.reference.trim(),
        orderIndex: bIdx + 1,
        coatingSystem: b.coatingSystem,
        woodSpecies: b.woodSpecies,
        productReference: b.productReference,
        manufacturerOrSupplier: b.manufacturerOrSupplier,
        coatCount: b.coatCount,
        substratePreparation: b.substratePreparation,
        applicationMethod: b.applicationMethod,
        applicationConditions: b.applicationConditions,
        applicationDate: b.applicationDate,
        dryingOrConditioningTime: b.dryingOrConditioningTime,
        batchNotes: b.batchNotes,
        panels
      };
    });

    const protocolConfig: TrialProtocolConfig = {
      standardReference: 'NF EN 927-6',
      activeFamilies: params.activeFamilies,
      familyConfigs: {
        COLOR: params.familyConfigs?.COLOR || {
          familyId: 'COLOR',
          enabled: params.activeFamilies.includes('COLOR'),
          countConfig: createCountConfiguration('COLOR', 4, this.ruleSet)
        },
        GLOSS: params.familyConfigs?.GLOSS || {
          familyId: 'GLOSS',
          enabled: params.activeFamilies.includes('GLOSS'),
          seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, this.ruleSet)
        },
        PERSOZ: params.familyConfigs?.PERSOZ || {
          familyId: 'PERSOZ',
          enabled: params.activeFamilies.includes('PERSOZ'),
          countConfig: createCountConfiguration('PERSOZ', 3, this.ruleSet)
        },
        OBSERVATIONS: params.familyConfigs?.OBSERVATIONS || {
          familyId: 'OBSERVATIONS',
          enabled: params.activeFamilies.includes('OBSERVATIONS')
        }
      }
    };

    const stages = generateStandardExposureStages(trialId);

    const auditTrail: AuditEvent[] = [
      {
        id: generateUUID(),
        trialId,
        timestamp: now,
        operatorId: params.metadata.createdBy || 'OPERATOR',
        action: 'CREATE_TRIAL',
        entityType: 'TRIAL',
        entityId: trialId,
        details: {
          reference: params.metadata.reference,
          title: params.metadata.title,
          batchCount: createdBatches.length,
          totalPanels: createdBatches.reduce((sum, b) => sum + b.panels.length, 0)
        }
      }
    ];

    const trial: Trial = {
      id: trialId,
      schemaVersion: '1.2.0',
      createdAt: now,
      updatedAt: now,
      metadata: params.metadata,
      commonCharacteristics: params.commonCharacteristics,
      status: 'IN_PROGRESS',
      configurationStatus: 'EDITABLE',
      config: protocolConfig,
      scheduleConfig: {
        cycleDurationHours: 168,
        maxCycles: 12,
        initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
        intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
        finalCycle: { cycleIndex: 12, mandatory: true }
      },
      stages,
      batches: createdBatches,
      acquisitions: {},
      auditTrail,
      mediaReferences: []
    };

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Exclut un panneau de manière motivée (PROMPT 6 - Section 9)
   */
  public excludePanel(trialId: UUID, panelId: UUID, reason: string, operatorId: string): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    if (!reason || reason.trim().length === 0) {
      throw new Error('Le motif d\'exclusion du panneau est obligatoire.');
    }

    let foundPanel: PanelDefinition | null = null;
    let foundBatch: BatchDefinition | null = null;

    for (const b of trial.batches) {
      const p = b.panels.find((item) => item.id === panelId);
      if (p) {
        foundPanel = p;
        foundBatch = b;
        break;
      }
    }

    if (!foundPanel) throw new Error(`Panneau ${panelId} introuvable`);

    const now = new Date().toISOString();
    foundPanel.status = 'EXCLUDED';
    foundPanel.exclusionReason = reason.trim();
    foundPanel.excludedAt = now;
    foundPanel.excludedBy = operatorId || 'OPERATOR';

    trial.auditTrail.push({
      id: generateUUID(),
      trialId,
      timestamp: now,
      operatorId: operatorId || 'OPERATOR',
      action: 'EXCLUDE_PANEL',
      entityType: 'PANEL',
      entityId: panelId,
      details: {
        batchReference: foundBatch?.reference,
        panelLabel: foundPanel.label,
        reason: reason.trim()
      }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Adapte le protocole de mesure avec justification (PROMPT 6 - Section 11 & 12)
   */
  public adaptProtocolConfig(
    trialId: UUID,
    familyId: MeasurementFamilyId,
    newCountOrSeries: number | { seriesCount: number; readingsPerSeries: number },
    justification: string,
    operatorId: string
  ): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    if (trial.configurationStatus === 'LOCKED') {
      throw new Error('La configuration de l\'essai est VERROUILLÉE suite aux premières acquisitions scientifiques.');
    }

    const famConfig = trial.config.familyConfigs[familyId];
    const prevConfig = famConfig?.countConfig || famConfig?.seriesConfig;

    if (typeof newCountOrSeries === 'number') {
      const isStandard = newCountOrSeries === (this.ruleSet.measurementConfigurations[familyId]?.standardRecommendedCount ?? 4);
      if (!isStandard && (!justification || justification.trim().length === 0)) {
        throw new Error('Une justification obligatoire est requise pour toute adaptation du nombre de mesures.');
      }
      const updatedConfig = createCountConfiguration(familyId, newCountOrSeries, this.ruleSet, {
        justification,
        operatorId
      });
      trial.config.familyConfigs[familyId] = {
        ...famConfig,
        familyId,
        enabled: true,
        countConfig: updatedConfig
      };
      trial.auditTrail.push(
        createConfigChangeEvent(trialId, operatorId, familyId, prevConfig, updatedConfig, justification)
      );
    } else {
      const std = this.ruleSet.seriesConfigurations?.[familyId]?.standardConfiguration;
      const isStandard =
        std &&
        newCountOrSeries.seriesCount === std.seriesCount &&
        newCountOrSeries.readingsPerSeries === std.readingsPerSeries;
      if (!isStandard && (!justification || justification.trim().length === 0)) {
        throw new Error('Une justification obligatoire est requise pour toute adaptation de structure de séries.');
      }
      const updatedConfig = createSeriesConfiguration(
        familyId,
        newCountOrSeries.seriesCount,
        newCountOrSeries.readingsPerSeries,
        this.ruleSet,
        { justification, operatorId }
      );
      trial.config.familyConfigs[familyId] = {
        ...famConfig,
        familyId,
        enabled: true,
        seriesConfig: updatedConfig
      };
      trial.auditTrail.push(
        createConfigChangeEvent(trialId, operatorId, familyId, prevConfig, updatedConfig, justification)
      );
    }

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Enregistre ou met à jour une acquisition scientifique pour un panneau
   * Déclenche automatiquement le verrouillage de la configuration s'il s'agit de la première acquisition.
   */
  public recordAcquisition(params: {
    trialId: UUID;
    stageId: UUID;
    batchId: UUID;
    panelId: UUID;
    familyId: MeasurementFamilyId;
    raw: unknown;
    operatorId: string;
    source?: 'MANUAL_KEYPAD' | 'INSTRUMENT_IMPORT' | 'FILE_IMPORT';
    mediaIds?: UUID[];
  }): { trial: Trial; record: PanelAcquisitionRecord } {
    const trial = this.getTrial(params.trialId);
    if (!trial) throw new Error(`Essai ${params.trialId} introuvable`);

    const now = new Date().toISOString();

    // Verrouillage automatique si non encore verrouillé
    if (trial.configurationStatus !== 'LOCKED') {
      trial.configurationStatus = 'LOCKED';
      trial.auditTrail.push({
        id: generateUUID(),
        trialId: trial.id,
        timestamp: now,
        operatorId: 'SYSTEM',
        action: 'LOCK_TRIAL_CONFIGURATION',
        entityType: 'CONFIG',
        entityId: trial.id,
        details: { reason: 'Première acquisition scientifique enregistrée.' }
      });
    }

    const key = `${params.stageId}__${params.panelId}__${params.familyId}`;
    const prevRecord = trial.acquisitions[key];

    const newRecord: PanelAcquisitionRecord = {
      id: prevRecord ? prevRecord.id : generateUUID(),
      trialId: trial.id,
      stageId: params.stageId,
      batchId: params.batchId,
      panelId: params.panelId,
      familyId: params.familyId,
      raw: params.raw,
      computed: null,
      status: 'COMPLETE',
      alerts: [],
      trace: {
        createdBy: prevRecord ? prevRecord.trace.createdBy : params.operatorId || 'OPERATOR',
        createdAt: prevRecord ? prevRecord.trace.createdAt : now,
        lastModifiedBy: params.operatorId || 'OPERATOR',
        lastModifiedAt: now,
        source: params.source || 'MANUAL_KEYPAD'
      },
      mediaIds: params.mediaIds || prevRecord?.mediaIds || []
    };

    // Calcul immédiat via PROMPT 5 sans toucher à raw
    const { updatedRecord, rawUnchanged } = recalculateAcquisition(newRecord, trial, this.ruleSet);
    if (!rawUnchanged) {
      // Garde-fou scientifique : le moteur de calcul a modifié le RAW, ce qui ne doit
      // structurellement jamais arriver. On le rend visible plutôt que de le laisser silencieux.
      updatedRecord.alerts.push({
        id: generateUUID(),
        severity: 'BLOCKING',
        code: 'RAW_INTEGRITY_VIOLATION',
        message: 'Anomalie critique : la donnée brute (RAW) a été modifiée lors du recalcul. Intégrité scientifique compromise.',
        familyId: params.familyId,
        stageId: params.stageId,
        panelId: params.panelId
      });
    }
    trial.acquisitions[key] = updatedRecord;

    // Audit de l'acquisition
    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: now,
      operatorId: params.operatorId || 'OPERATOR',
      action: prevRecord ? 'UPDATE_ACQUISITION' : 'RECORD_ACQUISITION',
      entityType: 'ACQUISITION',
      entityId: updatedRecord.id,
      details: {
        stageId: params.stageId,
        panelId: params.panelId,
        familyId: params.familyId,
        source: newRecord.trace.source,
        quality: (updatedRecord.computed as any)?.qualityAssessment?.status || 'N/A',
        rawUnchanged
      }
    });

    this.saveTrial(trial);
    return { trial, record: updatedRecord };
  }

  /**
   * Valide une étape d'exposition
   */
  public validateStage(trialId: UUID, stageId: UUID, operatorId: string, notes?: string): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    const stage = trial.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error(`Étape ${stageId} introuvable`);

    const now = new Date().toISOString();
    stage.status = 'VALIDATED';
    stage.validatedBy = operatorId || 'OPERATOR';
    stage.validatedAt = now;
    if (notes) stage.notes = notes;

    // Passer automatiquement l'étape suivante en IN_PROGRESS si elle était NOT_STARTED
    const currentIdx = trial.stages.findIndex((s) => s.id === stageId);
    if (currentIdx >= 0 && currentIdx + 1 < trial.stages.length) {
      const nextStage = trial.stages[currentIdx + 1];
      if (nextStage.status === 'NOT_STARTED') {
        nextStage.status = 'IN_PROGRESS';
      }
    }

    trial.auditTrail.push({
      id: generateUUID(),
      trialId,
      timestamp: now,
      operatorId: operatorId || 'OPERATOR',
      action: 'VALIDATE_STAGE',
      entityType: 'STAGE',
      entityId: stageId,
      details: { stageName: stage.name, cycleIndex: stage.cycleIndex }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Associe une photographie
   */
  public attachPhoto(params: {
    trialId: UUID;
    panelId?: UUID;
    stageId?: UUID;
    filename: string;
    caption: string;
    operatorId: string;
    storageKey?: string;
  }): { trial: Trial; media: MediaReference } {
    const trial = this.getTrial(params.trialId);
    if (!trial) throw new Error(`Essai ${params.trialId} introuvable`);

    const media: MediaReference = {
      id: generateUUID(),
      trialId: params.trialId,
      panelId: params.panelId,
      stageId: params.stageId,
      type: 'PHOTO',
      storageKey: params.storageKey || `photos/${params.filename}`,
      filename: params.filename,
      mimeType: 'image/jpeg',
      sizeBytes: 1024 * 250,
      capturedAt: new Date().toISOString(),
      capturedBy: params.operatorId || 'OPERATOR',
      caption: params.caption
    };

    trial.mediaReferences.push(media);

    if (params.panelId && params.stageId) {
      // Trouver l'acquisition observation s'il y a lieu
      const obsKey = `${params.stageId}__${params.panelId}__OBSERVATIONS`;
      const obsRec = trial.acquisitions[obsKey];
      if (obsRec) {
        obsRec.mediaIds = [...obsRec.mediaIds, media.id];
      }
    }

    this.saveTrial(trial);
    return { trial, media };
  }

  /**
   * Enregistre un événement d'audit de consultation des résultats (PROMPT 7 - Section 35)
   */
  public logViewResults(trialId: UUID, operatorId: string): void {
    const trial = this.getTrial(trialId);
    if (!trial) return;

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || 'OPERATOR',
      action: 'VIEW_RESULTS',
      entityType: 'TRIAL',
      entityId: trial.id,
      details: { view: 'RESULTS_DASHBOARD' }
    });

    this.saveTrial(trial);
  }

  /**
   * Génère ou régénère un rapport scientifique versionné (PROMPT 7 - Section 21 & 35)
   */
  public generateScientificReportForTrial(
    trialId: UUID,
    operatorId: string,
    ruleSet: ScientificRuleSet
  ): ScientificReport {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    if (!trial.reports) {
      trial.reports = [];
    }

    const isRegeneration = trial.reports.length > 0;
    const nextVersionNumber = `v${trial.reports.length + 1}.0`;

    const report = buildScientificReport(trial, ruleSet, {
      operatorId,
      versionNumber: nextVersionNumber
    });

    trial.reports.unshift(report); // Plus récent en premier

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || 'OPERATOR',
      action: isRegeneration ? 'REGENERATE_REPORT' : 'GENERATE_REPORT',
      entityType: 'TRIAL',
      entityId: report.id,
      details: {
        reportVersion: report.metadata.reportVersion,
        isComplete: report.isComplete,
        calculationVersion: report.metadata.calculationVersion,
        scientificRuleSetId: report.metadata.scientificRuleSetId
      }
    });

    this.saveTrial(trial);
    return report;
  }

  /**
   * Met à jour le statut du rapport scientifique (Revue / Approbation)
   */
  public updateReportStatus(
    trialId: UUID,
    reportId: string,
    newStatus: ScientificReportStatus,
    operatorId: string
  ): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    const report = trial.reports?.find((r) => r.id === reportId);
    if (!report) throw new Error(`Rapport ${reportId} introuvable`);

    const now = new Date().toISOString();
    report.status = newStatus;

    let action = 'REVIEW_REPORT';
    if (newStatus === 'REVIEWED') {
      report.reviewedBy = operatorId || 'REVIEWER';
      report.reviewedAt = now;
      action = 'REVIEW_REPORT';
    } else if (newStatus === 'APPROVED') {
      report.approvedBy = operatorId || 'APPROVER';
      report.approvedAt = now;
      action = 'APPROVE_REPORT';
    }

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: now,
      operatorId: operatorId || 'OPERATOR',
      action,
      entityType: 'TRIAL',
      entityId: report.id,
      details: {
        reportVersion: report.metadata.reportVersion,
        newStatus
      }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Ajoute un commentaire de revue scientifique (PROMPT 7 - Section 34 & 35)
   */
  public addReportReviewComment(
    trialId: UUID,
    reportId: string,
    comment: {
      author: string;
      text: string;
      category: ScientificReportReviewComment['category'];
    }
  ): ScientificReportReviewComment {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    const report = trial.reports?.find((r) => r.id === reportId);
    if (!report) throw new Error(`Rapport ${reportId} introuvable`);

    const newComment: ScientificReportReviewComment = {
      id: generateUUID(),
      reportId,
      author: comment.author || 'REVIEWER',
      createdAt: new Date().toISOString(),
      text: comment.text,
      category: comment.category
    };

    if (!report.reviewComments) {
      report.reviewComments = [];
    }
    report.reviewComments.push(newComment);

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: newComment.createdAt,
      operatorId: newComment.author,
      action: 'ADD_REPORT_COMMENT',
      entityType: 'TRIAL',
      entityId: report.id,
      details: {
        commentId: newComment.id,
        category: newComment.category,
        preview: newComment.text.slice(0, 50)
      }
    });

    this.saveTrial(trial);
    return newComment;
  }

  /**
   * Trace un export dans l'audit trail (PROMPT 7 - Section 26 & 35)
   */
  public logReportExport(
    trialId: UUID,
    reportId: string,
    exportType: 'REPORT_PDF' | 'REPORT_CSV' | 'RAW_DATA_CSV' | 'COMPUTED_DATA_CSV',
    operatorId: string
  ): void {
    const trial = this.getTrial(trialId);
    if (!trial) return;

    let action = 'EXPORT_REPORT';
    if (exportType === 'RAW_DATA_CSV') action = 'EXPORT_RAW_DATA';
    else if (exportType === 'COMPUTED_DATA_CSV') action = 'EXPORT_COMPUTED_DATA';

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || 'OPERATOR',
      action,
      entityType: 'TRIAL',
      entityId: reportId,
      details: { exportType }
    });

    this.saveTrial(trial);
  }
}

export const globalTrialStore = new TrialStoreService();
