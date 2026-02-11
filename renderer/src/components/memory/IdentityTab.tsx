"use client";

import { useIdentity } from "@/hooks/useIdentity";

export function IdentityTab() {
  const { identity, history, isLoading, generateIdentity, isGenerating } = useIdentity();

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-dark">Loading identity...</div>;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="label">Identity Document</h3>
        <button
          onClick={() => generateIdentity()}
          disabled={isGenerating}
          className="btn-ship text-xs px-3 py-1"
        >
          {isGenerating ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {!identity ? (
        <div className="text-center py-8">
          <span className="label-dark">{"// NO_IDENTITY"}</span>
          <p className="text-sm text-muted-dark mt-2">
            No identity document yet. Click Regenerate to create one from your memories.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-muted-dark">
            Version {identity.version} — Generated {new Date(identity.generatedAt).toLocaleString()}
          </div>

          {identity.content.values?.length > 0 && (
            <section>
              <h4 className="text-xs mono text-muted-dark uppercase mb-2">Values</h4>
              <ul className="space-y-1">
                {identity.content.values.map((v, i) => (
                  <li key={i} className="text-sm text-foreground">{v}</li>
                ))}
              </ul>
            </section>
          )}

          {identity.content.capabilities?.length > 0 && (
            <section>
              <h4 className="text-xs mono text-muted-dark uppercase mb-2">Capabilities</h4>
              <ul className="space-y-1">
                {identity.content.capabilities.map((c, i) => (
                  <li key={i} className="text-sm text-foreground">{c}</li>
                ))}
              </ul>
            </section>
          )}

          {identity.content.growthNarrative && (
            <section>
              <h4 className="text-xs mono text-muted-dark uppercase mb-2">Growth Narrative</h4>
              <p className="text-sm text-foreground">{identity.content.growthNarrative}</p>
            </section>
          )}

          {identity.content.keyRelationships?.length > 0 && (
            <section>
              <h4 className="text-xs mono text-muted-dark uppercase mb-2">Key Relationships</h4>
              <ul className="space-y-1">
                {identity.content.keyRelationships.map((r, i) => (
                  <li key={i} className="text-sm text-foreground">
                    <span className="text-muted-dark">{r.name}:</span> {r.nature}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {history.length > 1 && (
        <section>
          <h4 className="text-xs mono text-muted-dark uppercase mb-2">Version History</h4>
          <div className="space-y-1">
            {history.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 text-xs text-muted-dark">
                <span className="mono">v{doc.version}</span>
                <span>{new Date(doc.generatedAt).toLocaleString()}</span>
                {doc.isActive && <span className="text-green-400">(active)</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
