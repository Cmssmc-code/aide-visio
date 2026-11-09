(function (S) {
  'use strict';

  S.examFiches = {

    exam: {
      date: "2026-11-12T10:00",
      title: "Oral d'anglais des affaires — UE 218",
      mode: "À distance (Teams)",
      format: [
        { label: "Préparation", minutes: 60, detail: "Un article de presse anglo-saxonne + une question. Aucun dictionnaire, aucun document autre que le sujet. Notes en mots-clés." },
        { label: "Exposé", minutes: 15, detail: "Seule, sans interruption : introduction, synthèse, transition, problématique, commentaire en 2-3 axes, conclusion. Moins de 10 min (ou commentaire < 5 min) est pénalisé." },
        { label: "Entretien", minutes: 15, detail: "Échange avec le jury : vérifier la compréhension, faire préciser ou nuancer, ouvrir sur d'autres sujets. L'interaction compte dans la note." }
      ]
    },

    method: [
      {
        id: "prep",
        title: "Préparation : découper l'heure",
        minutes: 60,
        goal: "Arriver à l'exposé avec une synthèse claire, une problématique, un plan annoncé et seulement trois passages rédigés (intro, transition, conclusion).",
        tips: [
          "0-10 min — Lecture active : lire la question d'abord, puis l'article deux fois. Souligner les chiffres, les noms, les citations ; noter l'idée de chaque paragraphe dans la marge.",
          "10-25 min — Synthèse : regrouper les idées en 3-4 blocs logiques (cause → conséquence → enjeux, ou constat → débat → perspectives). Reformuler avec SES mots, jamais recopier des phrases entières.",
          "25-35 min — Problématique + plan : transformer la question en une question ouverte, puis choisir 2-3 axes équilibrés (ex. : avantages / limites / conditions).",
          "35-50 min — Commentaire en mots-clés : pour chaque axe, 2 arguments + 1 exemple (actualité, cours, expérience personnelle ou professionnelle).",
          "50-55 min — Rédiger uniquement l'introduction, la transition et la conclusion (phrases complètes, courtes).",
          "55-60 min — Relecture : vérifier les -s, les -ed, les chiffres, et numéroter ses feuilles. Écrire en gros pour pouvoir lire d'un coup d'œil devant la caméra.",
          "Écrire sur une seule face, une feuille par partie : on ne se perd pas en tournant les pages.",
          "Noter l'heure de début de l'exposé en haut de la feuille pour surveiller les 10 minutes minimum."
        ],
        phrases: []
      },
      {
        id: "intro",
        title: "Introduction (1-2 min)",
        minutes: 2,
        goal: "Présenter le document : source, date, auteur si connu, sujet, ton. Puis annoncer le déroulé de l'exposé.",
        tips: [
          "Commencer par une phrase d'accroche simple (un chiffre, une actualité liée au sujet).",
          "Donner la nature du document : article de presse, éditorial, interview, tribune.",
          "Le ton : un adjectif + une justification tirée du texte (« … as shown by the use of figures »).",
          "Annoncer le déroulé : synthèse, puis commentaire autour de la question posée.",
          "Partie rédigée : la lire en levant les yeux vers la caméra à chaque fin de phrase."
        ],
        phrases: [
          "The document I am going to present is an article published in The Economist on 7 March 2026.",
          "It was written by a business journalist and deals with the rise of green bonds.",
          "The tone is rather critical, as the author repeatedly questions the official figures.",
          "First, I will summarise the main ideas of the article; then I will answer the question in a short commentary."
        ]
      },
      {
        id: "summary",
        title: "Synthèse (4-5 min)",
        minutes: 5,
        goal: "Restituer la logique de l'auteur, reformulée, sans donner son avis. C'est la partie la plus pénalisée si elle est oubliée ou bâclée.",
        tips: [
          "Ne pas suivre le texte paragraphe par paragraphe : regrouper par idées (3-4 blocs).",
          "Garder l'auteur comme sujet des phrases : « The author explains / argues / points out… ».",
          "Reprendre 2-3 chiffres clés, bien prononcés (les répéter pendant la préparation).",
          "Zéro avis personnel ici : on garde son opinion pour le commentaire.",
          "Utiliser des connecteurs pour montrer la logique : first, then, however, as a result."
        ],
        phrases: [
          "The author first explains that…",
          "He then points out that…",
          "According to the journalist, the main reason is…",
          "She goes on to argue that…",
          "Finally, the article highlights the risks of…"
        ]
      },
      {
        id: "transition",
        title: "Transition",
        minutes: null,
        goal: "Marquer clairement le passage de la synthèse (l'auteur) au commentaire (moi).",
        tips: [
          "Une ou deux phrases rédigées, dites lentement.",
          "Le jury doit entendre que l'on change de partie : c'est un critère de structure.",
          "Relier la transition à la question posée."
        ],
        phrases: [
          "Now that I have summarised the article, I would like to move on to the commentary.",
          "This article raises an important question, which leads me to my commentary."
        ]
      },
      {
        id: "problematic",
        title: "Problématique",
        minutes: null,
        goal: "Reformuler la question du sujet en un vrai problème à discuter, puis annoncer le plan.",
        tips: [
          "Partir de la question imposée : ne jamais l'esquiver, c'est hors-sujet.",
          "Formes utiles : « To what extent…? », « Is it possible to… without…? », « Should companies…? ».",
          "Annoncer 2-3 axes clairement numérotés : le jury suit plus facilement.",
          "Garder une problématique courte : une seule phrase."
        ],
        phrases: [
          "The question we are asked is whether…",
          "This leads us to wonder to what extent…",
          "I will first show that…; then I will look at the limits of…; finally, I will suggest…"
        ]
      },
      {
        id: "commentary",
        title: "Commentaire argumenté (6-7 min)",
        minutes: 7,
        goal: "Répondre à la question en 2-3 axes annoncés, avec des arguments, des exemples et de l'actualité. Au moins 5 minutes.",
        tips: [
          "Chaque axe = une idée directrice + 2 arguments + 1 exemple concret.",
          "Mobiliser l'actualité 2025-2026 (droits de douane US, Omnibus UE, IA, stablecoins…) et les connaissances du DSGC.",
          "L'expérience personnelle est bienvenue (stage, entreprise, vie quotidienne).",
          "Nuancer : « however », « on the other hand », « this is not always true ».",
          "Parler à partir des mots-clés, pas lire : regarder la caméra.",
          "Annoncer chaque nouvel axe : « Let us now turn to my second point »."
        ],
        phrases: [
          "My first point is that…",
          "A good example of this is…",
          "This is particularly true in the case of…",
          "However, this argument has its limits.",
          "Let us now turn to my second point."
        ]
      },
      {
        id: "conclusion",
        title: "Conclusion (1 min)",
        minutes: 1,
        goal: "Répondre clairement à la problématique, puis ouvrir sur une question plus large.",
        tips: [
          "Résumer la réponse en une ou deux phrases, sans répéter tout l'exposé.",
          "Ouverture : une question liée à un autre thème du programme (ex. : de la finance vers la RSE).",
          "Terminer par « Thank you for your attention. » pour signaler la fin au jury.",
          "Partie rédigée : la connaître presque par cœur."
        ],
        phrases: [
          "To conclude, I would say that…",
          "All in all, the answer to the question is yes, but only if…",
          "This raises a broader question: …",
          "Thank you for your attention."
        ]
      },
      {
        id: "interview",
        title: "Entretien avec le jury (15 min)",
        minutes: 15,
        goal: "Montrer qu'on comprend, qu'on sait préciser, nuancer et interagir. Le jury veut une conversation, pas un examen de grammaire.",
        tips: [
          "Écouter la question jusqu'au bout ; si besoin, la faire répéter (c'est autorisé et normal).",
          "Reformuler la question avant de répondre pour gagner quelques secondes.",
          "Répondre en 3 temps : réponse directe → justification → exemple.",
          "Ne pas hésiter à dire qu'on ne sait pas, puis proposer une piste.",
          "Garder des réponses de 30 secondes à 1 minute : ni un mot, ni un monologue.",
          "Rester souriante et regarder la caméra, pas son propre visage à l'écran."
        ],
        phrases: [
          "That is a very good question.",
          "If I understand correctly, you are asking whether…",
          "I am not entirely sure, but I would say that…",
          "Could you repeat the question, please?"
        ]
      }
    ],

    phrases: [
      {
        id: "present-doc",
        title: "Présenter le document",
        items: [
          { en: "The document under study is an article taken from the Financial Times.", fr: "Le document étudié est un article tiré du Financial Times." },
          { en: "It was published on 12 January 2026.", fr: "Il a été publié le 12 janvier 2026." },
          { en: "It was written by a journalist specialising in finance.", fr: "Il a été écrit par un journaliste spécialisé en finance." },
          { en: "The article deals with / focuses on…", fr: "L'article traite de / porte sur…" },
          { en: "The main topic of the article is…", fr: "Le sujet principal de l'article est…" },
          { en: "It is set in the context of…", fr: "Il s'inscrit dans le contexte de…" },
          { en: "The article is aimed at a well-informed audience of business readers.", fr: "L'article s'adresse à un public averti de lecteurs du monde des affaires." },
          { en: "This topic is all the more relevant as…", fr: "Ce sujet est d'autant plus d'actualité que…" }
        ]
      },
      {
        id: "tone",
        title: "Décrire le ton",
        items: [
          { en: "The tone of the article is rather neutral and informative.", fr: "Le ton de l'article est plutôt neutre et informatif." },
          { en: "The author adopts a critical tone towards…", fr: "L'auteur adopte un ton critique envers…" },
          { en: "This is shown by the use of figures and quotes.", fr: "On le voit à l'utilisation de chiffres et de citations." },
          { en: "The journalist sounds worried about…", fr: "Le journaliste semble inquiet au sujet de…" },
          { en: "The article is quite balanced: it gives both sides of the debate.", fr: "L'article est assez équilibré : il présente les deux côtés du débat." },
          { en: "The author's point of view becomes clear at the end of the text.", fr: "Le point de vue de l'auteur devient clair à la fin du texte." },
          { en: "The use of words such as … reveals an ironic tone.", fr: "L'emploi de mots comme … révèle un ton ironique." }
        ]
      },
      {
        id: "summarise",
        title: "Résumer la logique de l'auteur",
        items: [
          { en: "The author starts by explaining that…", fr: "L'auteur commence par expliquer que…" },
          { en: "He points out / underlines that…", fr: "Il souligne que…" },
          { en: "She then argues that…", fr: "Elle soutient ensuite que…" },
          { en: "According to the article, …", fr: "Selon l'article, …" },
          { en: "The journalist quotes an expert who claims that…", fr: "Le journaliste cite un expert qui affirme que…" },
          { en: "The article goes on to describe…", fr: "L'article poursuit en décrivant…" },
          { en: "This is illustrated by the example of…", fr: "Ceci est illustré par l'exemple de…" },
          { en: "Last but not least, the author warns that…", fr: "Enfin et surtout, l'auteur avertit que…" },
          { en: "In other words, the author suggests that…", fr: "Autrement dit, l'auteur laisse entendre que…" }
        ]
      },
      {
        id: "transition",
        title: "Faire la transition",
        items: [
          { en: "Now that I have presented the main ideas of the article, I would like to move on to my commentary.", fr: "Maintenant que j'ai présenté les idées principales, j'aimerais passer à mon commentaire." },
          { en: "This brings me to the second part of my presentation.", fr: "Cela m'amène à la deuxième partie de ma présentation." },
          { en: "Let us now focus on the question we have been asked.", fr: "Concentrons-nous maintenant sur la question posée." },
          { en: "This article raises a key issue, which I would like to discuss.", fr: "Cet article soulève un enjeu clé dont j'aimerais discuter." },
          { en: "Having summarised the article, I will now give my own analysis.", fr: "Après avoir résumé l'article, je vais maintenant donner ma propre analyse." },
          { en: "Let me now turn to the commentary.", fr: "Passons maintenant au commentaire." }
        ]
      },
      {
        id: "problematic",
        title: "Poser la problématique",
        items: [
          { en: "The question is whether…", fr: "La question est de savoir si…" },
          { en: "This leads us to wonder to what extent…", fr: "Cela nous amène à nous demander dans quelle mesure…" },
          { en: "Is it possible to … without …?", fr: "Est-il possible de … sans … ?" },
          { en: "Should companies really…?", fr: "Les entreprises devraient-elles vraiment… ?" },
          { en: "Can we say that … is a threat or an opportunity for…?", fr: "Peut-on dire que … est une menace ou une opportunité pour… ?" },
          { en: "The real issue here is how to reconcile … with …", fr: "Le véritable enjeu est de concilier … avec …" },
          { en: "What are the consequences of … for…?", fr: "Quelles sont les conséquences de … pour… ?" }
        ]
      },
      {
        id: "plan",
        title: "Annoncer le plan",
        items: [
          { en: "I will answer this question in two parts.", fr: "Je répondrai à cette question en deux parties." },
          { en: "First, I will show that…", fr: "Premièrement, je montrerai que…" },
          { en: "Then, I will look at the limits of…", fr: "Ensuite, j'examinerai les limites de…" },
          { en: "Finally, I will suggest some solutions.", fr: "Enfin, je proposerai quelques solutions." },
          { en: "My first point will deal with…", fr: "Mon premier point portera sur…" },
          { en: "In a second part, I will focus on…", fr: "Dans une seconde partie, je me concentrerai sur…" },
          { en: "Let us start with…", fr: "Commençons par…" }
        ]
      },
      {
        id: "argue",
        title: "Argumenter",
        items: [
          { en: "In my opinion / In my view, …", fr: "À mon avis, …" },
          { en: "I strongly believe that…", fr: "Je suis convaincue que…" },
          { en: "The main advantage is that…", fr: "Le principal avantage est que…" },
          { en: "The main drawback is that…", fr: "Le principal inconvénient est que…" },
          { en: "This is mainly due to…", fr: "Ceci est principalement dû à…" },
          { en: "As a result, firms have to…", fr: "En conséquence, les entreprises doivent…" },
          { en: "It is worth noting that…", fr: "Il est intéressant de noter que…" },
          { en: "This clearly shows that…", fr: "Cela montre clairement que…" },
          { en: "There is no doubt that…", fr: "Il ne fait aucun doute que…" }
        ]
      },
      {
        id: "example",
        title: "Donner un exemple, citer l'actualité",
        items: [
          { en: "A good example of this is…", fr: "Un bon exemple en est…" },
          { en: "Take the case of…", fr: "Prenons le cas de…" },
          { en: "Recently, in February 2026, the US Supreme Court…", fr: "Récemment, en février 2026, la Cour suprême américaine…" },
          { en: "This was in the news last year when…", fr: "C'était dans l'actualité l'an dernier quand…" },
          { en: "In my own experience, …", fr: "D'après ma propre expérience, …" },
          { en: "When I worked in a small company, I noticed that…", fr: "Quand je travaillais dans une petite entreprise, j'ai remarqué que…" },
          { en: "In France, for instance, …", fr: "En France, par exemple, …" },
          { en: "According to recent figures, …", fr: "Selon des chiffres récents, …" }
        ]
      },
      {
        id: "nuance",
        title: "Nuancer",
        items: [
          { en: "However, this is not always the case.", fr: "Cependant, ce n'est pas toujours le cas." },
          { en: "On the other hand, …", fr: "D'un autre côté, …" },
          { en: "This argument has its limits.", fr: "Cet argument a ses limites." },
          { en: "It depends on the size of the company.", fr: "Cela dépend de la taille de l'entreprise." },
          { en: "To some extent, this is true, but…", fr: "Dans une certaine mesure, c'est vrai, mais…" },
          { en: "We should not forget that…", fr: "Il ne faut pas oublier que…" },
          { en: "Even though…, it remains that…", fr: "Même si…, il n'en reste pas moins que…" },
          { en: "Things are more complex than they seem.", fr: "Les choses sont plus complexes qu'il n'y paraît." }
        ]
      },
      {
        id: "conclude",
        title: "Conclure et ouvrir",
        items: [
          { en: "To conclude / In conclusion, …", fr: "Pour conclure, …" },
          { en: "All things considered, …", fr: "Tout bien considéré, …" },
          { en: "To sum up, the answer to the question is…", fr: "En résumé, la réponse à la question est…" },
          { en: "This raises a broader question: …", fr: "Cela soulève une question plus large : …" },
          { en: "It will be interesting to see whether…", fr: "Il sera intéressant de voir si…" },
          { en: "In the years to come, …", fr: "Dans les années à venir, …" },
          { en: "Thank you for your attention.", fr: "Merci de votre attention." }
        ]
      },
      {
        id: "repeat",
        title: "Entretien : faire répéter, faire préciser",
        items: [
          { en: "Sorry, could you repeat the question, please?", fr: "Pardon, pourriez-vous répéter la question ?" },
          { en: "Could you speak a little more slowly, please?", fr: "Pourriez-vous parler un peu plus lentement ?" },
          { en: "Sorry, I didn't quite catch the last word.", fr: "Pardon, je n'ai pas bien saisi le dernier mot." },
          { en: "Do you mean…?", fr: "Voulez-vous dire… ?" },
          { en: "If I understand correctly, you are asking me whether…", fr: "Si je comprends bien, vous me demandez si…" },
          { en: "Sorry, the connection was a bit poor. Could you say that again?", fr: "Désolée, la connexion était mauvaise. Pourriez-vous redire cela ?" }
        ]
      },
      {
        id: "time",
        title: "Entretien : gagner du temps",
        items: [
          { en: "That is a very interesting question.", fr: "C'est une question très intéressante." },
          { en: "Let me think about it for a second.", fr: "Laissez-moi réfléchir une seconde." },
          { en: "Well, it is a difficult question, but I would say that…", fr: "Eh bien, c'est une question difficile, mais je dirais que…" },
          { en: "There are several ways of looking at it.", fr: "Il y a plusieurs façons de voir les choses." },
          { en: "As I said in my presentation, …", fr: "Comme je l'ai dit dans ma présentation, …" },
          { en: "How can I put it? …", fr: "Comment dire ? …" }
        ]
      },
      {
        id: "dont-know",
        title: "Entretien : reconnaître ne pas savoir",
        items: [
          { en: "I am afraid I don't know much about this topic, but…", fr: "Je crains de ne pas bien connaître ce sujet, mais…" },
          { en: "I am not an expert, but I would imagine that…", fr: "Je ne suis pas experte, mais j'imagine que…" },
          { en: "I don't know the exact figure, but it is around…", fr: "Je ne connais pas le chiffre exact, mais il est d'environ…" },
          { en: "I haven't read much about it, but from what I know, …", fr: "Je n'ai pas beaucoup lu sur le sujet, mais d'après ce que je sais, …" },
          { en: "I can't remember the name, but the idea is that…", fr: "Je ne me souviens pas du nom, mais l'idée est que…" },
          { en: "I don't know the English word, but it is a kind of…", fr: "Je ne connais pas le mot anglais, mais c'est une sorte de…" }
        ]
      },
      {
        id: "disagree",
        title: "Entretien : ne pas être d'accord poliment",
        items: [
          { en: "I see your point, but I am not sure I agree.", fr: "Je comprends votre point de vue, mais je ne suis pas sûre d'être d'accord." },
          { en: "That is true to some extent; however, …", fr: "C'est vrai dans une certaine mesure ; cependant, …" },
          { en: "I would rather say that…", fr: "Je dirais plutôt que…" },
          { en: "With all due respect, I think that…", fr: "Sauf votre respect, je pense que…" },
          { en: "I understand why some people think so, but…", fr: "Je comprends pourquoi certains le pensent, mais…" },
          { en: "Yes, but we could also argue that…", fr: "Oui, mais on pourrait aussi soutenir que…" }
        ]
      },
      {
        id: "interact",
        title: "Entretien : relancer et interagir",
        items: [
          { en: "Yes, exactly. And I would add that…", fr: "Oui, exactement. Et j'ajouterais que…" },
          { en: "I hadn't thought about that, thank you.", fr: "Je n'y avais pas pensé, merci." },
          { en: "That is a good point. In fact, …", fr: "C'est juste. En fait, …" },
          { en: "Does that answer your question?", fr: "Est-ce que cela répond à votre question ?" },
          { en: "Let me give you a concrete example.", fr: "Laissez-moi vous donner un exemple concret." },
          { en: "To put it more simply, …", fr: "Pour le dire plus simplement, …" }
        ]
      }
    ],

    tones: [
      { en: "neutral", fr: "neutre" },
      { en: "informative", fr: "informatif" },
      { en: "objective", fr: "objectif" },
      { en: "factual", fr: "factuel" },
      { en: "balanced", fr: "équilibré, nuancé" },
      { en: "critical", fr: "critique" },
      { en: "ironic", fr: "ironique" },
      { en: "sarcastic", fr: "sarcastique" },
      { en: "humorous", fr: "humoristique" },
      { en: "optimistic", fr: "optimiste" },
      { en: "pessimistic", fr: "pessimiste" },
      { en: "worried / concerned", fr: "inquiet, préoccupé" },
      { en: "alarmist", fr: "alarmiste" },
      { en: "enthusiastic", fr: "enthousiaste" },
      { en: "sceptical", fr: "sceptique" },
      { en: "cautious", fr: "prudent" },
      { en: "persuasive", fr: "persuasif" },
      { en: "polemical", fr: "polémique" },
      { en: "indignant", fr: "indigné" },
      { en: "didactic", fr: "didactique, pédagogique" },
      { en: "admiring", fr: "admiratif" },
      { en: "nostalgic", fr: "nostalgique" }
    ],

    linking: [
      {
        group: "Ajouter",
        items: [
          { en: "moreover / furthermore", fr: "de plus" },
          { en: "in addition (to)", fr: "en outre, en plus (de)" },
          { en: "besides", fr: "par ailleurs" },
          { en: "not only… but also…", fr: "non seulement… mais aussi…" },
          { en: "as well as", fr: "ainsi que" },
          { en: "what is more", fr: "qui plus est" }
        ]
      },
      {
        group: "Opposer, concéder",
        items: [
          { en: "however", fr: "cependant" },
          { en: "on the other hand", fr: "d'un autre côté" },
          { en: "whereas / while", fr: "alors que, tandis que" },
          { en: "although / even though", fr: "bien que, même si (+ sujet + verbe)" },
          { en: "despite / in spite of (+ noun)", fr: "malgré (+ nom)" },
          { en: "nevertheless / nonetheless", fr: "néanmoins" },
          { en: "on the contrary", fr: "au contraire" }
        ]
      },
      {
        group: "Cause",
        items: [
          { en: "because (+ clause)", fr: "parce que (+ proposition)" },
          { en: "because of / due to (+ noun)", fr: "à cause de, en raison de (+ nom)" },
          { en: "since / as", fr: "puisque, comme" },
          { en: "owing to", fr: "en raison de" },
          { en: "this is why", fr: "c'est pourquoi" }
        ]
      },
      {
        group: "Conséquence",
        items: [
          { en: "so", fr: "donc" },
          { en: "therefore / thus", fr: "par conséquent, ainsi" },
          { en: "as a result / as a consequence", fr: "en conséquence" },
          { en: "consequently", fr: "par conséquent" },
          { en: "this leads to", fr: "cela entraîne" },
          { en: "hence", fr: "d'où" }
        ]
      },
      {
        group: "But",
        items: [
          { en: "to / in order to (+ verb)", fr: "pour, afin de (+ verbe)" },
          { en: "so as to / so as not to", fr: "de façon à / de façon à ne pas" },
          { en: "so that (+ clause)", fr: "pour que, afin que" },
          { en: "with a view to (+ -ing)", fr: "en vue de" },
          { en: "the aim is to", fr: "l'objectif est de" }
        ]
      },
      {
        group: "Illustrer, structurer, conclure",
        items: [
          { en: "for instance / for example", fr: "par exemple" },
          { en: "such as", fr: "tel que, comme" },
          { en: "firstly / secondly / finally", fr: "premièrement / deuxièmement / enfin" },
          { en: "in other words", fr: "autrement dit" },
          { en: "as far as … is concerned", fr: "en ce qui concerne…" },
          { en: "to sum up / all in all", fr: "en résumé / somme toute" },
          { en: "in a nutshell", fr: "en un mot" }
        ]
      }
    ],

    themes: [
      {
        id: 1,
        title: "Finance",
        fr: "Finance",
        vocab: [
          { en: "a bank / a lender", fr: "une banque / un prêteur" },
          { en: "a loan / to borrow / to lend", fr: "un prêt / emprunter / prêter" },
          { en: "interest rate", fr: "taux d'intérêt" },
          { en: "a central bank", fr: "une banque centrale" },
          { en: "a share (UK) / a stock (US)", fr: "une action" },
          { en: "a shareholder / stockholder", fr: "un actionnaire" },
          { en: "a bond / bondholder", fr: "une obligation / un obligataire" },
          { en: "a dividend", fr: "un dividende" },
          { en: "the stock market / stock exchange", fr: "la Bourse" },
          { en: "to go public / an IPO (initial public offering)", fr: "entrer en Bourse / une introduction en Bourse" },
          { en: "venture capital / a venture capitalist", fr: "capital-risque / un investisseur en capital-risque" },
          { en: "a start-up / a unicorn", fr: "une jeune pousse / une licorne (valorisée > 1 Md$)" },
          { en: "private equity", fr: "capital-investissement" },
          { en: "a derivative / futures / options", fr: "un produit dérivé / contrats à terme / options" },
          { en: "hedging / to hedge against a risk", fr: "couverture / se couvrir contre un risque" },
          { en: "an asset / a liability", fr: "un actif / un passif, une dette" },
          { en: "a bubble / a crash", fr: "une bulle / un krach" },
          { en: "a bull market / a bear market", fr: "un marché haussier / baissier" },
          { en: "inflation / deflation", fr: "inflation / déflation" },
          { en: "a recession / a downturn", fr: "une récession / un ralentissement" },
          { en: "exchange rate / currency", fr: "taux de change / devise" },
          { en: "a stablecoin / cryptocurrency", fr: "un stablecoin / une cryptomonnaie" },
          { en: "financial disclosure", fr: "publication d'informations financières" },
          { en: "a regulator / regulation", fr: "un régulateur / la réglementation" },
          { en: "to raise funds / capital", fr: "lever des fonds / des capitaux" },
          { en: "a portfolio", fr: "un portefeuille (de titres)" },
          { en: "a tariff / customs duties", fr: "un droit de douane" },
          { en: "a refund", fr: "un remboursement" }
        ],
        facts: [
          "Banks transform short-term deposits into long-term loans: this maturity transformation creates risk.",
          "A bond is a debt security: the issuer pays interest (the coupon) and repays the principal at maturity.",
          "When interest rates rise, existing bond prices fall.",
          "Venture capital funds young, risky companies in exchange for equity; most investments fail, a few generate huge returns.",
          "Derivatives can reduce risk (hedging) or increase it (speculation), as the 2008 crisis showed.",
          "International financial markets are interconnected: a shock in New York spreads quickly to Paris or Tokyo.",
          "Listed companies must disclose reliable financial information so that investors can make decisions.",
          "Stablecoins are crypto-assets pegged to a currency such as the dollar; their regulation (GENIUS Act, MiCA) is a hot topic."
        ],
        debates: [
          "Is the current enthusiasm for AI stocks a new financial bubble?",
          "Should stablecoins be regulated like banks?",
          "Do tariffs protect domestic companies or simply make consumers pay more?",
          "Is venture capital the best way to finance innovation in Europe?",
          "Should banks be forced to stop financing fossil fuels?"
        ]
      },
      {
        id: 2,
        title: "Accounting & auditing",
        fr: "Comptabilité & audit",
        vocab: [
          { en: "an accountant / accountancy (UK), accounting (US)", fr: "un comptable / la comptabilité" },
          { en: "financial statements", fr: "états financiers" },
          { en: "the balance sheet", fr: "le bilan" },
          { en: "the income statement / profit and loss account", fr: "le compte de résultat" },
          { en: "the cash-flow statement", fr: "le tableau des flux de trésorerie" },
          { en: "the annual report", fr: "le rapport annuel" },
          { en: "revenue / turnover (UK)", fr: "chiffre d'affaires" },
          { en: "earnings / net income / profit", fr: "bénéfice, résultat net" },
          { en: "a loss", fr: "une perte" },
          { en: "equity", fr: "capitaux propres" },
          { en: "depreciation / amortisation", fr: "amortissement (corporel / incorporel)" },
          { en: "intangible assets / goodwill", fr: "actifs incorporels / écart d'acquisition" },
          { en: "accounting standards (IFRS, US GAAP)", fr: "normes comptables (IFRS, US GAAP)" },
          { en: "fair value", fr: "juste valeur" },
          { en: "an auditor / to audit the accounts", fr: "un auditeur, commissaire aux comptes / auditer les comptes" },
          { en: "internal audit / external audit", fr: "audit interne / audit externe" },
          { en: "the Big Four (Deloitte, PwC, EY, KPMG)", fr: "les quatre grands cabinets d'audit" },
          { en: "a qualified / unqualified opinion", fr: "une opinion avec réserves / sans réserve" },
          { en: "a fraud / creative accounting", fr: "une fraude / comptabilité créative" },
          { en: "internal control", fr: "contrôle interne" },
          { en: "management control / controlling", fr: "contrôle de gestion" },
          { en: "a budget / variance analysis", fr: "un budget / analyse des écarts" },
          { en: "key performance indicator (KPI)", fr: "indicateur clé de performance" },
          { en: "a dashboard", fr: "un tableau de bord" },
          { en: "a conflict of interest", fr: "un conflit d'intérêts" },
          { en: "sustainability reporting", fr: "reporting de durabilité, extra-financier" }
        ],
        facts: [
          "IFRS are issued by the IASB and are mandatory for the consolidated accounts of EU listed groups since 2005.",
          "Intangible assets (brands, patents, software, data) represent a growing share of company value but are hard to measure.",
          "External auditors give an independent opinion on whether the accounts give a true and fair view.",
          "Internal audit works for the company itself and checks processes, risks and internal control.",
          "The Big Four dominate the audit of large listed companies, which raises concerns about competition and independence.",
          "Management control turns strategy into budgets, KPIs and dashboards.",
          "AI tools are changing audit: they can analyse 100% of transactions instead of samples."
        ],
        debates: [
          "Will AI replace junior auditors and accountants?",
          "Should audit and consulting activities be separated in the Big Four?",
          "Can intangible assets ever be measured reliably on the balance sheet?",
          "Is non-financial (sustainability) reporting as important as financial reporting?",
          "Are auditors responsible when a fraud is not detected?"
        ]
      },
      {
        id: 3,
        title: "Governance & CSR",
        fr: "Gouvernance & RSE",
        vocab: [
          { en: "corporate governance", fr: "gouvernance d'entreprise" },
          { en: "the board of directors", fr: "le conseil d'administration" },
          { en: "a non-executive / independent director", fr: "un administrateur indépendant" },
          { en: "the CEO (chief executive officer)", fr: "le directeur général, PDG" },
          { en: "the chair(man/woman) of the board", fr: "le président du conseil" },
          { en: "a stakeholder", fr: "une partie prenante" },
          { en: "a shareholder meeting / AGM", fr: "une assemblée générale" },
          { en: "agency theory / the principal-agent problem", fr: "théorie de l'agence / problème principal-agent" },
          { en: "executive pay / a bonus", fr: "la rémunération des dirigeants / une prime" },
          { en: "accountability / transparency", fr: "responsabilité, obligation de rendre des comptes / transparence" },
          { en: "a trade union / labour union (US)", fr: "un syndicat" },
          { en: "a strike / collective bargaining", fr: "une grève / la négociation collective" },
          { en: "corporate social responsibility (CSR)", fr: "responsabilité sociétale des entreprises (RSE)" },
          { en: "ISO 26000", fr: "norme ISO 26000 (lignes directrices RSE)" },
          { en: "ESG (environmental, social and governance) criteria", fr: "critères ESG" },
          { en: "sustainability / sustainable", fr: "durabilité / durable" },
          { en: "greenwashing", fr: "écoblanchiment" },
          { en: "due diligence", fr: "devoir de vigilance, diligence raisonnable" },
          { en: "carbon footprint / emissions", fr: "empreinte carbone / émissions" },
          { en: "a whistle-blower", fr: "un lanceur d'alerte" },
          { en: "business ethics / a code of conduct", fr: "éthique des affaires / un code de conduite" },
          { en: "a watchdog", fr: "un organisme de surveillance" },
          { en: "compliance", fr: "conformité" },
          { en: "red tape / administrative burden", fr: "paperasserie / charge administrative" },
          { en: "to comply with a law", fr: "se conformer à une loi" }
        ],
        facts: [
          "Agency theory: managers (agents) may not act in the interest of shareholders (principals); governance tools try to align them.",
          "Shareholder model (profit first) versus stakeholder model (employees, clients, suppliers, society).",
          "ISO 26000 gives guidelines on social responsibility, but it is not a certification standard.",
          "In France, the PACTE law (2019) created the « société à mission » and redefined the purpose of companies.",
          "The EU Omnibus I package (2026) reduced the scope of the CSRD and CSDDD to the largest companies.",
          "Trade unions are strong in Germany (co-determination on boards) and weaker in the US and the UK private sector."
        ],
        debates: [
          "Is the EU Omnibus a necessary simplification or a step back for sustainability?",
          "Should employees sit on the board of directors?",
          "Is CSR a real commitment or a marketing tool?",
          "Are CEOs paid too much compared with their employees?",
          "Can ESG investing really change company behaviour?"
        ]
      },
      {
        id: 4,
        title: "Information systems & new technologies",
        fr: "Systèmes d'information & nouvelles technologies",
        vocab: [
          { en: "an information system", fr: "un système d'information" },
          { en: "ERP (enterprise resource planning)", fr: "PGI, progiciel de gestion intégré" },
          { en: "big data / data analytics", fr: "mégadonnées / analyse de données" },
          { en: "cloud computing / to store data in the cloud", fr: "informatique en nuage / stocker des données dans le cloud" },
          { en: "artificial intelligence (AI) / generative AI", fr: "intelligence artificielle / IA générative" },
          { en: "machine learning / an algorithm", fr: "apprentissage automatique / un algorithme" },
          { en: "a chatbot / an AI agent", fr: "un agent conversationnel / un agent IA" },
          { en: "automation / to automate tasks", fr: "automatisation / automatiser des tâches" },
          { en: "cybersecurity / a cyberattack", fr: "cybersécurité / une cyberattaque" },
          { en: "ransomware / phishing", fr: "rançongiciel / hameçonnage" },
          { en: "a data breach / a leak", fr: "une violation de données / une fuite" },
          { en: "data protection / GDPR", fr: "protection des données / RGPD" },
          { en: "privacy", fr: "vie privée, confidentialité" },
          { en: "Big Tech / tech giants", fr: "les géants de la tech (GAFAM)" },
          { en: "a platform / a marketplace", fr: "une plateforme / une place de marché" },
          { en: "a monopoly / antitrust", fr: "un monopole / droit de la concurrence" },
          { en: "a data centre", fr: "un centre de données" },
          { en: "a chip / semiconductor", fr: "une puce / un semi-conducteur" },
          { en: "teleworking / remote work / working from home", fr: "télétravail" },
          { en: "hybrid work", fr: "travail hybride" },
          { en: "digital transformation", fr: "transformation numérique" },
          { en: "software / an app / a device", fr: "logiciel / une application / un appareil" },
          { en: "to upgrade / to implement a system", fr: "mettre à niveau / mettre en place un système" },
          { en: "a blockchain", fr: "une chaîne de blocs" },
          { en: "the digital divide", fr: "la fracture numérique" }
        ],
        facts: [
          "An ERP integrates all company functions (finance, HR, supply chain, sales) in one database.",
          "The « Magnificent 7 » (Apple, Microsoft, Alphabet, Amazon, Meta, Nvidia, Tesla) weigh heavily in US stock indices.",
          "Big Tech companies spend hundreds of billions of dollars on AI data centres.",
          "The EU regulates technology through the GDPR (data), the DMA and DSA (platforms) and the AI Act.",
          "Cyberattacks, especially ransomware, can stop production and cost millions.",
          "Since the Covid-19 pandemic, hybrid work has become common, but some firms now order staff back to the office."
        ],
        debates: [
          "Will AI destroy more jobs than it creates?",
          "Is Europe too dependent on American Big Tech and cloud providers?",
          "Should companies force employees to return to the office?",
          "Does regulation (AI Act, GDPR) slow down innovation in Europe?",
          "Who should be responsible when an AI makes a mistake?"
        ]
      },
      {
        id: 5,
        title: "Management, HR & strategy",
        fr: "Management, RH & stratégie",
        vocab: [
          { en: "human resources (HR)", fr: "ressources humaines" },
          { en: "to recruit / to hire / recruitment", fr: "recruter / embaucher / recrutement" },
          { en: "a job interview / an applicant", fr: "un entretien d'embauche / un candidat" },
          { en: "to fire / to lay off / redundancies", fr: "licencier / licencier (économique) / licenciements" },
          { en: "skills / soft skills / hard skills", fr: "compétences / savoir-être / savoir-faire" },
          { en: "training / upskilling / reskilling", fr: "formation / montée en compétences / reconversion" },
          { en: "staff / workforce / employees", fr: "personnel / main-d'œuvre / salariés" },
          { en: "diversity, equity and inclusion (DEI)", fr: "diversité, équité et inclusion" },
          { en: "the gender pay gap", fr: "l'écart de rémunération femmes-hommes" },
          { en: "the glass ceiling", fr: "le plafond de verre" },
          { en: "internal communication", fr: "communication interne" },
          { en: "corporate culture", fr: "culture d'entreprise" },
          { en: "management across cultures / cultural differences", fr: "management interculturel / différences culturelles" },
          { en: "a hierarchy / a flat structure", fr: "une hiérarchie / une structure plate" },
          { en: "an organisation chart", fr: "un organigramme" },
          { en: "a subsidiary / headquarters", fr: "une filiale / le siège" },
          { en: "a non-profit organisation (NPO) / an NGO", fr: "une association, organisme à but non lucratif / une ONG" },
          { en: "a growth strategy", fr: "une stratégie de croissance" },
          { en: "a merger / an acquisition / a takeover", fr: "une fusion / une acquisition / un rachat" },
          { en: "organic growth / external growth", fr: "croissance interne / externe" },
          { en: "a joint venture / a strategic alliance", fr: "une coentreprise / une alliance stratégique" },
          { en: "coopetition", fr: "coopétition (coopérer avec un concurrent)" },
          { en: "a competitor / competitive advantage", fr: "un concurrent / avantage concurrentiel" },
          { en: "market share", fr: "part de marché" },
          { en: "burnout / well-being at work", fr: "épuisement professionnel / bien-être au travail" },
          { en: "staff turnover / employee retention", fr: "rotation du personnel / fidélisation des salariés" }
        ],
        facts: [
          "Hofstede's cultural dimensions (power distance, individualism…) help explain management differences between countries.",
          "Growth strategies: organic growth, mergers and acquisitions, alliances, internationalisation, diversification.",
          "Coopetition: competitors cooperate on some activities (e.g. car makers sharing battery research).",
          "In 2025, several US companies scaled back their DEI programmes under political pressure, while EU rules (pay transparency directive) go the other way.",
          "Non-profit organisations must be managed efficiently too: funding, volunteers, impact measurement.",
          "Skills shortages and AI push companies to invest in reskilling."
        ],
        debates: [
          "Are DEI policies good for business or just good for image?",
          "Is external growth (mergers) better than organic growth?",
          "Can a manager use the same style in France, the US and Japan?",
          "Should companies hire for skills rather than diplomas?",
          "Can competitors really trust each other in a coopetition strategy?"
        ]
      },
      {
        id: 6,
        title: "Production",
        fr: "Production",
        vocab: [
          { en: "the supply chain", fr: "la chaîne d'approvisionnement" },
          { en: "a supplier / a subcontractor", fr: "un fournisseur / un sous-traitant" },
          { en: "procurement / purchasing", fr: "achats, approvisionnement" },
          { en: "logistics / a warehouse", fr: "logistique / un entrepôt" },
          { en: "inventory / stock", fr: "stocks" },
          { en: "just-in-time (JIT)", fr: "juste-à-temps, flux tendu" },
          { en: "lean manufacturing", fr: "production allégée (lean)" },
          { en: "a shortage / a bottleneck", fr: "une pénurie / un goulet d'étranglement" },
          { en: "a disruption", fr: "une perturbation, rupture" },
          { en: "offshoring / reshoring / nearshoring", fr: "délocalisation / relocalisation / délocalisation de proximité" },
          { en: "outsourcing", fr: "externalisation" },
          { en: "total quality management (TQM)", fr: "management de la qualité totale" },
          { en: "continuous improvement (kaizen)", fr: "amélioration continue" },
          { en: "a defect / a product recall", fr: "un défaut / un rappel de produit" },
          { en: "ISO 9001 certification", fr: "certification ISO 9001 (qualité)" },
          { en: "research and development (R&D)", fr: "recherche et développement" },
          { en: "an innovation / a patent", fr: "une innovation / un brevet" },
          { en: "a prototype", fr: "un prototype" },
          { en: "a plant / a factory", fr: "une usine" },
          { en: "productivity / output", fr: "productivité / production" },
          { en: "the circular economy / recycling", fr: "économie circulaire / recyclage" },
          { en: "waste / to reduce waste", fr: "déchets / réduire les déchets" },
          { en: "raw materials / rare earths", fr: "matières premières / terres rares" },
          { en: "carbon neutral / net zero", fr: "neutre en carbone / zéro émission nette" },
          { en: "freight / shipping", fr: "fret / transport maritime" },
          { en: "customs / import / export", fr: "douane / importation / exportation" }
        ],
        facts: [
          "Covid-19, the war in Ukraine and US tariffs showed how fragile global supply chains are.",
          "Companies move from « just-in-time » to « just-in-case »: more stock, more suppliers.",
          "TQM involves all employees in quality and aims at « zero defects ».",
          "Reshoring and nearshoring bring production closer to customers, but costs are higher.",
          "China controls most of the processing of rare earths, which are vital for electronics and batteries.",
          "The circular economy aims to keep products and materials in use as long as possible."
        ],
        debates: [
          "Should Europe bring its factories back home?",
          "Is « just-in-time » still a good model after so many crises?",
          "Can production be both cheap and environmentally friendly?",
          "Will robots and AI make factory workers disappear?",
          "Who is responsible for working conditions at suppliers' factories?"
        ]
      },
      {
        id: 7,
        title: "Marketing",
        fr: "Marketing",
        vocab: [
          { en: "a brand / brand awareness / brand image", fr: "une marque / notoriété / image de marque" },
          { en: "brand loyalty", fr: "fidélité à la marque" },
          { en: "a target / a target audience", fr: "une cible / un public cible" },
          { en: "market research / a survey", fr: "étude de marché / une enquête" },
          { en: "a market segment / niche", fr: "un segment / une niche" },
          { en: "the marketing mix (4Ps: product, price, place, promotion)", fr: "le marketing mix (4P)" },
          { en: "the product life cycle (launch, growth, maturity, decline)", fr: "cycle de vie du produit (lancement, croissance, maturité, déclin)" },
          { en: "to launch a product / a launch", fr: "lancer un produit / un lancement" },
          { en: "advertising / an advert, ad / a commercial", fr: "publicité / une annonce / un spot TV" },
          { en: "an advertising campaign", fr: "une campagne publicitaire" },
          { en: "a slogan / a logo", fr: "un slogan / un logo" },
          { en: "viral marketing / word of mouth", fr: "marketing viral / bouche-à-oreille" },
          { en: "an influencer / influencer marketing", fr: "un influenceur / marketing d'influence" },
          { en: "social networks / social media", fr: "réseaux sociaux" },
          { en: "a follower / engagement", fr: "un abonné / l'engagement" },
          { en: "targeted advertising", fr: "publicité ciblée" },
          { en: "cookies / personal data / consent", fr: "cookies / données personnelles / consentement" },
          { en: "e-commerce / online shopping", fr: "commerce en ligne" },
          { en: "a customer / a consumer", fr: "un client / un consommateur" },
          { en: "customer relationship management (CRM)", fr: "gestion de la relation client" },
          { en: "pricing / a discount", fr: "fixation des prix / une remise" },
          { en: "a premium / low-cost brand", fr: "une marque haut de gamme / à bas prix" },
          { en: "a competitor / a rival brand", fr: "un concurrent / une marque rivale" },
          { en: "a boycott / a backlash / a social media storm", fr: "un boycott / un tollé, une polémique (le « bad buzz » français)" },
          { en: "packaging", fr: "emballage, conditionnement" },
          { en: "storytelling", fr: "mise en récit" }
        ],
        facts: [
          "The product life cycle has four stages: launch, growth, maturity and decline; marketing changes at each stage.",
          "Viral marketing relies on users sharing content, which is cheap but hard to control.",
          "Influencer marketing is now regulated in France (law of June 2023).",
          "Targeted advertising uses personal data; the GDPR requires users' consent for cookies.",
          "Social media allow brands to talk directly to consumers but also expose them to a quick backlash.",
          "Brands are a key intangible asset: some are worth more than the factories that make the products."
        ],
        debates: [
          "Is targeted advertising a fair exchange for free online services?",
          "Should influencer marketing be more strictly regulated?",
          "Can a brand survive a social media scandal?",
          "Is advertising to children acceptable?",
          "Does green marketing help the planet or only sales?"
        ]
      }
    ],

    news: [
      {
        title: "La Cour suprême annule les droits de douane « IEEPA »",
        date: "20/02/2026",
        summary: "Dans l'affaire Learning Resources v. Trump, la Cour suprême des États-Unis a jugé (6 voix contre 3) que la loi IEEPA ne permettait pas au président d'imposer ces droits de douane. Les remboursements aux importateurs sont estimés entre 142 et 170 milliards de dollars.",
        en: "In February 2026, the US Supreme Court ruled, by six votes to three, that the President could not use emergency powers to impose tariffs, which could mean refunds of up to 170 billion dollars for importers.",
        themes: [1, 6, 3]
      },
      {
        title: "Une surtaxe temporaire de 10 % pour remplacer les droits annulés",
        date: "Février 2026",
        summary: "Après la décision de la Cour suprême, l'administration américaine a instauré une surtaxe générale de 10 % sur les importations sur la base de la « Section 122 » du Trade Act de 1974, un outil temporaire : la loi le limite à 150 jours, sauf prolongation par le Congrès (vérifiez où en est ce droit le jour J). Les entreprises restent donc dans l'incertitude sur le coût de leurs chaînes d'approvisionnement.",
        en: "In February 2026, the tariffs were replaced by a temporary ten percent global tariff under Section 122, limited by law to 150 days unless Congress extends it, so uncertainty remains for companies that depend on global supply chains.",
        themes: [6, 1, 5]
      },
      {
        title: "La crainte d'une bulle de l'IA",
        date: "2025-2026",
        summary: "Les « Magnificent 7 » (Apple, Microsoft, Alphabet, Amazon, Meta, Nvidia, Tesla) pèsent une part record des indices boursiers américains, portés par les investissements massifs dans l'IA. De nombreux analystes comparent la situation à la bulle internet de 2000 et s'interrogent sur la rentabilité réelle de ces dépenses.",
        en: "Many analysts fear an AI bubble: the Magnificent Seven now represent a huge share of the US stock market, but it is still unclear whether their massive AI investments will pay off.",
        themes: [1, 4]
      },
      {
        title: "L'IA, l'emploi et l'audit",
        date: "2025-2026",
        summary: "Les grands cabinets d'audit et de conseil utilisent l'IA pour analyser toutes les transactions, rédiger et contrôler. Ils recrutent moins de juniors, ce qui pose la question de la formation des futurs auditeurs.",
        en: "The Big Four are using AI to analyse whole sets of transactions, and they are hiring fewer graduates, which raises the question of how future auditors will be trained.",
        themes: [2, 4, 5]
      },
      {
        title: "Omnibus I : la CSRD réduite aux plus grandes entreprises",
        date: "18/03/2026",
        summary: "La directive (UE) 2026/470, dite « Omnibus I », en vigueur depuis le 18 mars 2026, limite le reporting de durabilité (CSRD) aux entreprises de plus de 1 000 salariés et 450 millions d'euros de chiffre d'affaires. Bruxelles parle de simplification, les ONG d'un recul.",
        en: "Since March 2026, the EU Omnibus directive limits sustainability reporting to companies with more than one thousand employees and 450 million euros of turnover: Brussels calls it simplification, critics call it a step back.",
        themes: [3, 2]
      },
      {
        title: "Devoir de vigilance européen (CSDDD) allégé",
        date: "18/03/2026",
        summary: "Le même paquet Omnibus réserve le devoir de vigilance (CSDDD) aux groupes de plus de 5 000 salariés et 1,5 milliard d'euros de chiffre d'affaires. Beaucoup moins d'entreprises devront contrôler les droits humains et l'environnement chez leurs fournisseurs.",
        en: "The same package restricts the due diligence directive to groups with over five thousand employees and 1.5 billion euros in turnover, so far fewer companies will have to check human rights in their supply chains.",
        themes: [3, 6]
      },
      {
        title: "GENIUS Act : les stablecoins encadrés aux États-Unis",
        date: "Juillet 2025",
        summary: "Le GENIUS Act, signé en juillet 2025, crée le premier cadre fédéral pour les stablecoins : réserves en dollars ou titres sûrs, audits et transparence. Il légitime ces actifs, mais certains craignent une concurrence pour les banques.",
        en: "In July 2025, the US adopted the GENIUS Act, the first federal framework for stablecoins, which will have to be fully backed by safe assets such as dollars or Treasury bills once the rules take effect, by early 2027 at the latest.",
        themes: [1, 4]
      },
      {
        title: "MiCA : le cadre européen des cryptoactifs",
        date: "2024-2026",
        summary: "Le règlement MiCA s'applique pleinement dans l'UE depuis fin 2024, avec une période transitoire pour les prestataires qui s'achève en 2026. L'Europe a donc régulé les cryptoactifs avant les États-Unis, avec une approche plus prudente.",
        en: "In the EU, the MiCA regulation already supervises crypto-assets and stablecoins, which shows that Europe chose to regulate before the United States.",
        themes: [1, 4, 3]
      },
      {
        title: "Retour au bureau contre télétravail",
        date: "2025",
        summary: "Plusieurs grands groupes, comme Amazon depuis janvier 2025, ont imposé le retour au bureau cinq jours par semaine. D'autres entreprises gardent le travail hybride pour attirer et fidéliser les talents.",
        en: "Since January 2025, some large firms such as Amazon have required staff to come back to the office five days a week, while others keep hybrid work to attract talent.",
        themes: [5, 4]
      },
      {
        title: "AI Act européen : une mise en œuvre progressive",
        date: "2025-2026",
        summary: "Les obligations de l'AI Act pour les modèles d'IA à usage général s'appliquent depuis août 2025 ; celles des systèmes « à haut risque » arrivent ensuite, avec un calendrier que la Commission a proposé d'assouplir fin 2025. Le débat oppose protection des citoyens et compétitivité.",
        en: "The EU AI Act has applied to general-purpose AI models since August 2025, but the Commission has proposed delaying some rules, which shows the tension between protection and competitiveness.",
        themes: [4, 3]
      }
    ],

    errors: [
      { title: "Le -s de la 3e personne", wrong: "The author explain that banks take risks.", right: "The author explains that banks take risks.", tip: "He / she / it / the author / the company → verbe + s. Le dire en appuyant sur le « s » final." },
      { title: "Le -ed du passé", wrong: "The company launch the product in 2024.", right: "The company launched the product in 2024.", tip: "Dès qu'il y a une date passée → prétérit. Prononcer le -ed : /t/ (launched), /d/ (closed), /ɪd/ (created)." },
      { title: "Présent perfect vs prétérit", wrong: "Since 2020, the firm grew a lot.", right: "Since 2020, the firm has grown a lot.", tip: "« Since / for / over the last few years » → present perfect. Date précise et terminée → prétérit." },
      { title: "Depuis : since / for", wrong: "The rule exists since three years.", right: "The rule has existed for three years.", tip: "For + durée, since + point de départ, et le verbe au present perfect." },
      { title: "« Informations », « advices »", wrong: "The article gives many informations and advices.", right: "The article gives a lot of information and advice.", tip: "Information, advice, research, news, evidence, equipment : indénombrables, jamais de -s." },
      { title: "« Make / do »", wrong: "Companies must do efforts to reduce emissions.", right: "Companies must make efforts to reduce emissions.", tip: "Make an effort, make a decision, make a profit, make a mistake ; do business, do research." },
      { title: "Le discours indirect", wrong: "The CEO said that he will cut jobs.", right: "The CEO said that he would cut jobs.", tip: "Verbe introducteur au passé → concordance recommandée (will → would, is → was, can → could) ; « will » reste possible si c’est toujours vrai ou encore à venir." },
      { title: "La forme interrogative", wrong: "Why companies need auditors?", right: "Why do companies need auditors?", tip: "Question = auxiliaire (do / does / did) avant le sujet." },
      { title: "La négation", wrong: "The author don't agree with this policy.", right: "The author doesn't agree with this policy.", tip: "Avec he / she / it : doesn't + base verbale (sans -s)." },
      { title: "Le passif", wrong: "The law was vote in March.", right: "The law was passed in March. / The law was adopted in March.", tip: "Passif = be + participe passé. Pour les lois : was passed, was adopted, came into force ; éviter « was voted » (calque de « a été votée »)." },
      { title: "Les chiffres", wrong: "One thousand millions dollars / 10,5 %", right: "One billion dollars / ten point five percent (10.5%)", tip: "Billion = milliard. Virgule française = point anglais. « Dollars » au pluriel, mais « a 10-million-dollar loan »." },
      { title: "Les dates", wrong: "The 20 February of 2026", right: "On the twentieth of February 2026 / On February the twentieth, 2026", tip: "« On » + date, « in » + mois ou année, « in the 2020s » pour une décennie." },
      { title: "Les prépositions", wrong: "It depends of the company. / Interested by AI.", right: "It depends on the company. / Interested in AI.", tip: "Depend on, interested in, responsible for, focus on, invest in, agree with someone / on something." },
      { title: "Les relatifs", wrong: "The company who I work for… / The firms which they invest in AI…", right: "The company that I work for… / The firms which invest in AI…", tip: "Who pour les personnes, which / that pour les choses ; ne pas répéter le sujet après le relatif." },
      { title: "Les faux amis", wrong: "Actually, the inflation is high. / The firm will realise a benefit.", right: "Currently, inflation is high. / The firm will make a profit.", tip: "Actually = en fait ; eventually = finalement ; benefit = avantage ; profit = bénéfice ; to realise = se rendre compte." },
      { title: "Le but : « for + verbe »", wrong: "Firms use AI for reduce costs.", right: "Firms use AI to reduce costs.", tip: "But = to + verbe (ou in order to). « For » + nom ou -ing : « for cost reduction »." },
      { title: "Les modaux", wrong: "Companies must to publish their accounts. / They can to invest.", right: "Companies must publish their accounts. / They can invest.", tip: "Après must, can, should, may, might, will, would : base verbale sans « to »." }
    ],

    pronunciation: [
      { word: "written", ipa: "/ˈrɪtn/", tip: "« ritn » : le w est muet, le i est court, pas de « è » final." },
      { word: "author", ipa: "/ˈɔːθə/", tip: "« o-the » : th soufflé (langue entre les dents), accent sur la 1re syllabe." },
      { word: "journalist", ipa: "/ˈdʒɜːnəlɪst/", tip: "Commence par « dj », comme « jeans ». Accent sur la 1re syllabe : « DJEU-na-list »." },
      { word: "firms", ipa: "/fɜːmz/", tip: "Son « eu » long, pas « firme ». Bien dire le -s final /z/." },
      { word: "measure", ipa: "/ˈmeʒə/", tip: "« mèje » : le s se dit comme le j de « jour »." },
      { word: "policy", ipa: "/ˈpɒləsi/", tip: "Accent sur la 1re syllabe : PO-li-cy, pas po-li-CY." },
      { word: "company", ipa: "/ˈkʌmpəni/", tip: "Le o se dit « a » : « KAM-pe-ni »." },
      { word: "business", ipa: "/ˈbɪznəs/", tip: "Deux syllabes seulement : « BIZ-nes »." },
      { word: "economy", ipa: "/ɪˈkɒnəmi/", tip: "Accent sur la 2e syllabe : i-CO-no-my." },
      { word: "economic", ipa: "/ˌiːkəˈnɒmɪk/", tip: "Accent sur « NO » : i-ko-NO-mic. Il change de place par rapport à economy." },
      { word: "determine", ipa: "/dɪˈtɜːmɪn/", tip: "Fin en « min », pas en « maïn »." },
      { word: "purpose", ipa: "/ˈpɜːpəs/", tip: "« PEU-pes » : la fin ne se prononce pas « pose »." },
      { word: "focus", ipa: "/ˈfəʊkəs/", tip: "« FO-kes », le o se dit « éo »." },
      { word: "increase (noun)", ipa: "/ˈɪŋkriːs/", tip: "Nom : accent au début (an INcrease). Verbe : accent à la fin (to inCREASE)." },
      { word: "data", ipa: "/ˈdeɪtə/", tip: "« DÉÏ-ta » (britannique) ; « DA-ta » existe aussi en américain." },
      { word: "analysis", ipa: "/əˈnæləsɪs/", tip: "Accent sur la 2e syllabe : a-NA-ly-sis." },
      { word: "finance", ipa: "/ˈfaɪnæns/", tip: "« FAÏ-nanss » : le i se dit « aï »." },
      { word: "industry", ipa: "/ˈɪndəstri/", tip: "Accent au début : IN-dus-try, pas in-DUS-try." },
      { word: "average", ipa: "/ˈævərɪdʒ/", tip: "Trois syllabes, fin en « idj »." },
      { word: "debt", ipa: "/det/", tip: "Le b est muet : « dett »." },
      { word: "law", ipa: "/lɔː/", tip: "« lo » long, pas « lav » ni « lao »." },
      { word: "sustainable", ipa: "/səˈsteɪnəbl/", tip: "Accent sur « STAI » : su-STAI-na-ble." },
      { word: "strategy", ipa: "/ˈstrætədʒi/", tip: "Accent au début : STRA-te-gy." },
      { word: "technology", ipa: "/tekˈnɒlədʒi/", tip: "Accent sur « NO » : tech-NO-lo-gy." },
      { word: "through", ipa: "/θruː/", tip: "Un seul son : « throu », avec th soufflé. Le -gh est muet." },
      { word: "thought", ipa: "/θɔːt/", tip: "« thot » : le -gh est muet." },
      { word: "women", ipa: "/ˈwɪmɪn/", tip: "« WI-min » : le o se dit « i »." },
      { word: "issue", ipa: "/ˈɪʃuː/", tip: "« I-chou », pas « i-ssiou »." },
      { word: "hierarchy", ipa: "/ˈhaɪərɑːki/", tip: "h aspiré, « HAÏ-e-ra-ki », le ch se dit « k »." },
      { word: "audit", ipa: "/ˈɔːdɪt/", tip: "« O-dit », le t final se prononce." },
      { word: "tariff", ipa: "/ˈtærɪf/", tip: "Accent sur la 1re syllabe : TA-riff." },
      { word: "percent", ipa: "/pəˈsent/", tip: "Accent sur « SENT » : per-CENT. Jamais de -s : « ten percent »." },
      { word: "colleague", ipa: "/ˈkɒliːɡ/", tip: "« KO-lig », le -ue final est muet." },
      { word: "comfortable", ipa: "/ˈkʌmftəbl/", tip: "Trois syllabes : « KAMF-te-bl »." }
    ],

    checklist: [
      {
        when: "La veille",
        items: [
          "Relire la méthode et les banques d'expressions (présenter le document, transition, conclure, interagir avec le jury).",
          "Relire l'actualité 2025-2026 et préparer une phrase en anglais par fait.",
          "Revoir à voix haute les mots pièges de prononciation (liste de la fiche).",
          "Imprimer la convocation et la mettre avec la pièce d'identité (obligatoires toutes les deux).",
          "Vérifier le mail avec le lien Teams (et les courriers indésirables) ; noter l'heure de connexion.",
          "Faire un test Teams complet : connexion, caméra, micro, haut-parleurs, partage d'écran si besoin.",
          "Choisir la pièce calme, bien éclairée (lumière face à soi), fond neutre ; prévenir l'entourage.",
          "Préparer le matériel : feuilles blanches, deux stylos, montre ou minuteur visible, bouteille d'eau.",
          "Charger l'ordinateur et prévoir le chargeur branché ; prévoir un partage de connexion du téléphone en secours.",
          "Libérer toute la demi-journée (passage par ordre d'arrivée).",
          "Se coucher tôt : pas de révision tard le soir."
        ]
      },
      {
        when: "Le matin",
        items: [
          "Petit-déjeuner, verre d'eau ; bouteille d'eau sur le bureau.",
          "Écouter 10 minutes d'anglais (radio, podcast économique) pour « chauffer » l'oreille et la bouche.",
          "Redémarrer l'ordinateur, fermer les autres applications, couper les notifications.",
          "Refaire un test rapide de Teams : caméra, micro, son.",
          "Pièce calme, porte fermée, entourage prévenu, animaux à l'écart.",
          "Sur le bureau : pièce d'identité, convocation imprimée, feuilles blanches, stylos, montre, eau. Rien d'autre (aucun dictionnaire, aucune note).",
          "Téléphone en silencieux, posé loin (mais accessible en cas de coupure de connexion).",
          "Se connecter dès 9:30 pour un oral à 10:00, puis patienter calmement : on peut attendre longtemps.",
          "Tenue correcte, comme pour un rendez-vous professionnel."
        ]
      },
      {
        when: "Pendant l'oral",
        items: [
          "Montrer la pièce d'identité et la convocation à la caméra si le jury le demande.",
          "Préparation : lire la question d'abord, suivre le découpage de l'heure, rédiger seulement intro, transition, conclusion.",
          "Noter l'heure de début de l'exposé ; viser 13-15 minutes, jamais moins de 10 (commentaire au moins 5).",
          "Ne pas oublier la synthèse et la faire avec ses propres mots, sans avis personnel.",
          "Annoncer la problématique et le plan clairement ; répondre vraiment à la question posée.",
          "Regarder la caméra, parler lentement, articuler les -s et -ed, bien dire les chiffres.",
          "Entretien : faire répéter si besoin, reformuler la question, répondre en 3 temps (réponse, justification, exemple).",
          "En cas de coupure : se reconnecter tout de suite et prévenir calmement.",
          "Si un mot manque : le contourner (« it is a kind of… ») plutôt que s'arrêter.",
          "Finir par « Thank you for your attention » puis remercier le jury à la fin de l'entretien."
        ]
      }
    ]
  };

})(window.AideVisio = window.AideVisio || {});
