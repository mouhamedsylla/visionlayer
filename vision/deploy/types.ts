/**
 * Niveau Déploiement : comment le code arrive là où il tourne, lu dans les
 * chaînes de livraison du dépôt (workflows). Chaque fait garde sa ligne.
 * Rien n'est lancé, aucun hébergeur n'est contacté, aucun secret n'est lu :
 * un secret cité par un workflow n'est connu que par son nom.
 */

/** Ce que fait une étape, d'après sa commande ou l'action qu'elle emploie. */
export type StepKind = "checkout" | "setup" | "install" | "check" | "build" | "image" | "deploy" | "other";

export interface PipelineStep {
  line: number;
  /** Le nom écrit, sinon la commande ou l'action. */
  label: string;
  /** La commande (`run`) ou l'action (`uses`) telle qu'écrite, première ligne. */
  command: string;
  kind: StepKind;
  /** Pour un déploiement ou une image : la technologie du catalogue visée (`flyio`, `vercel`, `docker`). */
  target?: string;
  /** Les secrets cités, par leur nom seulement. */
  secrets?: string[];
}

export interface PipelineJob {
  id: string;
  line: number;
  /** Les jobs qui doivent finir avant lui. */
  needs: string[];
  /** L'environnement nommé du job ; ses règles d'approbation vivent chez l'hébergeur du dépôt, pas dans le fichier. */
  environment?: { name: string; line: number };
  /** La condition écrite devant le job (`github.ref == 'refs/heads/main'`). */
  when?: string;
  steps: PipelineStep[];
}

export interface Pipeline {
  path: string;
  name: string;
  /** `push (main)`, `pull_request`, `workflow_dispatch`, avec leur ligne. */
  triggers: { label: string; line: number }[];
  jobs: PipelineJob[];
  parseError?: string;
}

export interface DeployModel {
  pipelines: Pipeline[];
}
