(function (S) {
  'use strict';

  var subjects = [
    {
      id: 'influencers-personal-data',
      theme: 7,
      themeTitle: 'Marketing',
      title: 'The influencer economy runs into the privacy rulebook',
      source: 'Practice text — inspired by the business press on influencer marketing, 2026',
      date: 'March 2026',
      question: 'To what extent should brands be held responsible for the way influencers collect and use their followers\' personal data?',
      paragraphs: [
        "Influencer marketing has grown from a niche experiment into a global industry worth an estimated $35 billion a year. Cosmetics groups, sportswear makers and even banks now spend a growing share of their advertising budgets on creators who promote products to audiences of a few thousand or several million followers. For brands, the appeal is obvious: a recommendation from a trusted face feels more authentic than a television commercial.",
        "Yet the business model rests on something less visible than a smiling video: data. Behind every sponsored post, agencies and platforms track clicks, discount codes, comments and purchases. Some creators go further, running giveaways that require followers to share their email address, date of birth or even their shopping habits. This information is then passed on to partner brands, often without clear consent.",
        "Regulators have started to notice. In the European Union, the General Data Protection Regulation already requires a lawful basis and transparent information whenever personal data is collected, while the Digital Services Act forbids targeted advertising aimed at minors. France went further in 2023 with a dedicated law on commercial influence, which obliges creators to label sponsored content and bans the promotion of certain risky products.",
        "\"Many brands still behave as if the influencer were a separate company and the data problem were not theirs,\" says a consumer-law specialist at a London firm. \"But when a campaign is designed, briefed and paid for by a brand, regulators increasingly consider that the brand shares responsibility for what happens to the data.\"",
        "Marketers argue that they cannot police thousands of independent creators. Contracts typically include a clause requiring compliance with privacy rules, but checks are rare. A survey of European marketing directors published last year found that fewer than one in three had ever audited how a partner influencer collected follower information.",
        "The stakes are rising. Young audiences, who make up the core of many creators' communities, are particularly exposed, and consumer associations have filed complaints against several fashion and gaming campaigns. At the same time, the decline of third-party cookies — blocked by Safari and Firefox and limited by consent rules, although Google decided to keep them in Chrome — has made first-party data — collected directly from consumers — more valuable than ever, encouraging brands to look for new ways to gather it.",
        "Some companies are choosing transparency as a selling point, publishing the list of creators they work with and limiting data collection to what is strictly necessary. Whether this becomes the norm, or whether regulators will have to impose it, remains an open question."
      ],
      glossary: [
        { en: 'creator', fr: 'créateur de contenu, influenceur' },
        { en: 'giveaway', fr: 'jeu-concours (cadeau à gagner)' },
        { en: 'lawful basis', fr: 'base légale (d\'un traitement de données)' },
        { en: 'to police', fr: 'contrôler, surveiller' },
        { en: 'first-party data', fr: 'données propriétaires (collectées directement par l\'entreprise)' }
      ],
      corrige: {
        topic: 'The article deals with the growing use of influencers by brands and the personal data that influencer campaigns collect, raising the question of who is responsible when privacy rules are broken.',
        tone: 'Informative and slightly critical: the journalist gives figures and legal facts, but the choice of quotes and the closing open question suggest that brands are not doing enough.',
        summary: [
          'Influencer marketing has become a huge industry because consumers trust creators more than traditional ads.',
          'Behind sponsored posts, a large amount of personal data is collected and shared with brands, often without clear consent.',
          'EU and French law (GDPR, DSA, the 2023 influencer law) already set limits, and regulators see brands as co-responsible.',
          'Brands say they cannot control thousands of creators; contractual clauses exist but audits are rare.',
          'Young audiences are especially at risk, while the decline of third-party cookies makes first-party data more attractive.',
          'A few firms use transparency as a selling point, but it is unclear whether this will spread voluntarily.'
        ],
        problematic: 'Should the brand, which designs and pays for a campaign, bear the legal and ethical responsibility for data collected by influencers, or is it unrealistic to make it police independent creators?',
        plan: [
          {
            title: 'Why brands should be held responsible',
            points: [
              'The brand is the client and the final user of the data: it benefits, so it should be accountable (logic of joint controllership under GDPR).',
              'Reputation risk: a privacy scandal damages the brand, not only the creator.',
              'Protection of minors and vulnerable consumers requires a clear, solvent party.'
            ]
          },
          {
            title: 'The limits of brand responsibility',
            points: [
              'Thousands of micro-influencers: control is costly, especially for SMEs.',
              'Creators are independent businesses and must also be accountable; platforms (Instagram, TikTok) control most of the data.',
              'Too much liability could push brands back to opaque intermediaries.'
            ]
          },
          {
            title: 'Towards shared responsibility',
            points: [
              'Clear contracts, data-minimisation clauses and regular audits.',
              'Certification of creators, training, industry codes of conduct.',
              'Transparency as a competitive advantage and a trust-building tool.'
            ]
          }
        ],
        news: [
          'The EU Digital Services Act bans targeted advertising to minors on large platforms.',
          'France\'s 2023 law on commercial influence requires sponsored content to be clearly labelled.',
          'The decline of third-party cookies (blocked by Safari and Firefox, limited by consent rules, although Google kept them in Chrome) has pushed companies to build their own first-party data.'
        ],
        juryQuestions: [
          { en: 'Can you explain what the author means by "first-party data"?', fr: 'Pouvez-vous expliquer ce que l\'auteur entend par « first-party data » ?' },
          { en: 'Why do brands find influencers more attractive than traditional advertising?', fr: 'Pourquoi les marques trouvent-elles les influenceurs plus attractifs que la publicité classique ?' },
          { en: 'Who is quoted in the article, and why is that quote important?', fr: 'Qui est cité dans l\'article et pourquoi cette citation est-elle importante ?' },
          { en: 'You said brands should audit creators. Isn\'t that too expensive for small companies?', fr: 'Vous dites que les marques devraient auditer les créateurs. N\'est-ce pas trop coûteux pour les petites entreprises ?' },
          { en: 'What role should platforms like TikTok or Instagram play?', fr: 'Quel rôle devraient jouer les plateformes comme TikTok ou Instagram ?' },
          { en: 'Do you follow influencers yourself? Do you trust their recommendations?', fr: 'Suivez-vous vous-même des influenceurs ? Faites-vous confiance à leurs recommandations ?' },
          { en: 'Is European regulation an obstacle to innovation in marketing?', fr: 'La réglementation européenne est-elle un frein à l\'innovation marketing ?' },
          { en: 'How could artificial intelligence change influencer marketing in the coming years?', fr: 'Comment l\'intelligence artificielle pourrait-elle transformer le marketing d\'influence dans les années à venir ?' },
          { en: 'If you were a marketing director, what would you put in a contract with an influencer?', fr: 'Si vous étiez directrice marketing, que mettriez-vous dans un contrat avec un influenceur ?' }
        ],
        keyVocab: [
          'sponsored content — contenu sponsorisé',
          'follower — abonné',
          'consent — consentement',
          'data protection — protection des données',
          'to be held liable — être tenu responsable',
          'campaign — campagne',
          'brand awareness — notoriété de la marque',
          'audit — contrôle, audit',
          'target audience — cible',
          'trust — confiance',
          'minors — mineurs'
        ]
      }
    },

    {
      id: 'brand-activism-boycott',
      theme: 7,
      themeTitle: 'Marketing',
      title: 'When taking a stand costs sales: the new risks of brand activism',
      source: 'Practice text — inspired by the business press on brand activism and consumer boycotts, 2026',
      date: 'January 2026',
      question: 'Should brands take public positions on social and political issues?',
      paragraphs: [
        "For much of the last decade, marketing experts gave companies the same advice: stand for something. Surveys showed that younger consumers, in particular, expected brands to speak out on climate change, diversity or human rights, and many firms responded with campaigns that went far beyond the qualities of their products.",
        "The mood has changed. In 2023, a single sponsored post by a transgender influencer for an American beer brand triggered a boycott that cost the brand its position as the best-selling beer in the United States. Since then, several retailers and consumer-goods groups have quietly scaled back their diversity programmes or dropped campaigns that might be seen as political. Advertising agencies report that clients now ask for \"risk assessments\" before any campaign touching on social issues, a practice almost unknown five years ago.",
        "Boycotts now come from both sides of the political spectrum. Some consumers punish brands for being too progressive; others turn away from companies whose leaders are associated with controversial political figures. In 2025, an electric-car maker saw its European registrations fall sharply as customers reacted to its chief executive's political involvement. In France, calls to boycott American products also spread online after the trade tensions of the same year, even if their real effect on sales was limited.",
        "\"The problem is not taking a stand, it is taking a stand that the company cannot defend,\" argues a brand strategist based in New York. \"Consumers can tell the difference between a value that is embedded in the business and a slogan invented for a campaign.\" Critics call the latter \"woke-washing\", by analogy with greenwashing.",
        "Researchers point out that the impact of boycotts is often short-lived. Sales typically recover within months, unless the controversy touches the core identity of the brand. Yet in a world of social networks, where a video can reach millions of people in a few hours, few marketing directors are willing to take the risk.",
        "Silence, however, is not neutral either. Employees, especially younger ones, increasingly expect their employer to share their values, and investors focused on environmental, social and governance criteria ask for consistency between public statements and actual practices. A company that says nothing may be accused of indifference.",
        "As a result, many brands are adopting what consultants call \"quiet activism\": fewer loud campaigns, more concrete action on issues directly linked to their activity, such as packaging, working conditions or local communities. Whether consumers will reward this discretion remains to be seen."
      ],
      glossary: [
        { en: 'to take a stand', fr: 'prendre position' },
        { en: 'to scale back', fr: 'réduire, revoir à la baisse' },
        { en: 'registrations', fr: 'immatriculations' },
        { en: 'woke-washing', fr: 'engagement de façade sur des causes sociales' },
        { en: 'short-lived', fr: 'de courte durée, éphémère' }
      ],
      corrige: {
        topic: 'The article examines brand activism, i.e. companies taking positions on social and political issues, and the growing risk of consumer boycotts from all sides.',
        tone: 'Balanced and analytical: the journalist presents examples of costly boycotts, quotes an expert and researchers, and shows the risks of both speaking out and staying silent, without taking sides.',
        summary: [
          'For years, experts encouraged brands to take positions, as young consumers expected them to.',
          'Recent boycotts, such as the one against a US beer brand in 2023, have made companies more cautious.',
          'Boycotts now come from both progressive and conservative consumers, and can be linked to a CEO\'s behaviour.',
          'An expert argues that only positions embedded in the business are credible; others are seen as "woke-washing".',
          'Boycotts are often short-lived, but social networks amplify the risk; yet silence can also be criticised by employees and ESG investors.',
          'Many brands now choose "quiet activism": concrete action linked to their activity rather than loud campaigns.'
        ],
        problematic: 'Is brand activism a source of value and legitimacy for companies, or a commercial risk that they should avoid by focusing on their products?',
        plan: [
          {
            title: 'Arguments for brand activism',
            points: [
              'Consumers, especially Gen Z, and employees expect brands to share their values (employer branding).',
              'Consistency with CSR commitments and ESG investors\' expectations.',
              'A sincere commitment can create strong loyalty and differentiation (e.g. outdoor brands and environment).'
            ]
          },
          {
            title: 'The risks of taking a stand',
            points: [
              'Polarised societies: whatever the position, part of the market is alienated.',
              'Boycotts amplified by social networks; damage to sales and share price.',
              'Accusations of hypocrisy (woke-washing) if actions do not match words.'
            ]
          },
          {
            title: 'Conditions for credible engagement',
            points: [
              'Choose issues linked to the company\'s core business and stakeholders.',
              'Act before communicating: measurable commitments, transparency.',
              'Prepare crisis communication and involve employees.'
            ]
          }
        ],
        news: [
          'In 2025, several large US companies reduced or renamed their diversity, equity and inclusion programmes.',
          'Tesla\'s sales fell in several European countries in 2025, partly due to its CEO\'s political role.',
          'The EU Omnibus simplification of 2026 has reduced the number of companies subject to CSR reporting, fuelling the debate on corporate commitments.'
        ],
        juryQuestions: [
          { en: 'What does "woke-washing" mean, and how is it similar to greenwashing?', fr: 'Que signifie « woke-washing » et en quoi ressemble-t-il au greenwashing ?' },
          { en: 'Why, according to the article, can silence also be risky for a brand?', fr: 'Pourquoi, selon l\'article, le silence peut-il aussi être risqué pour une marque ?' },
          { en: 'What is "quiet activism"? Can you give an example?', fr: 'Qu\'est-ce que l\'« activisme discret » ? Pouvez-vous donner un exemple ?' },
          { en: 'Have you ever boycotted a brand? Why or why not?', fr: 'Avez-vous déjà boycotté une marque ? Pourquoi ?' },
          { en: 'Do you think the situation is different in France and in the United States?', fr: 'Pensez-vous que la situation est différente en France et aux États-Unis ?' },
          { en: 'Should the personal opinions of a CEO matter for a company?', fr: 'Les opinions personnelles d\'un PDG devraient-elles compter pour une entreprise ?' },
          { en: 'You mentioned employees. How can brand activism help recruitment?', fr: 'Vous avez parlé des salariés. Comment l\'engagement d\'une marque peut-il aider au recrutement ?' },
          { en: 'Is a boycott an effective way for consumers to change companies?', fr: 'Le boycott est-il un moyen efficace pour les consommateurs de faire changer les entreprises ?' },
          { en: 'How could a company measure whether its commitment is credible?', fr: 'Comment une entreprise pourrait-elle mesurer la crédibilité de son engagement ?' }
        ],
        keyVocab: [
          'boycott — boycott',
          'backlash — retour de bâton, réaction hostile',
          'brand image — image de marque',
          'core values — valeurs fondamentales',
          'to alienate customers — s\'aliéner des clients',
          'consistency — cohérence',
          'stakeholders — parties prenantes',
          'loyalty — fidélité',
          'polarisation — polarisation',
          'crisis communication — communication de crise'
        ]
      }
    },

    {
      id: 'venture-capital-ai-startups',
      theme: 1,
      themeTitle: 'Finance',
      title: 'Venture capital bets the house on artificial intelligence',
      source: 'Practice text — inspired by the financial press on venture capital, 2026',
      date: 'April 2026',
      question: 'Is the concentration of venture capital in artificial intelligence start-ups a danger for investors and for innovation?',
      paragraphs: [
        "Never has so much risk capital chased a single idea. According to industry trackers, artificial intelligence start-ups attracted roughly half of all venture capital invested worldwide in 2025, up from about a quarter two years earlier. A handful of companies developing large language models raised individual rounds of several billion dollars, at valuations that would have seemed absurd for loss-making businesses only a few years ago.",
        "Venture capital funds traditionally spread their money across dozens of young companies, knowing that most will fail and that a few spectacular successes will pay for the losses. The AI boom is changing this logic. Training advanced models requires enormous amounts of computing power, so the leading laboratories need sums that only the largest funds, sovereign wealth funds and tech giants can provide.",
        "\"We are no longer financing garages, we are financing power stations,\" says a partner at a European venture firm. \"The cheque sizes have changed the whole ecosystem.\" Smaller funds complain that they are priced out of the best deals, while start-ups in other sectors, from health to clean energy, find it harder to raise money. In Europe, where funds are smaller than in Silicon Valley, the gap is even more visible: the continent's most promising AI companies often have to turn to American investors to finance their growth.",
        "The circular nature of some deals also worries analysts. Chip makers and cloud providers invest in AI start-ups, which then spend much of that money buying chips and cloud services from their own investors. Supporters see a rational alliance between partners; sceptics see revenue that is partly artificial.",
        "There are also concerns about exits. Venture investors make money when a start-up is listed on the stock exchange or sold to a larger company. Initial public offerings have remained rare, and competition authorities are looking closely at the way big tech firms take stakes in promising rivals or hire their teams without formally buying them.",
        "Defenders of the boom point out that every technological revolution, from railways to the internet, went through periods of excessive investment. Even if many companies disappear, the infrastructure and skills they leave behind can benefit the whole economy.",
        "For pension funds and insurers that entrust their money to venture funds, the question is more immediate: are they financing the next great industry, or the next bubble?"
      ],
      glossary: [
        { en: 'round (of funding)', fr: 'levée de fonds, tour de table' },
        { en: 'valuation', fr: 'valorisation' },
        { en: 'to be priced out', fr: 'être exclu à cause des prix' },
        { en: 'exit', fr: 'sortie (revente de la participation)' },
        { en: 'initial public offering (IPO)', fr: 'introduction en Bourse' }
      ],
      corrige: {
        topic: 'The article analyses the massive concentration of venture capital in AI start-ups and the risks it creates for investors and for other sectors.',
        tone: 'Analytical and cautious: the author gives figures, quotes a professional, presents the arguments of both supporters and sceptics, and ends with a rhetorical question about a possible bubble.',
        summary: [
          'About half of global venture capital went to AI start-ups in 2025, with huge rounds and high valuations for loss-making firms.',
          'The traditional VC model of diversification is changing because AI labs need enormous sums for computing power.',
          'Smaller funds are excluded from the best deals and start-ups in other sectors struggle to raise money.',
          'Circular deals, where investors are also suppliers, raise doubts about the reality of revenue.',
          'Exits are uncertain: few IPOs, and competition authorities scrutinise big tech\'s stakes in start-ups.',
          'Supporters compare the boom to past technological revolutions, but institutional investors fear a bubble.'
        ],
        problematic: 'Does the massive flow of venture capital into AI fuel a lasting technological revolution, or does it create financial risks and crowd out other innovations?',
        plan: [
          {
            title: 'A rational bet on a transformative technology',
            points: [
              'AI can raise productivity in all sectors; early investors may earn huge returns.',
              'Historical precedent: railways and the internet left useful infrastructure after their bubbles.',
              'Strategic issue: Europe needs to fund its own champions (e.g. Mistral AI).'
            ]
          },
          {
            title: 'Financial and economic dangers',
            points: [
              'Overvaluation, circular deals and uncertain exits: risk of a bubble.',
              'Concentration of risk for pension funds and insurers.',
              'Crowding-out effect: health, green tech and other start-ups are underfunded.'
            ]
          },
          {
            title: 'How to limit the risks',
            points: [
              'Diversification and due diligence by limited partners.',
              'Competition policy on big tech investments and "acqui-hires".',
              'Public funding and dedicated funds for other strategic sectors.'
            ]
          }
        ],
        news: [
          'Fears of an AI bubble grew in 2025-2026 as the valuations of the "Magnificent 7" and AI labs soared.',
          'Large AI labs have raised rounds worth tens of billions of dollars, often with chip and cloud partners.',
          'Competition authorities in the US, UK and EU have examined partnerships between big tech and AI start-ups.'
        ],
        juryQuestions: [
          { en: 'What does the venture capitalist quoted in the article mean by "we are financing power stations"?', fr: 'Que veut dire « nous finançons des centrales électriques » ?' },
          { en: 'Can you explain how a venture capital fund makes money?', fr: 'Pouvez-vous expliquer comment un fonds de capital-risque gagne de l\'argent ?' },
          { en: 'What are "circular deals" and why are they a problem?', fr: 'Que sont les « accords circulaires » et pourquoi posent-ils problème ?' },
          { en: 'Do you think we are in an AI bubble? Why?', fr: 'Pensez-vous que nous sommes dans une bulle de l\'IA ? Pourquoi ?' },
          { en: 'What happened during the dot-com bubble around 2000?', fr: 'Que s\'est-il passé lors de la bulle internet vers 2000 ?' },
          { en: 'Why should pension funds be careful about this trend?', fr: 'Pourquoi les fonds de pension devraient-ils se méfier de cette tendance ?' },
          { en: 'Can Europe compete with the United States in financing AI?', fr: 'L\'Europe peut-elle rivaliser avec les États-Unis dans le financement de l\'IA ?' },
          { en: 'Which other sectors deserve more investment, in your opinion?', fr: 'Quels autres secteurs mériteraient plus d\'investissements selon vous ?' },
          { en: 'How is AI used in your own field, in accounting or finance?', fr: 'Comment l\'IA est-elle utilisée dans votre domaine, en comptabilité ou en finance ?' }
        ],
        keyVocab: [
          'venture capital — capital-risque',
          'start-up — jeune pousse',
          'to raise funds — lever des fonds',
          'stake — participation',
          'loss-making — déficitaire',
          'bubble — bulle',
          'return on investment — retour sur investissement',
          'to diversify — diversifier',
          'sovereign wealth fund — fonds souverain',
          'listing — cotation',
          'overvalued — surévalué'
        ]
      }
    },

    {
      id: 'coopetition-vs-mergers',
      theme: 5,
      themeTitle: 'Management, HR & strategy',
      title: 'Rivals in the showroom, partners in the factory',
      source: 'Practice text — inspired by the business press on the car industry, 2026',
      date: 'February 2026',
      question: 'Is cooperation with competitors a better growth strategy than mergers and acquisitions?',
      paragraphs: [
        "Ten years ago, the standard answer to a crisis in the car industry was a merger. Companies combined to share costs, as when two European groups joined forces in 2021 to create one of the world's largest carmakers. Today, faced with the expensive shift to electric vehicles and fierce competition from Chinese manufacturers, many executives are choosing a different path: working with their rivals without merging.",
        "The examples are multiplying. A German group has invested several billion dollars in a joint venture with an American electric-vehicle start-up to develop software. A French manufacturer and a Chinese partner have created a common company to produce engines and hybrid systems. Elsewhere, competitors share battery plants, charging networks and even vehicle platforms, while continuing to fight for customers in the showroom. Japanese carmakers, long known for their independence, have also multiplied cross-shareholdings and technical agreements in hybrid and hydrogen technologies.",
        "Economists call this \"coopetition\", a combination of cooperation and competition. Its advantages are clear. Partners share the huge costs of research and development, gain access to skills they lack and move faster than they could alone. Unlike a merger, a partnership can be limited to one activity and ended if it does not work.",
        "\"A merger is a marriage; a joint venture is a project,\" explains a strategy professor at a Paris business school. \"Mergers are slow, they require approval from competition authorities and, according to many studies, a majority fail to create the value promised to shareholders, often because of cultural clashes.\"",
        "Coopetition is not without risks, however. Sharing technology with a competitor can mean giving away know-how that took years to develop. Governance can be complicated when partners disagree, and the balance of power may shift if one side learns faster than the other. Some Western managers fear that alliances with Chinese firms could, in the long term, strengthen their most dangerous competitor.",
        "Mergers and acquisitions have not disappeared. Global deal volumes recovered in 2025 as interest rates fell, and buying a company remains the quickest way to gain market share or eliminate a rival. But in industries where technology changes quickly, flexibility has become a strategic asset.",
        "The question for executives is no longer simply whether to buy or to build, but whom to trust — and for how long."
      ],
      glossary: [
        { en: 'joint venture', fr: 'coentreprise' },
        { en: 'platform (car industry)', fr: 'plateforme (base technique commune à plusieurs modèles)' },
        { en: 'know-how', fr: 'savoir-faire' },
        { en: 'cultural clash', fr: 'choc des cultures' },
        { en: 'deal volume', fr: 'volume des opérations (fusions-acquisitions)' }
      ],
      corrige: {
        topic: 'The article compares two growth strategies in the car industry: traditional mergers and acquisitions and "coopetition", i.e. cooperation between competitors through partnerships and joint ventures.',
        tone: 'Informative and balanced: the author gives examples, quotes an academic expert and weighs the advantages and risks of coopetition, while noting that M&A remains relevant.',
        summary: [
          'Faced with the costly electric transition and Chinese competition, carmakers now often cooperate instead of merging.',
          'Examples include joint ventures on software, engines, batteries and platforms between competitors.',
          'Coopetition allows partners to share R&D costs, access skills and move faster, with more flexibility than a merger.',
          'An expert stresses that mergers are slow, need regulatory approval and often destroy value because of cultural clashes.',
          'Coopetition has risks: loss of know-how, complex governance, and strengthening a future rival.',
          'M&A recovered in 2025, but in fast-changing industries flexibility has become a key strategic asset.'
        ],
        problematic: 'In a fast-changing and capital-intensive industry, is coopetition a more effective and less risky way to grow than mergers and acquisitions?',
        plan: [
          {
            title: 'The strengths of coopetition',
            points: [
              'Cost sharing for R&D and production; economies of scale without full integration.',
              'Flexibility: limited scope, reversible, faster to set up.',
              'Access to complementary skills (software, batteries) and to new markets.'
            ]
          },
          {
            title: 'Why mergers and acquisitions remain attractive',
            points: [
              'Full control of strategy, assets and technology.',
              'Quick gain of market share and synergies (e.g. Stellantis).',
              'Coopetition risks: leakage of know-how, governance conflicts, dependence on a rival.'
            ]
          },
          {
            title: 'Choosing according to context',
            points: [
              'Depends on the industry, the speed of technological change and trust between partners.',
              'Hybrid strategies: alliance first, acquisition later.',
              'Role of competition authorities and geopolitical issues (China, tariffs).'
            ]
          }
        ],
        news: [
          'Volkswagen and Rivian created a joint venture in 2024 to develop software and electrical architecture.',
          'Renault and Geely launched Horse Powertrain, a joint company producing combustion and hybrid engines.',
          'US tariffs and the 2026 Supreme Court decision on IEEPA tariffs have made supply chains and alliances more uncertain.'
        ],
        juryQuestions: [
          { en: 'Can you define "coopetition" in your own words?', fr: 'Pouvez-vous définir la « coopétition » avec vos propres mots ?' },
          { en: 'Why does the expert compare a merger to a marriage?', fr: 'Pourquoi l\'experte compare-t-elle une fusion à un mariage ?' },
          { en: 'Why do many mergers fail to create value?', fr: 'Pourquoi beaucoup de fusions ne créent-elles pas de valeur ?' },
          { en: 'Is it dangerous for European carmakers to cooperate with Chinese companies?', fr: 'Est-il dangereux pour les constructeurs européens de coopérer avec des entreprises chinoises ?' },
          { en: 'Can you think of examples of coopetition outside the car industry?', fr: 'Pouvez-vous citer des exemples de coopétition hors de l\'automobile ?' },
          { en: 'How would you manage the cultural differences in a joint venture?', fr: 'Comment géreriez-vous les différences culturelles dans une coentreprise ?' },
          { en: 'What is the role of competition authorities in mergers?', fr: 'Quel est le rôle des autorités de la concurrence dans les fusions ?' },
          { en: 'How are joint ventures treated in the consolidated accounts?', fr: 'Comment les coentreprises sont-elles traitées dans les comptes consolidés ?' },
          { en: 'If you were a CEO, would you rather buy a start-up or partner with it?', fr: 'Si vous étiez PDG, préféreriez-vous racheter une start-up ou vous associer avec elle ?' }
        ],
        keyVocab: [
          'merger — fusion',
          'acquisition — acquisition, rachat',
          'takeover — prise de contrôle',
          'partnership — partenariat',
          'synergies — synergies',
          'economies of scale — économies d\'échelle',
          'market share — part de marché',
          'competitor / rival — concurrent',
          'to join forces — unir ses forces',
          'carmaker — constructeur automobile',
          'governance — gouvernance'
        ]
      }
    },

    {
      id: 'intangibles-goodwill',
      theme: 2,
      themeTitle: 'Accounting & auditing',
      title: 'Invisible assets: why balance sheets miss most of what companies are worth',
      source: 'Practice text — inspired by the accounting and financial press, 2026',
      date: 'May 2026',
      question: 'Should accounting standards allow companies to recognise internally generated intangible assets, such as brands and data, on their balance sheets?',
      paragraphs: [
        "Look at the balance sheet of a large technology or luxury company and something seems to be missing. Its most valuable assets — its brands, its customer data, its software, the know-how of its staff — are largely absent. According to several estimates, intangible assets now account for around 90% of the market value of the largest American listed companies, compared with less than 20% in the 1970s.",
        "The reason lies in the accounting rules. Under international standards, a company can record an intangible asset only if it is identifiable, controlled and likely to generate future benefits, and if its cost can be measured reliably. In practice, a brand built over decades by advertising, or a database created by millions of users, cannot be recognised: the money spent on it is treated as an expense.",
        "The situation changes completely when a company is bought. The acquirer must then record the target's brands and customer relationships at fair value, and any remaining difference between the price paid and the net assets becomes goodwill. As a result, two similar companies can show very different balance sheets simply because one grew by acquisitions and the other did not.",
        "Goodwill itself is controversial. It is no longer amortised under international standards but tested each year for impairment. Critics say these tests are \"too little, too late\": managers, who are reluctant to admit that a deal was a mistake, rely on optimistic forecasts, and losses are recognised only when the market has already understood them. Several large European groups have announced impairment losses of several billion euros in recent years, often years after the acquisitions concerned, and their share prices barely moved, a sign that markets had already priced in the loss.",
        "\"Financial statements were designed for factories, not for algorithms,\" says a former audit partner at a Big Four firm. \"Investors now get more useful information from the management report than from the balance sheet.\"",
        "The International Accounting Standards Board has launched research on the subject, but reform faces a real dilemma. Recognising internally generated brands or data would make balance sheets more relevant, but valuing them requires many assumptions and could open the door to manipulation. Auditors, for their part, warn that they would struggle to verify figures that rely so heavily on management judgement.",
        "Some propose a middle way: better disclosures in the notes rather than new assets on the balance sheet. For users of accounts, the debate is far from academic."
      ],
      glossary: [
        { en: 'intangible asset', fr: 'immobilisation incorporelle, actif immatériel' },
        { en: 'fair value', fr: 'juste valeur' },
        { en: 'goodwill', fr: 'écart d\'acquisition, goodwill' },
        { en: 'impairment test', fr: 'test de dépréciation' },
        { en: 'notes (to the financial statements)', fr: 'annexe (des comptes)' }
      ],
      corrige: {
        topic: 'The article deals with the gap between the real value of companies, now mostly made of intangible assets, and what appears on their balance sheets under international accounting standards.',
        tone: 'Analytical and rather critical of current standards: the author explains technical rules, quotes a former auditor and presents the dilemma of reform objectively.',
        summary: [
          'Intangibles such as brands, data and know-how make up most of the value of large companies but are largely absent from balance sheets.',
          'Under IFRS, internally generated intangibles are rarely recognised: the spending is expensed.',
          'In an acquisition, the target\'s intangibles are recorded at fair value and the remainder becomes goodwill, making comparisons difficult.',
          'Goodwill is tested for impairment instead of being amortised, and critics say losses are recognised too late.',
          'An expert says financial statements are outdated, and investors rely more on the management report.',
          'The IASB is studying reform, but recognising intangibles raises problems of reliability, manipulation and auditability; better disclosure may be a compromise.'
        ],
        problematic: 'Should accounting give priority to relevance by recognising internally generated intangibles, or to reliability and prudence by keeping the current restrictive rules?',
        plan: [
          {
            title: 'Arguments for recognition',
            points: [
              'Relevance: the balance sheet would better reflect the real value and business model.',
              'Comparability between companies that grow organically and those that grow by acquisition.',
              'Better information for investors and lenders, especially for tech and luxury firms.'
            ]
          },
          {
            title: 'Arguments against recognition',
            points: [
              'Reliability: valuing a brand or data set requires subjective assumptions.',
              'Risk of creative accounting and difficulties for auditors.',
              'Prudence principle; volatile values (a brand can collapse after a scandal).'
            ]
          },
          {
            title: 'A middle way',
            points: [
              'Richer disclosures in the notes and management report (non-financial KPIs).',
              'Debate on reintroducing goodwill amortisation (rejected by the IASB in 2022) and better disclosures on acquisitions.',
              'Link with sustainability reporting (human capital, data governance).'
            ]
          }
        ],
        news: [
          'The IASB added a research project on intangible assets to its agenda after its 2022 agenda consultation.',
          'The IASB has worked on improving disclosures about business combinations and goodwill.',
          'The AI boom has increased the share of software, data and models in company value.'
        ],
        juryQuestions: [
          { en: 'Can you give an example of an intangible asset?', fr: 'Pouvez-vous donner un exemple d\'actif incorporel ?' },
          { en: 'What is goodwill, and how is it calculated?', fr: 'Qu\'est-ce que le goodwill et comment est-il calculé ?' },
          { en: 'Why does the author say impairment tests are "too little, too late"?', fr: 'Pourquoi l\'auteur dit-il que les tests de dépréciation arrivent « trop peu, trop tard » ?' },
          { en: 'What is the difference between amortisation and impairment?', fr: 'Quelle est la différence entre amortissement et dépréciation ?' },
          { en: 'How is goodwill treated under French GAAP compared with IFRS?', fr: 'Comment le goodwill est-il traité en normes françaises par rapport aux IFRS ?' },
          { en: 'Would you, as an auditor, be comfortable checking the value of a brand?', fr: 'En tant qu\'auditrice, seriez-vous à l\'aise pour vérifier la valeur d\'une marque ?' },
          { en: 'Can you think of a company whose brand is worth more than its factories?', fr: 'Pouvez-vous citer une entreprise dont la marque vaut plus que ses usines ?' },
          { en: 'How could data be valued in accounts?', fr: 'Comment des données pourraient-elles être valorisées dans les comptes ?' },
          { en: 'Is the balance sheet still useful for investors today?', fr: 'Le bilan est-il encore utile aux investisseurs aujourd\'hui ?' }
        ],
        keyVocab: [
          'balance sheet — bilan',
          'to recognise an asset — comptabiliser un actif',
          'to expense — passer en charges',
          'to amortise — amortir',
          'impairment loss — perte de valeur, dépréciation',
          'acquirer / target — acquéreur / cible',
          'reliability — fiabilité',
          'relevance — pertinence',
          'disclosure — information publiée',
          'accounting standard — norme comptable',
          'management judgement — jugement de la direction'
        ]
      }
    },

    {
      id: 'executive-pay-activist-shareholders',
      theme: 3,
      themeTitle: 'Governance & CSR',
      title: 'Say on pay: shareholders push back against soaring executive packages',
      source: 'Practice text — inspired by the business press on corporate governance, 2026',
      date: 'June 2026',
      question: 'To what extent can shareholder activism improve corporate governance?',
      paragraphs: [
        "The annual general meeting season used to be a formality. This year, at several large European and American companies, it turned into a battle. Investors voted against pay packages they considered excessive, and activist funds demanded seats on boards, changes of strategy and, in some cases, the departure of the chief executive.",
        "Executive pay is at the heart of the tension. In the United States, the average chief executive of a large listed company now earns close to 300 times as much as a typical employee, compared with about 20 times in the 1960s. European packages are smaller but growing quickly, partly because companies argue they must compete with American salaries to attract talent. Long-term incentive plans, paid in shares, now represent the largest part of most packages, which means that a rising stock market can multiply the final amount received.",
        "Since the 2010s, \"say on pay\" rules have given shareholders a vote on directors' remuneration. In the European Union, this vote has become compulsory for listed companies, and in France a negative vote can block the payment of variable bonuses. In the United States, by contrast, the vote is only advisory: boards can ignore it, as some have done after shareholders rejected their proposals.",
        "Activist investors claim to be the guardians of good governance. \"Boards too often protect management rather than challenge it,\" says the head of a London-based activist fund. \"We ask the questions that independent directors should have asked.\" Some campaigns have led to clearer strategies, the sale of unprofitable divisions or stronger links between pay and long-term performance.",
        "Critics see things differently. They accuse some activists of short-termism: pushing for share buybacks, higher dividends or job cuts that boost the share price quickly, at the expense of investment, employees and the company's long-term future. Trade unions point out that employees, who are also stakeholders, rarely have the same influence.",
        "The rise of proxy advisers, which recommend how institutional investors should vote, adds another layer to the debate. Their supporters say they help investors analyse thousands of resolutions; their opponents accuse them of applying the same checklist to every company.",
        "Between passive index funds that rarely vote against management and aggressive activists, the challenge is to find shareholders who behave like responsible owners — and boards willing to listen to them."
      ],
      glossary: [
        { en: 'annual general meeting (AGM)', fr: 'assemblée générale annuelle' },
        { en: 'pay package', fr: 'rémunération globale (fixe, variable, actions)' },
        { en: 'advisory vote', fr: 'vote consultatif' },
        { en: 'share buyback', fr: 'rachat d\'actions' },
        { en: 'proxy adviser', fr: 'agence de conseil en vote' }
      ],
      corrige: {
        topic: 'The article deals with growing shareholder opposition to high executive pay and with the role of activist investors in corporate governance.',
        tone: 'Balanced and informative: the journalist presents figures and the legal framework, quotes an activist, then gives the critics\' arguments and ends on a nuanced conclusion.',
        summary: [
          'General meetings have become battlegrounds where investors reject pay packages and activists demand board seats and strategic changes.',
          'CEO pay has exploded, especially in the US (about 300 times the typical employee), and Europe is catching up.',
          'Say-on-pay votes are compulsory in the EU (binding in France, advisory in some countries such as Germany) but only advisory in the US.',
          'Activists present themselves as defenders of governance and have obtained clearer strategies and better pay-performance links.',
          'Critics accuse them of short-termism (buybacks, dividends, job cuts) and stress that employees have little say.',
          'Proxy advisers and passive funds complicate the picture; the goal is responsible ownership and boards that listen.'
        ],
        problematic: 'Do activist shareholders make boards more accountable and executive pay fairer, or do they serve their own short-term interests at the expense of other stakeholders?',
        plan: [
          {
            title: 'Activism as a tool of good governance',
            points: [
              'Agency theory: shareholders monitor managers and reduce agency costs.',
              'Say on pay limits excessive remuneration and links it to performance.',
              'Activists challenge passive or captured boards.'
            ]
          },
          {
            title: 'The limits and dangers of activism',
            points: [
              'Short-termism: buybacks and cost cuts at the expense of investment and R&D.',
              'Shareholder primacy ignores employees and other stakeholders.',
              'Proxy advisers\' standardised recommendations; influence of a few large funds.'
            ]
          },
          {
            title: 'Towards balanced governance',
            points: [
              'Independent directors, employee representatives on boards (French model).',
              'Long-term and CSR criteria in variable pay.',
              'Stewardship codes and responsible engagement by institutional investors.'
            ]
          }
        ],
        news: [
          'In November 2025, Tesla shareholders approved a potential pay package for Elon Musk worth up to about $1 trillion, tied to very ambitious targets.',
          'The EU Shareholder Rights Directive II made say-on-pay votes compulsory for listed companies.',
          'The 2026 EU Omnibus reduced CSR reporting obligations, which may give more weight to investor engagement.'
        ],
        juryQuestions: [
          { en: 'What is "say on pay"? How does it work in France?', fr: 'Qu\'est-ce que le « say on pay » ? Comment fonctionne-t-il en France ?' },
          { en: 'What is the difference between an activist fund and a passive index fund?', fr: 'Quelle est la différence entre un fonds activiste et un fonds indiciel passif ?' },
          { en: 'Why do critics accuse activists of short-termism?', fr: 'Pourquoi les critiques accusent-ils les activistes de court-termisme ?' },
          { en: 'Can you explain agency theory briefly?', fr: 'Pouvez-vous expliquer brièvement la théorie de l\'agence ?' },
          { en: 'Is it fair that a CEO earns 300 times more than an employee?', fr: 'Est-il juste qu\'un PDG gagne 300 fois plus qu\'un salarié ?' },
          { en: 'Should employees have seats on the board of directors?', fr: 'Les salariés devraient-ils siéger au conseil d\'administration ?' },
          { en: 'What role do independent directors play?', fr: 'Quel rôle jouent les administrateurs indépendants ?' },
          { en: 'How could CSR criteria be included in executive pay?', fr: 'Comment intégrer des critères RSE dans la rémunération des dirigeants ?' },
          { en: 'Do you know of a recent example of an activist campaign?', fr: 'Connaissez-vous un exemple récent de campagne activiste ?' }
        ],
        keyVocab: [
          'executive pay / remuneration — rémunération des dirigeants',
          'shareholder — actionnaire',
          'board of directors — conseil d\'administration',
          'independent director — administrateur indépendant',
          'binding vote — vote contraignant',
          'bonus — prime, part variable',
          'stock options — options sur actions',
          'short-termism — court-termisme',
          'accountability — responsabilité, obligation de rendre des comptes',
          'stewardship — gestion responsable (des investisseurs)',
          'resolution — résolution'
        ]
      }
    }
  ];

  S.examSubjects = (S.examSubjects || []).concat(subjects);
})(window.AideVisio = window.AideVisio || {});
