/**
 * QUV-Lab — Utilitaires de Filtrage et Ségrégation Éprouvettes & Jalons (GATE 2.2)
 *
 * Règles absolues :
 * 1. Témoin T (conservé à l'obscurité) NE DOIT JAMAIS entrer dans les calculs de moyennes
 *    et dispersions des exposés E1, E2, E3.
 * 2. Les étapes inactives (désactivées par l'opérateur) sont exclues des calculs actifs.
 */

import { PanelDefinition, ExposureStage } from '../types/trial';

/**
 * Détermine si une éprouvette est le Témoin non exposé (T)
 */
export function isWitnessPanel(panel: {
  label?: string;
  roleCode?: string;
  role?: string;
}): boolean {
  if (!panel) return false;
  return (
    panel.label === 'T' ||
    panel.roleCode === 'T' ||
    panel.role === 'WITNESS' ||
    panel.label === 'P01' && (panel.role === 'WITNESS' || panel.roleCode === 'T')
  );
}

/**
 * Détermine si une éprouvette est une éprouvette exposée valide (E1, E2, E3, etc.)
 */
export function isExposedPanel(panel: {
  label?: string;
  roleCode?: string;
  role?: string;
  status?: string;
}): boolean {
  if (!panel) return false;
  if (panel.status && panel.status !== 'ACTIVE') return false;
  return !isWitnessPanel(panel);
}

/**
 * Filtre les éprouvettes actives et EXPOSÉES d'une liste (exclut T et les exclus)
 */
export function getActiveExposedPanels<T extends { label?: string; roleCode?: string; role?: string; status?: string }>(
  panels: T[]
): T[] {
  return panels.filter((p) => isExposedPanel(p));
}

/**
 * Récupère l'éprouvette Témoin T d'un lot
 */
export function getWitnessPanel<T extends { label?: string; roleCode?: string; role?: string }>(
  panels: T[]
): T | undefined {
  return panels.find((p) => isWitnessPanel(p));
}

/**
 * Filtre les étapes actives de l'essai (exclut les étapes désactivées / INACTIVE)
 */
export function getActiveStages<T extends { status: string }>(stages: T[]): T[] {
  return stages.filter((s) => s.status !== 'INACTIVE');
}

/**
 * Détermine si une étape est obligatoire et non désactivable
 */
export function isMandatoryStage(stage: { cycleIndex: number; stageType?: string }): boolean {
  return (
    stage.cycleIndex === 0 ||
    stage.cycleIndex === 12 ||
    stage.stageType === 'INITIAL_PRE_EXPOSURE' ||
    stage.stageType === 'FINAL_POST_EXPOSURE'
  );
}
