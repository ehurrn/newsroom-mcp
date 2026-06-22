/* AUTO-GENERATED — do not edit by hand. Run: npm run codegen */

/**
 * Canonical data schema for an investigation. Every claim must trace to graded evidence; every entity must have a role; every missing record must be a tracked gap. Agents should maintain the master file as JSON conforming to this schema (e.g. master-file.json in the investigation workspace) and render markdown tables from it, not the other way around.
 */
export interface InvestigationMasterFile {
  investigation: {
    /**
     * e.g. INV-2026-001
     */
    id: string;
    title: string;
    /**
     * The single falsifiable question the investigation must answer.
     */
    central_question: string;
    /**
     * What this investigation explicitly does NOT cover — prevents scope creep.
     */
    scope_exclusions?: string[];
    opened: string;
    status?: 'open' | 'drafting' | 'legal-review' | 'published' | 'archived' | 'killed';
    legal_review_required?: boolean;
    /**
     * When true (the default), NOTHING in the investigation workspace may be deleted, overwritten, or redacted in place — evidence, notes, drafts, dead-end leads included. Anticipated litigation makes spoliation the single largest avoidable legal exposure.
     */
    legal_hold?: boolean;
    /**
     * Write-once directory for preserved originals, e.g. evidence/. Files are added, never modified or removed.
     */
    evidence_dir?: string;
    [k: string]: any;
  };
  entities: {
    id: string;
    name: string;
    /**
     * AKAs, maiden names, DBA names, prior corporate names, common misspellings.
     */
    aliases?: string[];
    type:
      | 'person'
      | 'company'
      | 'llc'
      | 'trust'
      | 'nonprofit'
      | 'pac'
      | 'government-body'
      | 'official'
      | 'asset'
      | 'unknown';
    /**
     * @minItems 1
     */
    roles: [
      (
        | 'subject'
        | 'initiator'
        | 'beneficiary'
        | 'victim'
        | 'witness'
        | 'gatekeeper'
        | 'intermediary'
        | 'nominee'
        | 'associate'
        | 'decision-maker'
        | 'source'
      ),
      ...(
        | 'subject'
        | 'initiator'
        | 'beneficiary'
        | 'victim'
        | 'witness'
        | 'gatekeeper'
        | 'intermediary'
        | 'nominee'
        | 'associate'
        | 'decision-maker'
        | 'source'
      )[]
    ];
    /**
     * States/countries of registration, residence, or operation — drives which registries to sweep.
     */
    jurisdictions?: string[];
    /**
     * Registry keys for deduplication and record sweeps.
     */
    identifiers?: {
      ein?: string;
      sos_filing_numbers?: string[];
      /**
       * SEC EDGAR Central Index Key
       */
      cik?: string;
      fec_committee_id?: string;
      professional_licenses?: string[];
      domains?: string[];
      [k: string]: any;
    };
    dossier_status?: 'not-started' | 'records-sweep-pending' | 'in-progress' | 'complete';
    notes?: string;
    [k: string]: any;
  }[];
  /**
   * First-class edges between entities. A claim about a connection is only as strong as the documented relationship behind it.
   */
  relationships?: {
    id: string;
    from: string;
    to: string;
    type:
      | 'owns'
      | 'controls'
      | 'employs'
      | 'funds'
      | 'donated-to'
      | 'contracted-with'
      | 'board-member-of'
      | 'family'
      | 'cohabits'
      | 'litigated-against'
      | 'registered-agent-for'
      | 'shares-address'
      | 'shares-officer'
      | 'preceded-by'
      | 'unknown-link';
    direction?: 'directed' | 'undirected';
    /**
     * Monetary amount, ownership %, or other quantification if known.
     */
    value?: string;
    period?: {
      start?: string;
      end?: string;
      [k: string]: any;
    };
    /**
     * Empty array = inferred relationship; must be flagged, never published.
     */
    evidence_ids?: string[];
    [k: string]: any;
  }[];
  evidence: {
    id: string;
    title: string;
    source_type:
      | 'official-record'
      | 'court-filing'
      | 'regulatory-filing'
      | 'campaign-finance'
      | 'foia-response'
      | 'corporate-registry'
      | 'property-record'
      | 'ucc-filing'
      | 'news-secondary'
      | 'human-source'
      | 'social-media'
      | 'web-archive'
      | 'dataset'
      | 'physical'
      | 'other';
    /**
     * Admiralty source-reliability grade. A=completely reliable (certified official record), B=usually reliable, C=fairly reliable, D=not usually reliable, E=unreliable, F=cannot be judged.
     */
    reliability: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    /**
     * Admiralty information-credibility grade. 1=confirmed by independent sources, 2=probably true, 3=possibly true, 4=doubtful, 5=improbable, 6=cannot be judged.
     */
    credibility: '1' | '2' | '3' | '4' | '5' | '6';
    /**
     * Chain of custody — required for libel defense and source protection.
     */
    custody: {
      /**
       * Registry URL, agency, or source codename. NEVER a confidential source's real identity — keep that off-file.
       */
      obtained_from: string;
      obtained_date: string;
      method:
        | 'public-registry'
        | 'foia'
        | 'court-access'
        | 'purchase'
        | 'provided-by-source'
        | 'web-archive'
        | 'field-observation';
      /**
       * SHA-256 of the file as obtained, to prove non-alteration.
       */
      hash?: string;
      /**
       * Path under evidence_dir to the preserved original. Required once retrieved — a citation to a live URL alone is NOT preservation.
       */
      local_path?: string;
      /**
       * Independent third-party capture (Wayback Machine / archive.today) for any web-sourced item, taken at collection time. Web pages change and disappear; archive immediately, not at publication.
       */
      archived_url?: string;
      /**
       * An evidence item may not support a publishable claim until 'preserved'. 'unpreservable' (e.g. field observation) requires a contemporaneous dated memo filed as its own DOC- item.
       */
      preservation_status?: 'preserved' | 'pending' | 'unpreservable';
      [k: string]: any;
    };
    summary?: string;
    /**
     * IDs of evidence or claims this document conflicts with.
     */
    contradicts?: string[];
    [k: string]: any;
  }[];
  claims: {
    id: string;
    /**
     * Stated in zero-error procedural form: who, what, when, per which document.
     */
    text: string;
    entity_ids: string[];
    evidence_ids?: string[];
    status: 'unconfirmed' | 'single-source' | 'corroborated' | 'contradicted' | 'falsified';
    /**
     * True only if status is 'corroborated' (two independent sources) OR single-source where the source is an A1/A2-graded official record.
     */
    publishable?: boolean;
    /**
     * High = imputes crime, fraud, or professional incompetence to an identifiable living person/active company. Requires legal review and an on-record comment request before publication.
     */
    defamation_risk?: 'none' | 'low' | 'medium' | 'high';
    /**
     * Whether the subject was offered right of reply.
     */
    comment_requested?: boolean;
    [k: string]: any;
  }[];
  timeline?: {
    id: string;
    /**
     * ISO date or date range; precision flag in date_precision.
     */
    date: string;
    date_precision?: 'exact' | 'month' | 'quarter' | 'year' | 'approximate';
    event: string;
    entity_ids?: string[];
    evidence_ids: string[];
    anomaly_flag?: 'none' | 'compression' | 'suspicious-delay' | 'sequence-inversion' | 'round-trip';
    [k: string]: any;
  }[];
  gaps?: {
    id: string;
    expected_document: string;
    entity_ids?: string[];
    /**
     * Why this record should exist.
     */
    rationale: string;
    search_status:
      | 'not-searched'
      | 'in-progress'
      | 'foia-pending'
      | 'blocked-private'
      | 'retrieved'
      | 'confirmed-nonexistent';
    /**
     * FOIA target, registry, alternative route (adversary litigation, state-level parallel request, archive).
     */
    strategy?: string;
    due_date?: string;
    [k: string]: any;
  }[];
  /**
   * APPEND-ONLY audit trail of every evidentiary action. Entries are never edited or deleted — corrections are logged as new entries referencing the old one. This log is the outlet's proof of good-faith process in any libel or discovery proceeding.
   */
  collection_log: {
    /**
     * Monotonic sequence number; gaps indicate tampering.
     */
    seq: number;
    timestamp: string;
    /**
     * Agent or human who performed the action.
     */
    actor: string;
    action:
      | 'collected'
      | 'preserved'
      | 'graded'
      | 'cited-in-draft'
      | 'comment-requested'
      | 'comment-received'
      | 'claim-promoted'
      | 'claim-killed'
      | 'exported'
      | 'published'
      | 'correction'
      | 'log-amendment';
    /**
     * DOC-/CLM-/ENT-/LEAD- ids touched by this action.
     */
    refs?: string[];
    /**
     * What was done and why — including searches that returned nothing (negative results are evidence of diligence).
     */
    notes?: string;
    [k: string]: any;
  }[];
  /**
   * Hunches and tips. Leads are NOT claims — they carry no evidentiary weight and must never appear in a draft. Dead-end leads are marked, never deleted.
   */
  leads?: {
    id: string;
    text: string;
    origin?: string;
    status: 'open' | 'promoted-to-claim' | 'dead-end';
    next_action?: string;
    [k: string]: any;
  }[];
  [k: string]: any;
}

// Convenience aliases used throughout the codebase.
export type MasterFile = InvestigationMasterFile;
export type Entity = InvestigationMasterFile['entities'][number];
export type Evidence = InvestigationMasterFile['evidence'][number];
export type Claim = InvestigationMasterFile['claims'][number];
export type CollectionLogEntry = InvestigationMasterFile['collection_log'][number];
