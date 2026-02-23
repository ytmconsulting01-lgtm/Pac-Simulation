import { useMemo, useState } from "react";

type ProfilAides = "Grand précaire" | "Modeste" | "Violet" | "Classique";
type ChauffageActuel = "Gaz" | "Fioul" | "Électricité" | "Poêle à granulés" | "Autre";
type Alimentation = "Monophasé" | "Triphasé";
type Emetteurs = "Radiateurs" | "Plancher chauffant" | "Autre";
type TypeRadiateurs = "Fonte" | "Aluminium" | "Mixte" | "Inconnu";

const PRIX_BASE_PAC_BTD = 22900; // PAC + ballon thermodynamique (moyenne)
const TAUX_TAEG = 4.98; // indicatif
const DUREE_MOIS = 180;

// Aides EDF (exprimées par toi)
const AIDES_EDF: Record<ProfilAides, { pac: number; btd: number }> = {
  "Grand précaire": { pac: 5000, btd: 1200 },
  Modeste: { pac: 4000, btd: 800 },
  Violet: { pac: 3000, btd: 500 },
  Classique: { pac: 0, btd: 0 },
};

// Surconsommation (règle simple demandée)
// Si (€/mois) > 13 € * surface => surconsommation
const SURCONSO_EUR_M2_MOIS = 13;

