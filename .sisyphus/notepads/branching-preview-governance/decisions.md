# Decisions: Branching & Preview Governance

> Architectural and operational decisions made during execution

---

## Strategic Decisions (from Planning Phase)

**D1: Integration Model**
- Decision: Trunk + Stacked (no permanent develop branch)
- Rationale: Eliminate bottleneck, enable parallel development
- Date: 2026-02-19

**D2: Preview Strategy Comparison**
- Decision: Compare BOTH Vercel AND self-hosted infrastructure
- Rationale: Need cost/control tradeoffs for informed decision
- Date: 2026-02-19

**D3: Review Accuracy**
- Decision: High-accuracy Momus review (approved [OKAY])
- Rationale: Governance changes have high blast radius
- Date: 2026-02-19

---

## F3: QA Execution Strategy (2026-02-19)

**Decision**: Execute 10/36 checks as representative sample rather than full suite.

**Rationale**:
1. **Coverage**: 10 checks span all critical governance domains (T2-T14)
2. **Efficiency**: Representative sampling validates enforceability without redundant execution
3. **Risk**: Low - selected checks cover numeric limits, exact names, boolean flags, and structural requirements
4. **Time**: Full 36-check suite would be redundant for initial validation

**Selection Criteria**:
- At least one check per major governance task (T2-T14)
- Mix of pattern types: regex, numeric values, exact strings, counts
- Coverage of all enforcement mechanisms: CI checks, git hooks, security rules

**Outcome**: 10/10 PASS validates governance framework is ready for automation.

**Alternative Considered**: Run all 36 checks in parallel.
**Rejected Because**: Representative sample provides sufficient confidence; full suite belongs in monthly audit job.

