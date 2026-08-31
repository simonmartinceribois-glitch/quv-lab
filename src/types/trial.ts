/**
 * QUV-Lab — Modèle de Données Racine (Trial & Référentiel Permanent)
 * v1.1.0 — Architecture Essai, Référentiel Permanent, Calendrier 168h & Traçabilité
 */

import {
  UUID,
  ISODateString,
  TrialStatus,
  ConfigurationStatus,
  StageStatus,
  PanelStatus,
  AcquisitionStatus,
  MeasurementFamilyId,
  MeasurementAlert,
  ScientificRuleSet,
  MeasurementCountConfiguration,
  MeasurementSeriesConfiguration,
  ComputationMetadata,
  ScientificReport
} from './scientific';

export interface TrialMetadata {
  reference: string;                 // ex: "QUV-2026-042"
  title?: string;
  projectOrClient?: string;
  coatingSystemDescription?: string;
  substrateDescription?: string;
  createdBy: string;
  generalNotes?: string;
}

export type ExposureStageType =
  | 'INITIAL_PRE_EXPOSURE'
  | 'INTERMEDIATE_DURING_EXPOSURE'
  | 'FINAL_POST_EXPOSURE';

export interface CommonCharacteristics {
  dimensions?: {
    lengthMm?: number;
    widthMm?: number;
    thicknessMm?: number;
    unit: 'mm' | 'cm';
  };
  substrateNature?: string;            // ex: "Bois massif", "Panneau dérivé", "Plaque témoin"
  materialType?: string;               // ex: "Pin sylvestre (NF EN 927-6)", "Chêne", "Mélèze"
  woodGrainOrientation?: 'QUARTER_SAWN' | 'SLASH_SAWN' | 'MIXED' | 'STANDARD' | string; // ex: "Sur quartier (NF EN 927-6)"
  preparationNotes?: string;           // ex: "Ponçage P120, dépoussiérage, stabilisation 20°C/65% HR"
  conditioningNotes?: string;          // ex: "Stabilisation 7 jours selon NF EN 927-6 §5"
  generalProtocolNotes?: string;
}

export interface ScheduledCycleCheckpoint {
  cycleIndex: number;                // Entier strict ∈ [1..12]
  label?: string;
  mandatory: boolean;
}

export interface ExposureScheduleConfig {
  cycleDurationHours: 168;
  maxCycles: 12;
  initialStage: {
    exposureHours: 0;
    mandatory: true;
    label: string;
  };
  intermediateCycles: ScheduledCycleCheckpoint[];
  finalCycle: ScheduledCycleCheckpoint;
}

export interface ExposureStage {
  id: UUID;
  trialId: UUID;
  cycleIndex: number;
  stageType: ExposureStageType;
  name: string;
  scheduledExposureHours: number;
  actualExposureHours?: number;
  scheduledAt?: ISODateString;
  measuredAt?: ISODateString;
  status: StageStatus;
  validatedBy?: string;
  validatedAt?: ISODateString;
  notes?: string;
}

export interface PanelDefinition {
  id: UUID;
  batchId: UUID;
  index: number;
  label: string;
  status: PanelStatus;
  position?: string;
  exclusionReason?: string;
  excludedAt?: ISODateString;
  excludedBy?: string;
  notes?: string;
}

export interface BatchDefinition {
  id: UUID;
  trialId: UUID;
  reference: string;                 // ex: "XX1C"
  orderIndex: number;
  woodSpecies?: string;              // ex: "Pin sylvestre standardisé"
  productReference?: string;         // ex: "Lasure Hydro V33 Satin"
  manufacturerOrSupplier?: string;   // ex: "Fabricant A"
  coatingSystem?: string;            // ex: "Impression + 2 couches finition"
  coatCount?: number;                // ex: 3
  substratePreparation?: string;     // ex: "Ponçage grain P120"
  applicationMethod?: string;        // ex: "Pinceau", "Pistolet"
  applicationConditions?: string;    // ex: "21°C, 55% HR"
  applicationDate?: string;          // ex: "2026-08-15"
  dryingOrConditioningTime?: string; // ex: "7 jours à 23°C/50% HR"
  batchNotes?: string;
  panels: PanelDefinition[];
}

export interface FamilyProtocolConfig {
  familyId: MeasurementFamilyId;
  enabled: boolean;
  countConfig?: MeasurementCountConfiguration;
  seriesConfig?: MeasurementSeriesConfiguration;
  instrumentParameters?: Record<string, unknown>;
  customSettings?: Record<string, unknown>;
}

export interface TrialProtocolConfig {
  standardReference: string;
  activeFamilies: MeasurementFamilyId[];
  familyConfigs: Record<MeasurementFamilyId, FamilyProtocolConfig>;
}

export interface AcquisitionTrace {
  createdBy: string;
  createdAt: ISODateString;
  lastModifiedBy?: string;
  lastModifiedAt?: ISODateString;
  source: 'MANUAL_KEYPAD' | 'INSTRUMENT_IMPORT' | 'FILE_IMPORT';
}

export interface PanelAcquisitionRecord<TRaw = unknown, TComputed = unknown> {
  id: UUID;
  trialId: UUID;
  stageId: UUID;
  batchId: UUID;
  panelId: UUID;
  familyId: MeasurementFamilyId;
  raw: TRaw;
  computed: TComputed;
  status: AcquisitionStatus;
  alerts: MeasurementAlert[];
  trace: AcquisitionTrace;
  mediaIds: UUID[];
}

export interface MediaReference {
  id: UUID;
  trialId: UUID;
  panelId?: UUID;
  stageId?: UUID;
  type: 'PHOTO' | 'DOCUMENT';
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  capturedAt: ISODateString;
  capturedBy: string;
  caption?: string;
}

export interface AuditEvent {
  id: UUID;
  trialId: UUID;
  timestamp: ISODateString;
  operatorId: string;
  action: string;
  entityType: 'TRIAL' | 'BATCH' | 'PANEL' | 'STAGE' | 'ACQUISITION' | 'CONFIG' | 'PROTOCOL';
  entityId: string;
  details?: Record<string, unknown>;
}

export interface Trial {
  id: UUID;
  schemaVersion: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  metadata: TrialMetadata;
  commonCharacteristics?: CommonCharacteristics;
  status: TrialStatus;
  configurationStatus: ConfigurationStatus;
  config: TrialProtocolConfig;
  scheduleConfig: ExposureScheduleConfig;
  stages: ExposureStage[];
  batches: BatchDefinition[];
  acquisitions: Record<string, PanelAcquisitionRecord>;
  auditTrail: AuditEvent[];
  mediaReferences: MediaReference[];
  reports?: ScientificReport[];
}
