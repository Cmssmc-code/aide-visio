(function (S) {
  'use strict';

  const SUBJECTS = [
    {
      id: 'stablecoins-genius-act',
      theme: 1,
      themeTitle: 'Finance',
      title: 'Stablecoins go mainstream: should banks be worried?',
      source: 'Practice text — inspired by the US and European financial press, 2026',
      date: 'October 2026',
      question: 'To what extent should traditional banks fear the rise of regulated stablecoins?',
      paragraphs: [
        "For years, stablecoins were treated as a curiosity of the crypto world: digital tokens pegged to the dollar, used mainly by traders to move money between exchanges. That era is over. Since the GENIUS Act was signed into law in July 2025, the United States has had its first federal framework for “payment stablecoins”, and the total value of these tokens in circulation has climbed above $300 billion. Large retailers, payment companies and even some banks are now preparing to issue their own.",
        "The law sets out clear rules. Issuers must hold at least one dollar of reserves for every token, in cash, bank deposits or short-term Treasury bills, and publish the composition of those reserves every month. They are banned from paying interest to holders, and the largest issuers fall under the supervision of federal regulators. Supporters argue that this finally gives the industry the legitimacy it lacked. “Clear rules attract serious players,” says the head of a payments start-up in San Francisco.",
        "Yet traditional banks are watching nervously. Their business model relies on cheap deposits, which they lend out to households and companies. If consumers and firms move part of their cash into stablecoins, banks could lose a stable source of funding. Some analysts estimate that hundreds of billions of dollars of deposits could leave the banking system over the next decade, pushing up funding costs and reducing credit to small businesses.",
        "Banks also point to a loophole. Although issuers cannot pay interest directly, the crypto exchanges that distribute the tokens can offer “rewards” to their customers. Lobbyists for the banking industry say this creates unfair competition with savings accounts, which must comply with far stricter capital and liquidity requirements.",
        "On the other side of the Atlantic, the European Union has chosen a more cautious path. Its MiCA regulation, fully applicable since the end of 2024, restricts the use of non-euro stablecoins for everyday payments and imposes strict reserve rules. The European Central Bank fears that dollar-based tokens could weaken the euro's international role, and it is pushing for a digital euro instead.",
        "Some bankers, however, see an opportunity rather than a threat. Several large lenders are testing “tokenised deposits”, which offer the speed of blockchain payments while remaining inside the regulated banking system. “The question is not whether money will become digital,” says a senior executive at a European bank. “It is who will control the rails.” Whoever wins that race could reshape global finance for decades."
      ],
      glossary: [
        { en: 'pegged to', fr: 'indexé sur, adossé à' },
        { en: 'Treasury bills', fr: 'bons du Trésor (dette publique à court terme)' },
        { en: 'loophole', fr: 'faille, vide juridique' },
        { en: 'lender', fr: 'prêteur, établissement de crédit' },
        { en: 'the rails', fr: 'les infrastructures (de paiement)' }
      ],
      corrige: {
        topic: 'The article deals with the rapid growth of stablecoins since the US GENIUS Act of July 2025 and asks whether these regulated digital dollars threaten the traditional banking model.',
        tone: 'Informative and balanced: the journalist gives voice to supporters, worried banks and European regulators, and ends on an open, slightly forward-looking note (“who will control the rails”).',
        summary: [
          'Stablecoins have moved from a niche crypto tool to a mainstream payment instrument, worth over $300 billion, thanks to the GENIUS Act.',
          'The law brings legitimacy through strict rules: 1:1 reserves, monthly disclosure, no interest, federal supervision.',
          'Banks fear an outflow of deposits, which would raise their funding costs and reduce lending to small firms.',
          'They also denounce a loophole: exchanges can pay “rewards”, creating unfair competition with savings accounts.',
          'The EU is more cautious with MiCA and promotes a digital euro to protect monetary sovereignty.',
          'Some banks respond by innovating with tokenised deposits: the real battle is about controlling payment infrastructure.'
        ],
        problematic: 'Are regulated stablecoins a real threat to the deposit-based model of banks, or an innovation that banks can absorb and turn to their advantage?',
        plan: [
          {
            title: 'A genuine threat to the banking model',
            points: [
              'Deposits are banks’ cheapest funding: an outflow would raise costs and reduce credit (fractional reserve logic).',
              'Regulatory asymmetry: stablecoin issuers do not face Basel III capital requirements, and the “rewards” loophole mimics interest.',
              'Network effects: big tech and retailers with millions of customers could capture payment flows and data.'
            ]
          },
          {
            title: 'But a threat that should not be overstated',
            points: [
              'Stablecoins cannot pay interest and offer no deposit insurance: savers still prefer insured bank accounts.',
              'Reserves are often held as bank deposits and Treasury bills: banks remain part of the ecosystem (custody, reserve management).',
              'Regulation (GENIUS Act, MiCA) limits risks and, in Europe, restricts dollar stablecoins.'
            ]
          },
          {
            title: 'An opportunity to modernise banking',
            points: [
              'Tokenised deposits and bank-issued stablecoins: banks can offer instant, programmable payments themselves.',
              'Partnerships and coopetition with fintechs and payment companies.',
              'Wider stakes: monetary sovereignty (digital euro) and who controls payment infrastructure.'
            ]
          }
        ],
        news: [
          'The GENIUS Act (July 2025) created the first US federal framework for payment stablecoins: 1:1 reserves and monthly disclosure.',
          'MiCA has been fully applicable in the EU since December 2024; the ECB is preparing a digital euro.',
          'The collapse of the algorithmic stablecoin TerraUSD in 2022 showed the risks of poorly backed tokens.'
        ],
        juryQuestions: [
          { en: 'Can you explain in simple words what a stablecoin is?', fr: 'Pouvez-vous expliquer simplement ce qu’est un stablecoin ?' },
          { en: 'Why are deposits so important for a bank’s business model?', fr: 'Pourquoi les dépôts sont-ils si importants pour le modèle d’une banque ?' },
          { en: 'What is the “loophole” the article mentions?', fr: 'Quelle est la « faille » mentionnée dans l’article ?' },
          { en: 'How does the European approach differ from the American one?', fr: 'En quoi l’approche européenne diffère-t-elle de l’approche américaine ?' },
          { en: 'Would you personally keep your savings in stablecoins? Why or why not?', fr: 'Placeriez-vous personnellement votre épargne en stablecoins ? Pourquoi ?' },
          { en: 'What happened when some stablecoins lost their peg in the past?', fr: 'Que s’est-il passé quand certains stablecoins ont perdu leur parité ?' },
          { en: 'Do you think a digital euro is a good idea?', fr: 'Pensez-vous qu’un euro numérique soit une bonne idée ?' },
          { en: 'What are tokenised deposits, and why do banks like them?', fr: 'Que sont les dépôts tokenisés et pourquoi plaisent-ils aux banques ?' },
          { en: 'Could stablecoins help companies with international payments?', fr: 'Les stablecoins pourraient-ils aider les entreprises pour les paiements internationaux ?' },
          { en: 'In your view, who should control payment infrastructure: banks, states or tech companies?', fr: 'Selon vous, qui devrait contrôler les infrastructures de paiement : banques, États ou entreprises tech ?' }
        ],
        keyVocab: [
          'stablecoin — cryptomonnaie stable',
          'reserves — réserves',
          'deposit outflow — fuite des dépôts',
          'funding costs — coûts de financement',
          'to issue (a token) — émettre',
          'issuer — émetteur',
          'liquidity requirements — exigences de liquidité',
          'supervision — contrôle prudentiel',
          'monetary sovereignty — souveraineté monétaire',
          'cross-border payments — paiements transfrontaliers'
        ]
      }
    },

    {
      id: 'ai-audit-big-four',
      theme: 2,
      themeTitle: 'Accounting & auditing',
      title: 'Robots in the audit room: AI shakes up the Big Four',
      source: 'Practice text — inspired by the British business press, 2026',
      date: 'September 2026',
      question: 'Do you think artificial intelligence will make auditors more reliable or simply less necessary?',
      paragraphs: [
        "Every busy season, armies of young graduates spend long nights checking invoices, matching bank statements and testing samples of transactions. For the Big Four accounting firms — Deloitte, PwC, EY and KPMG — this repetitive work has long been the entry point into the profession. Artificial intelligence is now changing that model faster than many partners expected.",
        "All four firms have announced investments worth billions of dollars in AI tools over the past three years. Instead of testing a small sample, software can now analyse every single transaction of a client, flag unusual payments and draft parts of the audit file. “We used to look at 60 invoices out of 100,000; now the machine reads all of them and tells us which ten deserve a human eye,” explains an audit manager in London.",
        "The impact on jobs is already visible. Several firms have reduced graduate recruitment in the UK and the US, and some have lowered their audit fees in competitive tenders, arguing that automation cuts costs. Critics fear that if juniors no longer perform the basic tasks, they will never develop the professional judgement they will need as partners ten years later.",
        "Regulators are also cautious. Audit watchdogs have warned that firms do not always monitor how AI tools affect audit quality. An algorithm may detect anomalies, but it cannot ask a chief financial officer an awkward question, nor assess whether management is under pressure to hit its targets. Recent scandals, from Wirecard in Germany to the collapse of large construction groups in Britain, were not caused by a lack of data but by a lack of professional scepticism.",
        "There is also a question of trust. If an AI tool makes a mistake, who is responsible: the software provider, the audit firm or the partner who signs the opinion? Under current standards, the answer is clear — the auditor remains fully liable. That is why firms insist that AI is an assistant, not a replacement.",
        "Supporters believe the technology could finally fix the audit's reputation problem. By saving time on routine checks, auditors could focus on high-risk areas such as revenue recognition, goodwill or accounting estimates. “AI will not replace auditors,” one partner says, “but auditors who use AI will replace those who don't.” Whether the profession can still attract and train the next generation remains, however, an open question."
      ],
      glossary: [
        { en: 'sample', fr: 'échantillon' },
        { en: 'competitive tender', fr: 'appel d’offres' },
        { en: 'audit watchdog', fr: 'autorité de contrôle de l’audit (en France : H2A, ex-H3C)' },
        { en: 'to sign the opinion', fr: 'signer le rapport (l’opinion) d’audit' },
        { en: 'goodwill', fr: 'écart d’acquisition' },
        { en: 'revenue recognition', fr: 'comptabilisation du chiffre d’affaires' }
      ],
      corrige: {
        topic: 'The article examines how artificial intelligence is transforming audit work in the Big Four, and what this means for jobs, audit quality and the training of future auditors.',
        tone: 'Analytical and nuanced, slightly sceptical: the author reports the firms’ enthusiasm but gives a lot of space to critics and regulators, and ends with an open question about the profession’s future.',
        summary: [
          'The Big Four are investing billions in AI, which can now analyse 100% of transactions instead of samples.',
          'This reduces repetitive work, leading to fewer graduate hires and lower audit fees.',
          'Critics fear juniors will no longer learn the professional judgement they need to become partners.',
          'Regulators warn that AI does not replace professional scepticism: past scandals were due to a lack of judgement, not data.',
          'Legal responsibility remains with the auditor, so AI is presented as an assistant.',
          'Supporters think AI can refocus audit on high-risk areas, but attracting talent remains a challenge.'
        ],
        problematic: 'Will AI strengthen audit quality by freeing auditors for judgement-based work, or will it weaken the profession by replacing the very tasks through which auditors are trained?',
        plan: [
          {
            title: 'AI can make audits more reliable',
            points: [
              'Full-population testing instead of sampling: better detection of anomalies and fraud.',
              'Time saved on routine checks can be spent on high-risk areas (revenue, goodwill impairment, estimates).',
              'Faster, cheaper audits: possible benefit for mid-sized companies and audit market competition.'
            ]
          },
          {
            title: 'But AI cannot replace human judgement',
            points: [
              'Professional scepticism, interviews with management and ethical judgement remain human (Wirecard example).',
              'Risks: “black box” algorithms, errors, over-reliance on tools; liability stays with the signing auditor.',
              'Training gap: if juniors skip basic tasks, where will future partners learn the job?'
            ]
          },
          {
            title: 'Towards a new auditor profile',
            points: [
              'Hybrid skills: accounting + data analytics + IT audit (cybersecurity, ERP controls).',
              'Regulators and standard-setters must update standards on the use of technology in audit.',
              'Opportunity to rebuild trust in audit and to make the profession more attractive.'
            ]
          }
        ],
        news: [
          'In 2025 the UK Financial Reporting Council warned that the largest audit firms were not formally monitoring the impact of AI on audit quality.',
          'Several Big Four firms reduced graduate intakes in 2024-2025, partly citing automation.',
          'The Wirecard scandal (2020): €1.9 billion of cash that did not exist, a major failure of the auditor.'
        ],
        juryQuestions: [
          { en: 'What kind of tasks can AI already do in an audit, according to the text?', fr: 'Quelles tâches l’IA peut-elle déjà faire dans un audit, selon le texte ?' },
          { en: 'What is the difference between testing a sample and testing the whole population?', fr: 'Quelle différence entre tester un échantillon et tester toute la population ?' },
          { en: 'What does “professional scepticism” mean for you?', fr: 'Que signifie pour vous le « scepticisme professionnel » ?' },
          { en: 'Who is legally responsible if an AI tool misses a fraud?', fr: 'Qui est juridiquement responsable si un outil d’IA rate une fraude ?' },
          { en: 'Can you tell us more about the Wirecard case?', fr: 'Pouvez-vous nous en dire plus sur l’affaire Wirecard ?' },
          { en: 'Why are fewer graduates recruited, and is it a problem?', fr: 'Pourquoi recrute-t-on moins de jeunes diplômés, et est-ce un problème ?' },
          { en: 'How do you use digital tools or AI in your own work?', fr: 'Comment utilisez-vous les outils numériques ou l’IA dans votre propre travail ?' },
          { en: 'What skills will auditors need in ten years?', fr: 'De quelles compétences les auditeurs auront-ils besoin dans dix ans ?' },
          { en: 'Is the dominance of the Big Four a problem for the audit market?', fr: 'La domination des Big Four est-elle un problème pour le marché de l’audit ?' },
          { en: 'Would you trust a financial statement audited mainly by a machine?', fr: 'Feriez-vous confiance à des comptes audités principalement par une machine ?' }
        ],
        keyVocab: [
          'audit firm — cabinet d’audit',
          'partner — associé',
          'graduate — jeune diplômé',
          'invoice — facture',
          'bank statement — relevé bancaire',
          'to flag — signaler',
          'audit fees — honoraires d’audit',
          'liable — responsable (juridiquement)',
          'judgement — jugement',
          'fraud detection — détection de la fraude',
          'chief financial officer (CFO) — directeur financier'
        ]
      }
    },

    {
      id: 'omnibus-csrd-retreat',
      theme: 3,
      themeTitle: 'Governance & CSR',
      title: "Europe's green reporting rules: simplification or retreat?",
      source: 'Practice text — inspired by the European business press, 2026',
      date: 'April 2026',
      question: "To what extent does the EU's Omnibus package mark a step back for corporate social responsibility?",
      paragraphs: [
        "When the Corporate Sustainability Reporting Directive (CSRD) was adopted in 2022, Brussels presented it as a revolution: around 50,000 European companies would have to publish detailed information on their environmental and social impact, checked by auditors like their financial accounts, using common European standards. Less than four years later, that ambition has been sharply reduced, and the debate over what Europe really expects from its companies has been reopened.",
        "The “Omnibus I” package, published as Directive (EU) 2026/470 and in force since 18 March 2026, limits sustainability reporting to companies with more than 1,000 employees and a net turnover above €450 million. The due diligence directive (CSDDD), which obliges firms to identify human rights and environmental abuses in their supply chains, now applies only to groups with more than 5,000 employees and €1.5 billion in turnover. About nine out of ten companies originally concerned are now out of scope.",
        "For business organisations, this is simple common sense. European firms, they argue, were drowning in paperwork while their American and Chinese competitors faced no similar obligations. A high-profile report on European competitiveness had already warned in 2024 that excessive regulation was holding back growth. “We support sustainability, not bureaucracy,” says the head of a French employers' federation.",
        "Small and medium-sized enterprises are relieved too. Many had started hiring consultants and buying software to measure their carbon footprint, sometimes spending more than €100,000 a year. Under the new rules, large clients will also be limited in the amount of information they can demand from their smaller suppliers.",
        "Environmental groups and many investors see things differently. They argue that reliable, comparable data is essential to fight greenwashing and to channel capital towards the energy transition. Some companies that had already invested heavily in reporting feel penalised for having moved early. The removal of the obligation to adopt climate transition plans under the due diligence directive has been particularly criticised.",
        "Some experts believe the debate is less about ethics than about strategy. Large companies will keep reporting, investors will keep asking questions, and many smaller firms may continue voluntarily because their customers and banks expect it. “Regulation was never the only driver of CSR,” notes a governance professor in Paris. “The real test is whether companies keep their commitments now that the law no longer forces them to.”"
      ],
      glossary: [
        { en: 'turnover', fr: 'chiffre d’affaires' },
        { en: 'due diligence', fr: 'devoir de vigilance' },
        { en: 'out of scope', fr: 'hors du champ d’application' },
        { en: 'paperwork', fr: 'formalités administratives, paperasse' },
        { en: 'greenwashing', fr: 'écoblanchiment' },
        { en: 'transition plan', fr: 'plan de transition (climatique)' }
      ],
      corrige: {
        topic: 'The article analyses the EU’s Omnibus I package, which drastically reduces the scope of the CSRD and CSDDD, and asks whether this simplification is a retreat from corporate social responsibility.',
        tone: 'Balanced and argumentative: the journalist presents the views of business, SMEs, NGOs and investors in turn, then adopts a slightly critical but open stance through the final quotation.',
        summary: [
          'The CSRD was meant to cover about 50,000 companies; Omnibus I (in force since 18 March 2026) has sharply narrowed it.',
          'Reporting now concerns firms with over 1,000 employees and €450m turnover; due diligence only groups with over 5,000 employees and €1.5bn: about 90% of companies are out of scope.',
          'Business groups welcome the cut in red tape, in the name of competitiveness against the US and China.',
          'SMEs are relieved, all the more as large clients can no longer demand unlimited data from suppliers.',
          'NGOs and investors fear less reliable data, more greenwashing, and criticise the removal of climate transition plans.',
          'The real test is whether companies keep their CSR commitments voluntarily, under pressure from markets and stakeholders.'
        ],
        problematic: 'Is the Omnibus package a necessary simplification that protects European competitiveness, or a retreat that weakens the credibility of corporate social responsibility in Europe?',
        plan: [
          {
            title: 'A legitimate simplification',
            points: [
              'Compliance costs and administrative burden, especially for SMEs (reporting standards with hundreds of data points).',
              'Competitiveness gap with the US and China (Draghi report, 2024).',
              'Large companies, which have the biggest impact, are still covered.'
            ]
          },
          {
            title: 'A real step back for CSR',
            points: [
              'Less comparable data: harder for investors to allocate capital and to detect greenwashing.',
              'Loss of credibility of EU leadership on sustainability; first movers penalised (legal uncertainty).',
              'Weaker due diligence: supply chain abuses (Rana Plaza, 2013) and climate transition plans dropped.'
            ]
          },
          {
            title: 'CSR does not depend on regulation alone',
            points: [
              'Stakeholder pressure: investors, banks, customers, employees (stakeholder theory vs shareholder primacy).',
              'Voluntary standards (ISO 26000, VSME standard) and French rules (duty of vigilance law, 2017).',
              'CSR as a strategic advantage: talent attraction, access to green finance, brand image.'
            ]
          }
        ],
        news: [
          'Directive (EU) 2026/470 (Omnibus I) has been in force since 18 March 2026.',
          'The 2024 Draghi report on EU competitiveness called for less regulatory burden.',
          'In the US, the SEC abandoned the defence of its climate disclosure rule in 2025, showing a global slowdown of ESG regulation.'
        ],
        juryQuestions: [
          { en: 'What is the CSRD, and what did it originally require?', fr: 'Qu’est-ce que la CSRD et qu’exigeait-elle au départ ?' },
          { en: 'What is the difference between the CSRD and the CSDDD?', fr: 'Quelle différence entre la CSRD et la CSDDD ?' },
          { en: 'Why do business organisations support the Omnibus package?', fr: 'Pourquoi les organisations patronales soutiennent-elles l’Omnibus ?' },
          { en: 'What is greenwashing? Can you give an example?', fr: 'Qu’est-ce que l’écoblanchiment ? Pouvez-vous donner un exemple ?' },
          { en: 'Who are the main stakeholders of a company?', fr: 'Quelles sont les principales parties prenantes d’une entreprise ?' },
          { en: 'Is CSR a cost or an investment for a company?', fr: 'La RSE est-elle un coût ou un investissement pour une entreprise ?' },
          { en: 'Does your company, or a company you know, publish a sustainability report?', fr: 'Votre entreprise, ou une entreprise que vous connaissez, publie-t-elle un rapport de durabilité ?' },
          { en: 'Should Europe follow the US and reduce ESG rules to stay competitive?', fr: 'L’Europe doit-elle suivre les États-Unis et réduire les règles ESG pour rester compétitive ?' },
          { en: 'What role can auditors play in sustainability reporting?', fr: 'Quel rôle les auditeurs peuvent-ils jouer dans le reporting de durabilité ?' },
          { en: 'Do you agree that “regulation was never the only driver of CSR”?', fr: 'Êtes-vous d’accord pour dire que « la réglementation n’a jamais été le seul moteur de la RSE » ?' }
        ],
        keyVocab: [
          'sustainability reporting — reporting de durabilité',
          'disclosure — publication d’informations',
          'threshold — seuil',
          'stakeholder — partie prenante',
          'compliance — conformité',
          'red tape — bureaucratie',
          'carbon footprint — empreinte carbone',
          'supply chain — chaîne d’approvisionnement',
          'commitment — engagement',
          'to water down — édulcorer, affaiblir',
          'level playing field — conditions de concurrence équitables'
        ]
      }
    },

    {
      id: 'ai-bubble-boom',
      theme: 4,
      themeTitle: 'Information systems & new technologies',
      title: 'Is artificial intelligence the new dot-com bubble?',
      source: 'Practice text — inspired by the American financial press, 2026',
      date: 'March 2026',
      question: 'Do you think the current boom in artificial intelligence investment is sustainable?',
      paragraphs: [
        "Never before have companies spent so much, so fast, on a single technology. In 2025 the largest American tech groups invested around $400 billion in data centres, chips and energy to power artificial intelligence, and they plan to spend even more in 2026. The so-called “Magnificent Seven” — Apple, Microsoft, Alphabet, Amazon, Meta, Nvidia and Tesla — now account for roughly a third of the value of the S&P 500 index.",
        "For enthusiasts, this is only the beginning. AI assistants are already writing code, answering customer queries and summarising legal documents. Banks use them to detect fraud, and manufacturers to predict when machines will break down. In October 2025, chipmaker Nvidia became the first company in history to be valued at more than $5 trillion. “This is the biggest platform shift since the internet,” argues a Silicon Valley investor.",
        "Sceptics, however, see worrying similarities with the dot-com bubble of 2000. Revenues from AI services remain small compared with the money invested, and a widely cited study in 2025 suggested that most corporate AI pilot projects had not yet produced any measurable financial return. Several analysts also point to “circular” deals, in which chipmakers invest in AI start-ups that then use the money to buy their chips.",
        "The debt dimension is new. While the giants finance most of their spending from their own profits, smaller players and data-centre developers increasingly rely on bonds and private credit. If demand for computing power were to slow down, lenders could be left with expensive buildings full of rapidly ageing equipment.",
        "There is also a human question. Companies hope AI will boost productivity, but employees fear for their jobs, particularly in entry-level office roles. Some firms have already justified job cuts by citing automation, while others report that their staff do not trust the tools and use them only occasionally. Training, data quality and cybersecurity have turned out to be far more difficult than the marketing promised.",
        "Even if valuations fall, history suggests that the technology itself may survive. After the dot-com crash, many investors lost fortunes, but the internet went on to transform the economy. “A bubble and a revolution are not mutually exclusive,” notes a London-based economist. The real question for businesses is not whether AI matters, but who will capture its value — and when."
      ],
      glossary: [
        { en: 'data centre', fr: 'centre de données' },
        { en: 'the dot-com bubble', fr: 'la bulle Internet (2000)' },
        { en: 'pilot project', fr: 'projet pilote, expérimentation' },
        { en: 'private credit', fr: 'dette privée (prêts hors banques et marchés)' },
        { en: 'valuation', fr: 'valorisation' }
      ],
      corrige: {
        topic: 'The article questions whether the massive investment in artificial intelligence by big tech companies is a lasting revolution or a speculative bubble comparable to the dot-com crash of 2000.',
        tone: 'Neutral and analytical, with a cautious undertone: the journalist balances enthusiastic and sceptical views, uses figures and historical comparison, and concludes that bubble and revolution can coexist.',
        summary: [
          'Big tech invested about $400bn in AI infrastructure in 2025 and the “Magnificent Seven” weigh about a third of the S&P 500.',
          'Enthusiasts see a historic platform shift, illustrated by Nvidia’s $5 trillion valuation.',
          'Sceptics stress the gap between investment and revenues, disappointing pilot projects and “circular” deals, as in 2000.',
          'A new risk: part of the boom is financed by debt (bonds, private credit), which could hurt lenders if demand slows.',
          'Employees fear for entry-level jobs while adoption and trust remain uneven.',
          'History suggests the technology may survive a crash: the key issue is who will capture the value.'
        ],
        problematic: 'Is the AI investment boom grounded in real economic value, or is it a speculative bubble that could burst and damage investors, lenders and employees?',
        plan: [
          {
            title: 'Signs of a bubble',
            points: [
              'Valuations far ahead of revenues; market concentration in a few stocks (Magnificent Seven).',
              'Circular financing and growing use of debt: risk of contagion to credit markets.',
              'Limited returns on corporate AI projects so far; parallels with 2000 (overinvestment in fibre networks).'
            ]
          },
          {
            title: 'Real foundations for a lasting transformation',
            points: [
              'Concrete uses: coding, customer service, document analysis, audit and accounting.',
              'Unlike in 2000, the leaders are highly profitable and finance most investment with cash flow.',
              'Productivity gains may take time to appear (the “productivity paradox” of IT in the 1980s-90s).'
            ]
          },
          {
            title: 'Conditions for a sustainable boom',
            points: [
              'Return on investment: firms must move from pilots to real business processes (ERP integration, data quality).',
              'Managing human impact: reskilling, trust, internal communication.',
              'Regulation and constraints: EU AI Act, energy consumption, data protection, cybersecurity.'
            ]
          }
        ],
        news: [
          'Nvidia became the first company valued at over $5 trillion in October 2025.',
          'The EU AI Act entered into force in 2024, with obligations phased in from 2025 to 2027.',
          'Central banks and the IMF warned in late 2025 about the risk of a sharp correction in AI-related stocks.'
        ],
        juryQuestions: [
          { en: 'What exactly is a financial bubble?', fr: 'Qu’est-ce qu’une bulle financière exactement ?' },
          { en: 'Who are the “Magnificent Seven”, and why are they important?', fr: 'Qui sont les « Magnificent Seven » et pourquoi sont-ils importants ?' },
          { en: 'What does the author mean by “circular” deals?', fr: 'Que veut dire l’auteur par accords « circulaires » ?' },
          { en: 'What happened during the dot-com crash?', fr: 'Que s’est-il passé lors du krach de la bulle Internet ?' },
          { en: 'Why is the use of debt a new risk?', fr: 'Pourquoi le recours à la dette est-il un risque nouveau ?' },
          { en: 'Do you use AI tools at work? Do they really save you time?', fr: 'Utilisez-vous des outils d’IA au travail ? Vous font-ils vraiment gagner du temps ?' },
          { en: 'Which jobs are most threatened by AI, in your opinion?', fr: 'Quels métiers sont les plus menacés par l’IA, selon vous ?' },
          { en: 'What are the environmental consequences of data centres?', fr: 'Quelles sont les conséquences environnementales des centres de données ?' },
          { en: 'Should AI be more strictly regulated? How?', fr: 'L’IA devrait-elle être plus strictement encadrée ? Comment ?' },
          { en: 'If you were an investor, would you buy tech stocks today?', fr: 'Si vous étiez investisseuse, achèteriez-vous des actions tech aujourd’hui ?' }
        ],
        keyVocab: [
          'bubble — bulle',
          'to burst — éclater',
          'stock market — marché boursier',
          'market capitalisation — capitalisation boursière',
          'return on investment (ROI) — retour sur investissement',
          'capital expenditure (capex) — dépenses d’investissement',
          'speculation — spéculation',
          'productivity gains — gains de productivité',
          'computing power — puissance de calcul',
          'reskilling — reconversion, requalification',
          'hype — engouement excessif'
        ]
      }
    },

    {
      id: 'return-to-office-battle',
      theme: 5,
      themeTitle: 'Management, HR & strategy',
      title: 'Back to the office? The great return-to-office battle',
      source: 'Practice text — inspired by the international business press, 2026',
      date: 'June 2026',
      question: 'To what extent should companies force their employees to return to the office?',
      paragraphs: [
        "Six years after the pandemic emptied office towers, many employers have decided that enough is enough. Amazon has required its corporate staff to come in five days a week since January 2025, and banks such as JPMorgan Chase followed a few months later. In France, several large groups have reduced the number of remote-working days allowed in their company agreements.",
        "Executives give several reasons. They say that collaboration, innovation and company culture suffer when teams rarely meet in person, and that young employees learn their job by watching experienced colleagues. “You cannot build trust on a video call,” says the HR director of a European insurer. Some managers also admit, privately, that they find it difficult to supervise staff they never see.",
        "Employees, however, have grown used to flexibility. Surveys consistently show that hybrid work is one of the benefits they value most, sometimes as much as a pay rise. Long commutes, high housing costs in city centres and childcare constraints make a full return difficult, especially for parents and people with disabilities. Many also say they are more productive at home, where they face fewer interruptions.",
        "Research does not clearly support either side. A large experiment carried out at a Chinese travel company and published in 2024 found that allowing two days at home a week reduced resignations by a third without harming performance. Other studies suggest that fully remote teams can struggle with innovation and with the training of newcomers.",
        "Critics also suspect hidden motives. Some argue that strict office mandates are a discreet way to reduce headcount, since some staff will prefer to resign rather than return. Others point out that many companies have signed long and expensive office leases that they now need to justify. Trade unions warn that such policies may push out precisely the most talented employees, who can easily find a more flexible employer elsewhere.",
        "Between these positions, a growing number of firms are trying to redefine the purpose of the office: fewer desks, more meeting rooms, and “anchor days” when whole teams are present at the same time. “The question is no longer where people work,” says a management consultant, “but what they come to the office to do.” For HR departments, the challenge is to make the office worth the commute."
      ],
      glossary: [
        { en: 'company agreement', fr: 'accord d’entreprise' },
        { en: 'commute', fr: 'trajet domicile-travail' },
        { en: 'resignation', fr: 'démission' },
        { en: 'headcount', fr: 'effectifs' },
        { en: 'lease', fr: 'bail' },
        { en: 'anchor day', fr: 'jour de présence commun à toute l’équipe' }
      ],
      corrige: {
        topic: 'The article deals with the growing number of companies requiring employees to return to the office after the remote-working boom, and with the conflicting interests of managers and staff.',
        tone: 'Balanced and slightly critical of strict mandates: the author presents managers’ arguments, then employees’ views, research and suspected hidden motives, before suggesting a middle way.',
        summary: [
          'Several major employers (Amazon, JPMorgan, large French groups) are cutting remote work and imposing a full or larger return to the office.',
          'Managers invoke collaboration, culture, training of juniors and, less openly, control.',
          'Employees value flexibility as much as a pay rise; commuting, housing and childcare make a full return hard.',
          'Research is mixed: hybrid work reduces resignations without hurting performance, but full remote can harm innovation and onboarding.',
          'Critics suspect hidden motives: reducing headcount without layoffs, justifying office leases; unions fear losing talent.',
          'Many firms are redesigning the office as a place for collaboration, with “anchor days”.'
        ],
        problematic: 'Should companies impose a return to the office to protect collaboration and culture, or does flexibility better serve both performance and talent retention?',
        plan: [
          {
            title: 'Good reasons to bring employees back',
            points: [
              'Collaboration, informal exchanges and innovation (serendipity).',
              'Training and mentoring of juniors; building trust and corporate culture.',
              'Management and cohesion: avoiding isolation and a two-speed workforce.'
            ]
          },
          {
            title: 'The limits and risks of forced returns',
            points: [
              'Talent retention and employer brand: flexibility is a key benefit (risk of resignations of the best employees).',
              'Quality of life and inclusion: commuting time, parents, people with disabilities.',
              'Hidden motives (disguised downsizing, real estate costs) damage trust and social dialogue.'
            ]
          },
          {
            title: 'Towards a negotiated hybrid model',
            points: [
              'Redefining the purpose of the office: anchor days, collaborative spaces.',
              'Negotiating with unions and employees (company agreements in France, right to disconnect).',
              'Managing by objectives and trust rather than by presence; adapting to cultures and jobs.'
            ]
          }
        ],
        news: [
          'Amazon has required five days a week in the office since January 2025; JPMorgan Chase did the same in March 2025.',
          'A study published in Nature in 2024 (Trip.com) found that hybrid work cut resignations by a third.',
          'In France, telework is governed by the 2020 national inter-professional agreement and company agreements.'
        ],
        juryQuestions: [
          { en: 'Which companies are mentioned in the article, and what did they decide?', fr: 'Quelles entreprises sont citées et qu’ont-elles décidé ?' },
          { en: 'What are the main arguments of managers for a return to the office?', fr: 'Quels sont les principaux arguments des managers pour le retour au bureau ?' },
          { en: 'What did the Chinese experiment show?', fr: 'Qu’a montré l’expérience chinoise ?' },
          { en: 'What are the “hidden motives” the article refers to?', fr: 'Quels sont les « motifs cachés » dont parle l’article ?' },
          { en: 'How many days do you work from home, and how do you feel about it?', fr: 'Combien de jours télétravaillez-vous et qu’en pensez-vous ?' },
          { en: 'How can a manager build trust in a remote team?', fr: 'Comment un manager peut-il créer la confiance dans une équipe à distance ?' },
          { en: 'Is remote work fair for all employees, for example those who work in production?', fr: 'Le télétravail est-il équitable pour tous, par exemple ceux qui travaillent en production ?' },
          { en: 'What role should trade unions play in this debate?', fr: 'Quel rôle les syndicats doivent-ils jouer dans ce débat ?' },
          { en: 'Are there cultural differences between countries on this issue?', fr: 'Y a-t-il des différences culturelles entre pays sur ce sujet ?' },
          { en: 'If you were an HR director, what policy would you choose?', fr: 'Si vous étiez DRH, quelle politique choisiriez-vous ?' }
        ],
        keyVocab: [
          'remote work / teleworking — télétravail',
          'hybrid work — travail hybride',
          'return-to-office mandate — obligation de retour au bureau',
          'employee retention — fidélisation des salariés',
          'employer brand — marque employeur',
          'onboarding — intégration des nouveaux',
          'work-life balance — équilibre vie pro / vie perso',
          'trade union — syndicat',
          'layoff — licenciement',
          'to supervise — encadrer',
          'perk / benefit — avantage'
        ]
      }
    },

    {
      id: 'tariffs-supply-chains-reshoring',
      theme: 6,
      themeTitle: 'Production',
      title: 'After the tariff shock, supply chains rethink their routes',
      source: 'Practice text — inspired by the American and European business press, 2026',
      date: 'May 2026',
      question: 'Discuss the view that tariffs are an effective way to bring production back home.',
      paragraphs: [
        "For more than a year, American importers lived with constant uncertainty. Tariffs imposed under an emergency economic law were raised, suspended and renegotiated almost every month, forcing manufacturers to redesign their supply chains in a hurry. Then, on 20 February 2026, the US Supreme Court ruled by six votes to three in Learning Resources v. Trump that the International Emergency Economic Powers Act (IEEPA) did not allow the President to impose such duties.",
        "The decision opened the door to refunds that analysts estimate at between $142 billion and $170 billion. But relief was short-lived: the administration immediately introduced a temporary 10% tariff on most imports under a different legal basis, Section 122 of the Trade Act of 1974, which limits it to 150 days unless Congress extends it, while sector-specific duties on steel, aluminium and cars remained in place.",
        "For supply-chain managers, the lesson is clear: trade policy has become a permanent risk. “We no longer plan for the cheapest route, but for the most resilient one,” explains the operations director of a US furniture maker. Many firms have adopted a “China plus one” strategy, moving part of their production to Vietnam, India or Mexico while keeping key suppliers in Asia. Others have mapped their suppliers' own suppliers for the first time, to identify hidden dependencies.",
        "Reshoring to the United States itself has been more limited than politicians hoped. Several large projects have been announced, especially in semiconductors and pharmaceuticals, but building a factory takes years, and manufacturers complain of a shortage of skilled workers. Because labour costs are higher, new plants are often highly automated and create fewer jobs than expected.",
        "Tariffs have also had a cost. Companies that depend on imported components have seen their margins squeezed, and part of the extra cost has been passed on to consumers. Small businesses, which lack the bargaining power of large groups, have been hit hardest. Some economists argue that uncertainty itself — rather than the level of duties — has discouraged investment.",
        "European exporters are watching closely. Many have increased their inventories, diversified their logistics routes and, in some cases, opened assembly lines in the United States to stay close to their customers. “Tariffs can change in a week; a factory stays for thirty years,” notes a supply-chain consultant in Rotterdam. For most companies, the real goal is now flexibility rather than relocation."
      ],
      glossary: [
        { en: 'tariff / duty', fr: 'droit de douane' },
        { en: 'refund', fr: 'remboursement' },
        { en: 'reshoring', fr: 'relocalisation (dans le pays d’origine)' },
        { en: 'to squeeze (margins)', fr: 'comprimer (les marges)' },
        { en: 'bargaining power', fr: 'pouvoir de négociation' },
        { en: 'inventories', fr: 'stocks' }
      ],
      corrige: {
        topic: 'The article explains how US tariffs, partly struck down by the Supreme Court in February 2026, have pushed companies to redesign their supply chains, and questions whether tariffs actually bring production back to the US.',
        tone: 'Factual and explanatory, moderately sceptical about tariffs: the journalist reports legal and economic facts, quotes practitioners and stresses the limits and costs of protectionism.',
        summary: [
          'IEEPA tariffs created a year of uncertainty until the Supreme Court struck them down (6-3) on 20 February 2026.',
          'Refunds of $142-170bn are expected, but a temporary 10% global tariff (Section 122) and sector duties (steel, aluminium, cars) remain.',
          'Companies now favour resilience over cost, with “China plus one” strategies (Vietnam, India, Mexico).',
          'Reshoring to the US is limited: factories take years, skilled labour is scarce, and automation means few jobs.',
          'Tariffs squeeze margins, raise consumer prices, hurt small firms, and uncertainty discourages investment.',
          'European exporters build inventories, diversify routes and sometimes produce in the US: flexibility matters more than relocation.'
        ],
        problematic: 'Can tariffs really bring manufacturing back home, or do they mainly reshuffle supply chains towards other low-cost countries while raising costs and uncertainty?',
        plan: [
          {
            title: 'Tariffs can encourage some relocation',
            points: [
              'They raise the cost of imports and make domestic production more competitive.',
              'Announced projects in strategic sectors (semiconductors, pharmaceuticals), supported by subsidies.',
              'Political objective: economic sovereignty and security of supply after Covid-19 shortages.'
            ]
          },
          {
            title: 'But their effects on production are limited and costly',
            points: [
              'Trade diversion rather than reshoring: “China plus one” (Vietnam, Mexico).',
              'Structural obstacles: time to build plants, lack of skilled workers, automation.',
              'Costs: inflation for consumers, squeezed margins, retaliation, legal uncertainty (Supreme Court ruling).'
            ]
          },
          {
            title: 'Resilience depends on broader supply chain strategies',
            points: [
              'Diversifying suppliers, nearshoring, safety stocks (moving from “just in time” to “just in case”).',
              'Supply chain visibility through data and digital tools; risk mapping.',
              'Industrial policy and training (subsidies, skills) are more effective than tariffs alone; European example.'
            ]
          }
        ],
        news: [
          'On 20 February 2026 the US Supreme Court ruled 6-3 in Learning Resources v. Trump that IEEPA does not allow tariffs; refunds estimated at $142-170bn.',
          'The administration replaced them with a temporary 10% global tariff under Section 122 of the Trade Act of 1974.',
          'Sector tariffs under Section 232 (steel, aluminium, cars) were not affected by the ruling.'
        ],
        juryQuestions: [
          { en: 'What did the Supreme Court decide in February 2026, and why?', fr: 'Qu’a décidé la Cour suprême en février 2026, et pourquoi ?' },
          { en: 'What happened after the ruling? Did tariffs disappear?', fr: 'Que s’est-il passé après la décision ? Les droits de douane ont-ils disparu ?' },
          { en: 'What is a “China plus one” strategy?', fr: 'Qu’est-ce qu’une stratégie « Chine plus un » ?' },
          { en: 'What is the difference between reshoring, nearshoring and offshoring?', fr: 'Quelle différence entre relocalisation, nearshoring et délocalisation ?' },
          { en: 'Who really pays for tariffs?', fr: 'Qui paie réellement les droits de douane ?' },
          { en: 'Why does reshoring create fewer jobs than expected?', fr: 'Pourquoi la relocalisation crée-t-elle moins d’emplois que prévu ?' },
          { en: 'How did the Covid-19 crisis change the way companies manage their supply chains?', fr: 'Comment la crise du Covid-19 a-t-elle changé la gestion des chaînes d’approvisionnement ?' },
          { en: 'How should European companies react to American tariffs?', fr: 'Comment les entreprises européennes doivent-elles réagir aux droits de douane américains ?' },
          { en: 'Is protectionism compatible with environmental goals?', fr: 'Le protectionnisme est-il compatible avec les objectifs environnementaux ?' },
          { en: 'Should France and the EU use tariffs to protect their industry?', fr: 'La France et l’UE devraient-elles utiliser les droits de douane pour protéger leur industrie ?' }
        ],
        keyVocab: [
          'supply chain — chaîne d’approvisionnement',
          'supplier — fournisseur',
          'protectionism — protectionnisme',
          'trade war — guerre commerciale',
          'retaliation — représailles',
          'nearshoring — relocalisation de proximité',
          'resilience — résilience',
          'lead time — délai d’approvisionnement',
          'just in time — juste-à-temps (flux tendus)',
          'logistics — logistique',
          'to pass on (costs) — répercuter (les coûts)'
        ]
      }
    }
  ];

  S.examSubjects = (S.examSubjects || []).concat(SUBJECTS);
})(window.AideVisio = window.AideVisio || {});