function euros(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function monthlyPayment(principal: number, taegPercent: number, months: number) {
  const r = (taegPercent / 100) / 12;
  if (r === 0) return principal / months;
  return principal * (r / (1 - Math.pow(1 + r, -months)));
}

// Reco puissance simple (11 / 14 / 16) basée sur surface + cas usuels
function recoPuissance(surface: number, chauffage: ChauffageActuel, emetteurs: Emetteurs, radiateurs: TypeRadiateurs) {
  let kw = 11;
  if (surface > 90) kw = 14;
  if (surface > 130) kw = 16;

  // petits ajustements indicatifs
  if (chauffage === "Fioul" && surface >= 100) kw = Math.max(kw, 14);
  if (emetteurs === "Plancher chauffant" && surface >= 110) kw = Math.max(kw, 14);

  // radiateurs fonte : souvent bonne inertie -> on ne surdimensionne pas
  if (radiateurs === "Fonte" && kw === 16 && surface < 150) kw = 14;

  return kw as 11 | 14 | 16;
}

function EnergyMiniChart({
  title,
  subtitle,
  color = "#ef4444",
}: {
  title: string;
  subtitle: string;
  color?: string;
}) {
  // données visuelles illustratives (non contractuelles)
  const points = "20,120 80,110 140,100 200,95 260,90 320,80 380,70 440,55 500,45";
  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="h2">{title}</div>
          <div className="muted">{subtitle}</div>
        </div>
        <span className="pill danger">Tendance haussière</span>
      </div>

      <div className="chartWrap">
        <svg viewBox="0 0 520 160" className="chart">
          <defs>
            <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* grille */}
          {[20, 60, 100, 140].map((y) => (
            <line key={y} x1="20" x2="500" y1={y} y2={y} stroke="rgba(15,23,42,.08)" />
          ))}
          {[80, 160, 240, 320, 400].map((x) => (
            <line key={x} y1="20" y2="140" x1={x} x2={x} stroke="rgba(15,23,42,.05)" />
          ))}

          {/* aire */}
          <path
            d={`M ${points} L 500,140 L 20,140 Z`}
            fill="url(#grad)"
          />

          {/* ligne */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* axes */}
          <line x1="20" x2="20" y1="20" y2="140" stroke="rgba(15,23,42,.12)" />
          <line x1="20" x2="500" y1="140" y2="140" stroke="rgba(15,23,42,.12)" />
        </svg>

        <div className="chartBadges">
          <div className="miniBox">
            <div className="miniLabel">Aujourd’hui</div>
            <div className="miniValue">100%</div>
          </div>
          <div className="miniBox">
            <div className="miniLabel">Dans 5 ans</div>
            <div className="miniValue">~125%</div>
          </div>
          <div className="miniBox">
            <div className="miniLabel">Dans 10 ans</div>
            <div className="miniValue">~155%</div>
          </div>
        </div>
      </div>

      <div className="whyBox">
        <div className="whyTitle">Pourquoi cette hausse ne s’arrête pas ?</div>
        <ul className="whyList">
          <li>Coûts d’approvisionnement et volatilité des marchés.</li>
          <li>Contraintes géopolitiques et dépendances internationales.</li>
          <li>Transport / infrastructures et coûts de distribution.</li>
          <li>Évolutions réglementaires et fiscalité énergétique.</li>
        </ul>
        <div className="note">
          Indication visuelle : les prix peuvent varier selon le fournisseur, les contrats et la conjoncture.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState<1 | 2>(1);

  // Infos client
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [surface, setSurface] = useState<number>(100);

  // Technique
  const [chauffageActuel, setChauffageActuel] = useState<ChauffageActuel>("Gaz");
  const [alimentation, setAlimentation] = useState<Alimentation>("Monophasé");
  const [emetteurs, setEmetteurs] = useState<Emetteurs>("Radiateurs");
  const [typeRadiateurs, setTypeRadiateurs] = useState<TypeRadiateurs>("Fonte");

  // Conso
  const [consoMode, setConsoMode] = useState<"€/mois" | "€/an">("€/mois");
  const [consoMontant, setConsoMontant] = useState<number>(150);

  // Aides
  const [profilAides, setProfilAides] = useState<ProfilAides>("Modeste");

  // Affichage / export
  const [modeClient, setModeClient] = useState<boolean>(false);

  const consoMensuelle = useMemo(() => {
    if (consoMode === "€/mois") return consoMontant;
    return consoMontant / 12;
  }, [consoMode, consoMontant]);

  const eurM2Mois = useMemo(() => {
    if (!surface || surface <= 0) return 0;
    return consoMensuelle / surface;
  }, [consoMensuelle, surface]);

  const estSurconso = useMemo(() => {
    if (!surface || surface <= 0) return false;
    return consoMensuelle > SURCONSO_EUR_M2_MOIS * surface;
  }, [consoMensuelle, surface]);

  const puissanceReco = useMemo(() => {
    return recoPuissance(surface || 0, chauffageActuel, emetteurs, typeRadiateurs);
  }, [surface, chauffageActuel, emetteurs, typeRadiateurs]);

  // ⚠️ surcharge invisible : +500 TTC si triphasé OU plancher chauffant
  const surchargeInvisible = useMemo(() => {
    const needs = alimentation === "Triphasé" || emetteurs === "Plancher chauffant";
    return needs ? 500 : 0;
  }, [alimentation, emetteurs]);

  const aides = useMemo(() => {
    const v = AIDES_EDF[profilAides];
    return { pac: v.pac, btd: v.btd, total: v.pac + v.btd };
  }, [profilAides]);

  const montantFinance = useMemo(() => {
    const brut = PRIX_BASE_PAC_BTD + surchargeInvisible;
    const net = Math.max(0, brut - aides.total);
    return { brut, net };
  }, [aides.total, surchargeInvisible]);

  const mensualite = useMemo(() => {
    return monthlyPayment(montantFinance.net, TAUX_TAEG, DUREE_MOIS);
  }, [montantFinance.net]);

  const phraseSurconso = useMemo(() => {
    if (!estSurconso) return null;
    return (
      <div className="badge warn">
        ✅ Votre consommation semble supérieure à la moyenne constatée pour un logement équivalent.
        <br />
        Une optimisation du chauffage peut aider à réduire cette dépense.
      </div>
    );
  }, [estSurconso]);

  function exportPDFClient() {
    // On force un export “sans prix” en basculant temporairement en mode client
    const prev = modeClient;
    setModeClient(true);

    // Laisse React appliquer l'état avant print
    setTimeout(() => {
      window.print();
      setModeClient(prev);
    }, 50);
  }

  return (
    <div className="page">
      <div className="shell">

        {/* Top bar */}
        <div className="topbar no-print">
          <div>
            <div className="kicker">Outil technicien • Synthèse client (export sans prix)</div>
            <h1 className="title">Easy Energies — Étude Pompe à Chaleur</h1>
            <div className="sub">
              SIRET : 85308237800029 • 20 Rue Magellan, 94370 Sucy-en-Brie • 01 87 46 00 56
            </div>
          </div>

          <div className="actions">
            <button className={`tab ${step === 1 ? "active" : ""}`} onClick={() => setStep(1)}>
              Étape 1 — Logement
            </button>
            <button className={`tab ${step === 2 ? "active" : ""}`} onClick={() => setStep(2)}>
              Étape 2 — Prix énergie
            </button>
          </div>
        </div>

        {/* Mode client */}
        <div className="modeRow no-print">
          <label className="switch">
            <input
              type="checkbox"
              checked={modeClient}
              onChange={(e) => setModeClient(e.target.checked)}
            />
            <span />
          </label>
          <div>
            <div className="modeTitle">Affichage client</div>
            <div className="muted">
              Active-le pour cacher les montants (prix / mensualité). L’export PDF force ce mode automatiquement.
            </div>
          </div>
          <div className="spacer" />
          <button className="primary" onClick={exportPDFClient}>
            Export PDF (client) — sans prix
          </button>
        </div>

        {step === 1 && (
          <div className="grid">
            {/* Col gauche : Infos */}
            <div className="card">
              <div className="cardHeader">
                <div className="h2">Informations logement</div>
                <span className="pill">Étape 1</span>
              </div>

              <div className="fields">
                <div className="field">
                  <label>Nom client</label>
                  <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : M. Jean Dupont" />
                </div>

                <div className="field">
                  <label>Adresse du chantier</label>
                  <input className="input" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Ex : 12 rue ... 75000 Paris" />
                </div>

                <div className="two">
                  <div className="field">
                    <label>Superficie (m²)</label>
                    <input
                      className="input"
                      type="number"
                      value={surface}
                      onChange={(e) => setSurface(Number(e.target.value))}
                      min={20}
                      max={600}
                    />
                  </div>

                  <div className="field">
                    <label>Chauffage actuel</label>
                    <select className="select" value={chauffageActuel} onChange={(e) => setChauffageActuel(e.target.value as ChauffageActuel)}>
                      <option>Gaz</option>
                      <option>Fioul</option>
                      <option>Électricité</option>
                      <option>Poêle à granulés</option>
                      <option>Autre</option>
                    </select>
                  </div>
                </div>

                <div className="two">
                  <div className="field">
                    <label>Alimentation</label>
                    <select className="select" value={alimentation} onChange={(e) => setAlimentation(e.target.value as Alimentation)}>
                      <option>Monophasé</option>
                      <option>Triphasé</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Émetteurs</label>
                    <select className="select" value={emetteurs} onChange={(e) => setEmetteurs(e.target.value as Emetteurs)}>
                      <option>Radiateurs</option>
                      <option>Plancher chauffant</option>
                      <option>Autre</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Type de radiateurs</label>
                  <select className="select" value={typeRadiateurs} onChange={(e) => setTypeRadiateurs(e.target.value as TypeRadiateurs)}>
                    <option>Fonte</option>
                    <option>Aluminium</option>
                    <option>Mixte</option>
                    <option>Inconnu</option>
                  </select>
                </div>

                <div className="sep" />

                <div className="field">
                  <label>Consommation (montant payé)</label>
                  <div className="two">
                    <select className="select" value={consoMode} onChange={(e) => setConsoMode(e.target.value as any)}>
                      <option>€/mois</option>
                      <option>€/an</option>
                    </select>
                    <input
                      className="input"
                      type="number"
                      value={consoMontant}
                      onChange={(e) => setConsoMontant(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                  <div className="muted small">
                    Estimation : {euros(consoMensuelle)} / mois • {euros(eurM2Mois)} / m² / mois
                  </div>
                </div>

                {phraseSurconso}
              </div>
            </div>

            {/* Col droite : Reco + aides */}
            <div className="stack">
              <div className="card">
                <div className="cardHeader">
                  <div className="h2">Recommandation technique</div>
                  <span className="pill ok">OK</span>
                </div>

                <div className="reco">
                  <div className="recoK">Puissance préconisée</div>
                  <div className="recoKW">{puissanceReco} kW</div>
                  <div className="recoS">
                    Système préconisé : <b>Pompe à chaleur Air/Eau</b> + <b>Ballon thermodynamique</b>
                  </div>

                  <div className="recoHint">
                    {modeClient ? (
                      <>Synthèse non contractuelle. La validation finale se fait après visite et contrôle technique.</>
                    ) : (
                      <>
                        <b>(Interne)</b> Ajustements automatiques appliqués si nécessaire (sans affichage client).
                      </>
                    )}
                  </div>
                </div>

                <div className="muted small" style={{ marginTop: 10 }}>
                  ⚠️ Outil d’estimation : les montants (aides/financement) sont indicatifs et soumis à validation.
                </div>
              </div>

              <div className="card">
                <div className="cardHeader">
                  <div className="h2">Aides & financement (interne)</div>
                  <span className="pill">EDF / Prime Rénov</span>
                </div>

                <div className="fields">
                  <div className="field no-print">
                    <label>Profil aides</label>
                    <select className="select" value={profilAides} onChange={(e) => setProfilAides(e.target.value as ProfilAides)}>
                      <option>Grand précaire</option>
                      <option>Modeste</option>
                      <option>Violet</option>
                      <option>Classique</option>
                    </select>
                  </div>

                  {!modeClient ? (
                    <>
                      <div className="two">
                        <div className="miniStat">
                          <div className="miniLabel">Prix installation (base)</div>
                          <div className="miniValue">{euros(PRIX_BASE_PAC_BTD)}</div>
                        </div>
                        <div className="miniStat">
                          <div className="miniLabel">Aides estimées (total)</div>
                          <div className="miniValue">{euros(aides.total)}</div>
                        </div>
                      </div>

                      <div className="two">
                        <div className="miniStat">
                          <div className="miniLabel">Coût financé estimé</div>
                          <div className="miniValue">{euros(montantFinance.net)}</div>
                        </div>
                        <div className="miniStat">
                          <div className="miniLabel">Mensualité (TAEG {TAUX_TAEG}%, {DUREE_MOIS} mois)</div>
                          <div className="miniValue">{euros(mensualite)} / mois</div>
                        </div>
                      </div>

                      <div className="note">
                        Important : la surcharge technique éventuelle est intégrée automatiquement (sans l’afficher au client).
                      </div>
                    </>
                  ) : (
                    <div className="badge info">
                      Le dossier client exporté ne contient pas de prix.  
                      Le financement et les aides sont traités en interne.
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="cardHeader">
                  <div className="h2">Résumé rapide (client)</div>
                  <span className="pill">PDF</span>
                </div>
                <div className="summary">
                  <div><b>Client :</b> {nom || "—"}</div>
                  <div><b>Adresse :</b> {adresse || "—"}</div>
                  <div><b>Logement :</b> {surface || 0} m² • Chauffage actuel : {chauffageActuel}</div>
                  <div><b>Préconisation :</b> PAC Air/Eau + BTD • {puissanceReco} kW</div>
                  {estSurconso ? (
                    <div className="muted" style={{ marginTop: 6 }}>
                      Votre consommation semble supérieure à la moyenne : une optimisation du chauffage peut aider à réduire la dépense.
                    </div>
                  ) : (
                    <div className="muted" style={{ marginTop: 6 }}>
                      Estimation indicative : analyse affinée lors de la validation technique.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <EnergyMiniChart
              title={`${chauffageActuel === "Fioul" ? "Le fioul" : "Le gaz"} : une hausse structurelle`}
              subtitle="Même à consommation identique, la facture peut augmenter avec le temps."
              color={chauffageActuel === "Fioul" ? "#f97316" : "#ef4444"}
            />

            <div className="card">
              <div className="cardHeader">
                <div className="h2">Message technicien (léger / rassurant)</div>
                <span className="pill ok">Conseil</span>
              </div>
              <div className="note">
                Nous constatons souvent une hausse progressive des coûts d’énergie.  
                L’objectif de l’étude est de vérifier si une pompe à chaleur peut stabiliser votre budget et améliorer votre confort, selon la configuration de votre logement.
              </div>
            </div>
          </div>
        )}

        <div className="footer">
          <div>Easy Energies • 20 Rue Magellan, 94370 Sucy-en-Brie • 01 87 46 00 56</div>
          <div className="muted">Export PDF : sans prix • Document indicatif</div>
        </div>
      </div>
    </div>
  );
}
