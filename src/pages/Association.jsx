import { useState } from 'react'
import { EnteteEcran, Pied } from '../components/Layout'
import Icone from '../components/Icones'
import { BUREAU, PARTENAIRES, PRESIDENCE } from '../lib/gouvernance'
import { ARTICLES, DOCUMENTS, IDENTITE, SIGNATAIRES } from '../lib/statuts'

// Présentation du conseil d'administration, de l'écosystème et des statuts de l'association
function Portrait({ personne, grand }) {
  const [manquante, setManquante] = useState(false)
  const ini = personne.nom.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className={`portrait${grand ? ' portrait--grand' : ''}`}>
      {manquante ? <span aria-hidden="true">{ini}</span> : (
        <img src={`/ca/${personne.id}.jpg`} alt={`Portrait de ${personne.nom}`} loading="lazy" onError={() => setManquante(true)} />
      )}
    </span>
  )
}

function Administrateur({ personne, encre }) {
  return (
    <article className={`carte${encre ? ' carte--encre' : ''} pile administrateur`}>
      <Portrait personne={personne} grand={encre} />
      <div className="pile pile--serre">
        <p className="etiquette">{personne.role}</p>
        <h3 className="titre-carte">{personne.nom}</h3>
        <p className="intertitre">{personne.pole}</p>
        <p className="secondaire">{personne.mission}</p>
      </div>
    </article>
  )
}

export default function Association() {
  return (
    <>
      <EnteteEcran etiquette="Spirit Of Centaure" titre="L'association."
        chapeau="Le conseil d'administration qui porte l'action de l'association, les partenaires avec lesquels il travaille et les statuts qui la fondent." />

      <section className="bande bande--neige">
        <div className="conteneur pile pile--large">
          <h2 className="titre-section">Conseil d'administration.</h2>
          <div className="grille-2">
            {PRESIDENCE.map((p) => <Administrateur key={p.id} personne={p} encre />)}
          </div>
          <div className="grille-2">
            {BUREAU.map((p) => <Administrateur key={p.id} personne={p} />)}
          </div>
        </div>
      </section>

      <section className="bande">
        <div className="conteneur pile pile--large">
          <div className="pile pile--serre">
            <h2 className="titre-section">Nos partenaires et conseils.</h2>
            <p className="chapeau">L'écosystème avec lequel l'association travaille au quotidien.</p>
          </div>
          <div className="grille-2">
            {PARTENAIRES.map((p) => (
              <article key={p.id} className="carte carte--neige pile pile--serre">
                <Icone nom={p.icone} taille={32} />
                <p className="etiquette" style={{ marginTop: 8 }}>{p.pole}</p>
                <h3 className="titre-carte">{p.nom}</h3>
                <p className="intertitre">{p.qualite}</p>
                <p className="secondaire">{p.mission}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bande bande--neige" id="statuts">
        <div className="conteneur pile pile--large">
          <div className="pile pile--serre">
            <h2 className="titre-section">Les statuts de l'association.</h2>
            <p className="chapeau">Adoptés le 20 mars 2025 et déclarés en préfecture le 10 avril 2025.</p>
          </div>
          <div className="grille-2">
            <article className="carte pile">
              <p className="etiquette">Identité</p>
              <dl className="meta-liste">
                {IDENTITE.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </article>
            <article className="carte pile pile--serre">
              <p className="etiquette">Documents officiels</p>
              <div className="liste">
                {DOCUMENTS.map((d) => (
                  <a key={d.fichier} href={d.fichier} target="_blank" rel="noopener" className="liste__el">
                    <Icone nom="document" />
                    <span className="liste__corps">
                      <span className="liste__titre" style={{ whiteSpace: 'normal' }}>{d.titre}</span>
                      <span className="liste__sous">{d.sous} · PDF</span>
                    </span>
                    <Icone nom="telecharger" taille={18} />
                  </a>
                ))}
              </div>
            </article>
          </div>
          <div className="carte pile pile--serre">
            {ARTICLES.map(([titre, alineas], i) => (
              <details key={titre} className="article-statuts">
                <summary><span className="etiquette">Article {i + 1}</span><span className="intertitre">{titre}</span></summary>
                <div className="pile pile--serre">
                  {alineas.map((a, j) => <p key={j}>{a}</p>)}
                </div>
              </details>
            ))}
            <p className="petit secondaire" style={{ marginTop: 12 }}>{SIGNATAIRES}</p>
          </div>
        </div>
      </section>
      <Pied />
    </>
  )
}
