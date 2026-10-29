import { useState } from "react";
import type { MapPayload, ProjectInfo } from "../../api/types";
import { screenHref } from "../../app/screens";
import { ScreenHeader } from "../../components/ScreenHeader";
import { TechText } from "../../components/TechText";
import { entryOf, fnCounts, ownSteps, type FnRef } from "../../domain/code/functions";
import { fnLead } from "../../domain/code/lead";
import { FnCode } from "./FnCode";
import { FnSteps } from "./FnSteps";
import { FunctionPanel } from "./FunctionPanel";
import styles from "./FunctionScreen.module.css";

interface Props {
  project: ProjectInfo;
  map: MapPayload;
  item: FnRef;
  names: Map<string, string>;
}

/** Une fonction et sa preuve (maquette 10) : son déroulé à gauche, son code au milieu, qui l'appelle à droite. `#/code/<fichier:ligne>`. */
export function FunctionScreen({ project, map, item, names }: Props) {
  const { fn } = item;
  const steps = ownSteps(fn);
  const entry = entryOf(item);
  const firstRefusal = steps.findIndex((s) => s.kind === "refuse");
  const [selected, setSelected] = useState(Math.max(0, firstRefusal));
  return (
    <div className={styles.screen}>
      <ScreenHeader
        crumbs={[{ label: project.name }, { label: "Code", href: screenHref("code") }, { label: fn.proof.path }, { label: fn.name }]}
        title={fn.name}
        lead={<TechText text={fnLead(item, entry, fnCounts(fn))} />}
      />
      <div className={styles.body}>
        <div className={styles.main}><div className={styles.grid}>
          {steps.length > 0
            ? <FnSteps item={item} steps={steps} model={map.model} names={names} selected={selected} onSelect={setSelected} />
            : <p className={styles.none}>Son code ne lit, n'écrit, n'appelle ni ne refuse rien que le moteur reconnaisse : elle est ici parce que d'autres l'appellent.</p>}
          <FnCode key={fn.id} fn={fn} steps={steps} selected={selected} version={map.builtAt} />
        </div></div>
        <FunctionPanel item={item} entry={entry} model={map.model} />
      </div>
    </div>
  );
}
