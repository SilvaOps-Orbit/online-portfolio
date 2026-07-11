import { useState } from "react";
import type { CareerRoadmapConfig, RoadmapAttribute } from "./portfolio-types";

interface RoadmapAttributesProps {
  roadmap: CareerRoadmapConfig;
}

export function RoadmapAttributes({ roadmap }: RoadmapAttributesProps) {
  const [selected, setSelected] = useState<RoadmapAttribute | null>(null);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [flash, setFlash] = useState<{ id: string; result: "good" | "bad" } | null>(null);
  const [showBadge, setShowBadge] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);
  const attributes = roadmap.commonAttributes || [];
  const sequence = roadmap.commonAttributesSequence || [];

  function testSequence(attribute: RoadmapAttribute) {
    if (!sequence.length || !attribute.id) return;
    const correct = attribute.id === sequence[sequenceIndex];
    setFlash({ id: attribute.id, result: correct ? "good" : "bad" });
    window.setTimeout(() => setFlash(null), 2000);
    if (!correct) {
      setSequenceIndex(0);
      return;
    }
    if (sequenceIndex + 1 === sequence.length) {
      setSequenceIndex(0);
      window.setTimeout(() => setShowBadge(true), 220);
    } else {
      setSequenceIndex(sequenceIndex + 1);
    }
  }

  return (
    <>
      <div className="roadmap-attributes">
        <div className="roadmap-attributes-heading">
          <span className="roadmap-card-label">13 common attributes</span>
          <p>Left click for the meaning. Right click tests the hidden sequence.</p>
        </div>
        <div className="roadmap-attribute-list">
          {attributes.map((attribute) => {
            const flashResult = flash && flash.id === attribute.id ? flash.result : null;
            const stateClass = flashResult ? ` is-sequence-${flashResult}` : "";
            return (
              <article key={attribute.id || attribute.title} className={`roadmap-attribute-card${selected?.id === attribute.id ? " is-selected" : ""}${stateClass}`}>
                <button
                  className="roadmap-attribute-button"
                  type="button"
                  title="Left click for details. Right click for the hidden sequence."
                  onClick={() => setSelected(attribute)}
                  onContextMenu={(event) => { event.preventDefault(); testSequence(attribute); }}
                >
                  <strong>{attribute.title || "Attribute"}</strong>
                </button>
              </article>
            );
          })}
        </div>
        {selected && (
          <div className="roadmap-attribute-popover is-entering" role="status">
            <strong>{selected.title}</strong>
            <p>{selected.meaning || "Definition pending."}</p>
            <button className="roadmap-attribute-popover-close" type="button" onClick={() => setSelected(null)}>Close</button>
          </div>
        )}
      </div>
      {showBadge && (
        <div className="sf-easter" role="dialog" aria-modal="true" aria-label="Mission sequence accepted" onClick={() => setShowBadge(false)}>
          <img className="sf-easter-real-badge" src={roadmap.badgeImageUrl || "assets/sf-badge.png"} alt={`${roadmap.motto?.text || "Foras Admonitio"} badge`} draggable={false} />
          <div className="sf-easter-badge" onClick={(event) => event.stopPropagation()}>
            <span>Mission sequence accepted</span>
            <div className="sf-motto-line">
              <strong>{roadmap.motto?.text || "Foras Admonitio"}</strong>
              <button className="sf-motto-help" type="button" aria-label="Explain the motto" aria-expanded={showMeaning} onClick={() => setShowMeaning((value) => !value)}>?</button>
            </div>
            <em>{roadmap.motto?.translation || "Without Warning"}</em>
            {showMeaning && <p className="sf-motto-meaning">{roadmap.motto?.meaning}</p>}
            <button className="roadmap-attribute-popover-close" type="button" onClick={() => setShowBadge(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
