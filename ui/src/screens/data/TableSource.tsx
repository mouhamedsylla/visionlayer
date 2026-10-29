import type { Entity } from "../../api/types";
import { useSource } from "../../api/useSource";
import { CodeExcerpt } from "../../components/CodeExcerpt";
import { ProofRef } from "../../components/ProofRef";
import { PanelNote } from "../../components/SidePanel";
import { declarationSpan, leadingComment, withoutLeadingComment } from "../../domain/data/excerpt";
import styles from "./TablePanel.module.css";

/** Ce que l'auteur dit de la table (son commentaire), puis sa déclaration, contrôles en avant. */
export function TableSource({ entity, version }: { entity: Entity; version: string }) {
  const span = declarationSpan(entity);
  const source = useSource(span, version);
  if (source?.status === "error") return <PanelNote>Le code n'a pas pu être lu : {source.message}</PanelNote>;
  if (source?.status !== "ready" || !span) return null;
  const comment = leadingComment(source.excerpt, span.line);
  return (
    <>
      {comment && (
        <blockquote className={styles.comment}>
          <b>« {comment.text} »</b>
          <span>commentaire · <ProofRef proof={{ path: span.path, line: comment.line }} /></span>
        </blockquote>
      )}
      <CodeExcerpt excerpt={withoutLeadingComment(source.excerpt, span.line)} marks={span.marks} marksLabel="contrôles" />
    </>
  );
}
