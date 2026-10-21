// PLACEHOLDER notes for Year 2 (2026-27). They exist so the Notes page and the Knowledge Galaxy have
// something to show before your real lecture PDFs are uploaded. They are generic outlines written as
// stand-ins, not your lecturers' actual syllabus, and every one is badged "placeholder" in the app.
// As soon as a module has at least one real lecture uploaded (Notion → Export → PDF), its placeholders vanish.

export type SeedNote = {
  slug: string;
  module: string; // module code
  week: number | null; // teaching week of the term, null for non-weekly notes
  kind: "lecture" | "reading" | "concept" | "essay";
  title: string;
  tags: string[];
  body: string[]; // paragraphs; lines starting "- " render as bullets
};

export const SEED_NOTES: SeedNote[] = [
  // ---- HPSC0014 Philosophy of Science 2 -----------------------------------------------------
  {
    slug: "0014-w1", module: "HPSC0014", week: 1, kind: "lecture", title: "Week 1: Scientific realism and its rivals",
    tags: ["realism", "evidence", "models"],
    body: ["Placeholder outline. What does it mean to say a theory is true, and why believe the unobservable?",
      "- The no-miracles argument: success of science would be a miracle if theories were not approximately true",
      "- Pessimistic meta-induction: past successful theories were later rejected",
      "- Constructive empiricism: accept a theory as empirically adequate, stay agnostic about the rest",
      "Questions to bring to the seminar: is 'observable' a principled line or a vague one?"],
  },
  {
    slug: "0014-w2", module: "HPSC0014", week: 2, kind: "lecture", title: "Week 2: Underdetermination and theory choice",
    tags: ["evidence", "values", "realism"],
    body: ["Placeholder outline.",
      "- Holism (Duhem-Quine): hypotheses face evidence together, not alone",
      "- Strong vs weak underdetermination, and whether either is a real threat",
      "- Theoretical virtues (simplicity, scope, fertility) as tie-breakers, and whether they track truth"],
  },
  {
    slug: "0014-w3", module: "HPSC0014", week: 3, kind: "lecture", title: "Week 3: Explanation and causation",
    tags: ["causation", "models"],
    body: ["Placeholder outline.",
      "- Deductive-nomological model and the counterexamples (flagpole, hexed salt)",
      "- Causal and mechanistic accounts of explanation",
      "- Interventionist causation and what experiments add"],
  },
  {
    slug: "0014-w4", module: "HPSC0014", week: 4, kind: "lecture", title: "Week 4: Values in science",
    tags: ["values", "ethics", "expertise"],
    body: ["Placeholder outline.",
      "- The value-free ideal and the argument from inductive risk",
      "- Whose values should shape acceptance thresholds when evidence is uncertain?",
      "- Link forward: policy advice and the role of scientists in public decisions"],
  },
  {
    slug: "0014-w5", module: "HPSC0014", week: 5, kind: "lecture", title: "Week 5: Models and idealisation",
    tags: ["models", "AI", "evidence"],
    body: ["Placeholder outline.",
      "- Models as 'false but useful': Galilean vs minimalist idealisation",
      "- Do machine-learning models explain, or only predict?",
      "- Representation, similarity and the 'map' analogy"],
  },
  {
    slug: "0014-r1", module: "HPSC0014", week: 2, kind: "reading", title: "Reading notes: van Fraassen, The Scientific Image (ch. 2)",
    tags: ["realism", "evidence"],
    body: ["Placeholder. Summarise the argument for constructive empiricism in my own words.",
      "- Key claim, strongest objection, and my reply"],
  },
  {
    slug: "0014-c1", module: "HPSC0014", week: null, kind: "concept", title: "Key concepts: inductive risk, underdetermination, empirical adequacy",
    tags: ["values", "evidence", "realism"],
    body: ["Placeholder glossary. One line each, plus an example I can use in an exam answer."],
  },
  {
    slug: "0014-e1", module: "HPSC0014", week: null, kind: "essay", title: "Essay idea: can AI models be explanatory?",
    tags: ["AI", "models", "causation"],
    body: ["Placeholder essay plan.",
      "- Thesis: prediction without mechanism is not explanation, but some ML models support interventions",
      "- Needs: one realism source, one explanation source, one case from medicine or climate"],
  },

  // ---- HPSC0022 Science and Religion ---------------------------------------------------------
  {
    slug: "0022-w1", module: "HPSC0022", week: 1, kind: "lecture", title: "Week 1: The conflict thesis and its critics",
    tags: ["religion", "history", "evidence"],
    body: ["Placeholder outline.",
      "- Draper and White's 'warfare' narrative and why historians reject it",
      "- The complexity thesis: Brooke and the contextual approach",
      "- Questions: who benefits from telling the conflict story?"],
  },
  {
    slug: "0022-w2", module: "HPSC0022", week: 2, kind: "lecture", title: "Week 2: Galileo and the limits of scriptural authority",
    tags: ["religion", "Galileo", "expertise", "power"],
    body: ["Placeholder outline.",
      "- The 1616 and 1633 proceedings in political and patronage context",
      "- Who had the authority to interpret nature and scripture?",
      "- Link: expertise and legitimacy (compare Science in Government)"],
  },
  {
    slug: "0022-w3", module: "HPSC0022", week: 3, kind: "lecture", title: "Week 3: Natural theology and the argument from design",
    tags: ["religion", "Darwin", "evidence"],
    body: ["Placeholder outline.",
      "- Paley's watch and the physico-theology tradition",
      "- Darwin's reception among clergy and naturalists",
      "- Intelligent design as a modern revival"],
  },
  {
    slug: "0022-w4", module: "HPSC0022", week: 4, kind: "lecture", title: "Week 4: Science in medieval Islam and transmission to Europe",
    tags: ["religion", "history", "power"],
    body: ["Placeholder outline.",
      "- Translation movements and institutions",
      "- Optics, astronomy and medicine as case studies",
      "- Why 'Golden Age' framings are contested"],
  },
  {
    slug: "0022-w5", module: "HPSC0022", week: 5, kind: "lecture", title: "Week 5: Fine-tuning, cosmology and the multiverse",
    tags: ["religion", "models", "evidence"],
    body: ["Placeholder outline.",
      "- The fine-tuning argument and the anthropic response",
      "- Is the multiverse science or metaphysics?"],
  },
  {
    slug: "0022-r1", module: "HPSC0022", week: 3, kind: "reading", title: "Reading notes: Brooke, Science and Religion: Some Historical Perspectives",
    tags: ["religion", "history"],
    body: ["Placeholder. Three examples that undercut the conflict thesis, with page references to add."],
  },
  {
    slug: "0022-c1", module: "HPSC0022", week: null, kind: "concept", title: "Key concepts: conflict, independence, dialogue, integration",
    tags: ["religion", "values"],
    body: ["Placeholder. Barbour's four-way typology, with one historical case for each."],
  },
  {
    slug: "0022-e1", module: "HPSC0022", week: null, kind: "essay", title: "Essay idea: was the Galileo affair about science or authority?",
    tags: ["Galileo", "power", "expertise", "religion"],
    body: ["Placeholder essay plan.",
      "- Thesis: a dispute over who may interpret nature, with theology secondary",
      "- Sources to find: Biagioli on patronage, Finocchiaro's documents"],
  },

  // ---- HPSC0037 Thinking about Technology ----------------------------------------------------
  {
    slug: "0037-w1", module: "HPSC0037", week: 1, kind: "lecture", title: "Week 1: What is technology? Instrumental and substantive views",
    tags: ["technology", "ethics", "power"],
    body: ["Placeholder outline.",
      "- The instrumental view (technology as neutral tool) and its critics",
      "- Heidegger's 'enframing' and the question of technology's essence"],
  },
  {
    slug: "0037-w2", module: "HPSC0037", week: 2, kind: "lecture", title: "Week 2: Do artifacts have politics?",
    tags: ["technology", "power", "regulation"],
    body: ["Placeholder outline.",
      "- Winner's Moses bridges and the claim that design embeds politics",
      "- Technological determinism vs social construction (SCOT)",
      "- What follows for regulation: govern the design or the use?"],
  },
  {
    slug: "0037-w3", module: "HPSC0037", week: 3, kind: "lecture", title: "Week 3: Autonomous technology and runaway systems",
    tags: ["technology", "AI", "risk", "power"],
    body: ["Placeholder outline.",
      "- Ellul, Mumford and the 'megamachine'",
      "- Modern echoes in debates about algorithmic systems and AI risk"],
  },
  {
    slug: "0037-w4", module: "HPSC0037", week: 4, kind: "lecture", title: "Week 4: Expertise, trust and the algorithmic society",
    tags: ["AI", "expertise", "regulation", "ethics"],
    body: ["Placeholder outline.",
      "- Who counts as an expert about a technology that few understand?",
      "- Audits, transparency and accountability for automated decisions",
      "- Link: the policy-advice problem in Science in Government"],
  },
  {
    slug: "0037-w5", module: "HPSC0037", week: 5, kind: "lecture", title: "Week 5: Platforms, data and the governance gap",
    tags: ["regulation", "technology", "power", "AI"],
    body: ["Placeholder outline.",
      "- Why law lags behind platform business models",
      "- GDPR, the Online Safety Act and the EU AI Act as case studies of regulating by risk tier"],
  },
  {
    slug: "0037-r1", module: "HPSC0037", week: 2, kind: "reading", title: "Reading notes: Winner, 'Do Artifacts Have Politics?'",
    tags: ["technology", "power"],
    body: ["Placeholder. Two readings of Winner's claim (design intent vs structural effect) and the strongest critique."],
  },
  {
    slug: "0037-c1", module: "HPSC0037", week: null, kind: "concept", title: "Key concepts: determinism, SCOT, affordances, enframing",
    tags: ["technology", "values"],
    body: ["Placeholder glossary with one example per concept."],
  },
  {
    slug: "0037-e1", module: "HPSC0037", week: null, kind: "essay", title: "Essay idea: should we regulate AI systems by design or by use?",
    tags: ["AI", "regulation", "expertise", "technology"],
    body: ["Placeholder essay plan.",
      "- Thesis: risk-tiered rules need technical expertise that regulators struggle to keep",
      "- Cross-module: Winner (0037) plus the expert-advice literature (0124)"],
  },

  // ---- HPSC0124 Science in Government --------------------------------------------------------
  {
    slug: "0124-w1", module: "HPSC0124", week: 1, kind: "lecture", title: "Week 1: How science enters government",
    tags: ["policy", "expertise", "evidence"],
    body: ["Placeholder outline.",
      "- Chief Scientific Advisers, advisory committees and the machinery of advice",
      "- Linear model vs co-production of knowledge and policy"],
  },
  {
    slug: "0124-w2", module: "HPSC0124", week: 2, kind: "lecture", title: "Week 2: The role of the expert: honest broker or advocate?",
    tags: ["expertise", "values", "policy", "ethics"],
    body: ["Placeholder outline.",
      "- Pielke's typology of science advisers",
      "- Jasanoff's 'fifth branch' and the politics of expertise",
      "- Link: values and inductive risk from Philosophy of Science 2"],
  },
  {
    slug: "0124-w3", module: "HPSC0124", week: 3, kind: "lecture", title: "Week 3: Risk, precaution and uncertainty",
    tags: ["risk", "regulation", "policy", "evidence"],
    body: ["Placeholder outline.",
      "- Risk assessment vs risk management",
      "- The precautionary principle and its critics",
      "- BSE as a case of official reassurance failing"],
  },
  {
    slug: "0124-w4", module: "HPSC0124", week: 4, kind: "lecture", title: "Week 4: Evidence-based policy and its limits",
    tags: ["evidence", "policy", "models", "democracy"],
    body: ["Placeholder outline.",
      "- What counts as evidence, and who decides?",
      "- Randomised trials, modelling and the COVID advice experience"],
  },
  {
    slug: "0124-w5", module: "HPSC0124", week: 5, kind: "lecture", title: "Week 5: Governing emerging technologies (AI, biotech)",
    tags: ["AI", "regulation", "risk", "expertise", "policy"],
    body: ["Placeholder outline.",
      "- Horizon scanning, regulatory sandboxes and AI safety institutes",
      "- Can democratic institutions keep pace with technical change?"],
  },
  {
    slug: "0124-r1", module: "HPSC0124", week: 2, kind: "reading", title: "Reading notes: Jasanoff, The Fifth Branch",
    tags: ["expertise", "policy", "democracy"],
    body: ["Placeholder. Summary of regulatory science as a hybrid of science and politics, plus two UK examples."],
  },
  {
    slug: "0124-c1", module: "HPSC0124", week: null, kind: "concept", title: "Key concepts: boundary work, co-production, precaution, honest broker",
    tags: ["expertise", "policy", "risk"],
    body: ["Placeholder glossary."],
  },
  {
    slug: "0124-e1", module: "HPSC0124", week: null, kind: "essay", title: "Essay idea: what went right and wrong in scientific advice during COVID-19?",
    tags: ["evidence", "expertise", "policy", "risk"],
    body: ["Placeholder essay plan.",
      "- Thesis: transparency about uncertainty mattered more than the models themselves",
      "- Sources: SAGE minutes, Pielke, the Institute for Government review"],
  },
];

export const SEED_KIND_LABEL: Record<SeedNote["kind"], string> = {
  lecture: "Lecture",
  reading: "Reading",
  concept: "Concepts",
  essay: "Essay idea",
};
