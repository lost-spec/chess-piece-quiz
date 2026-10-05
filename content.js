const TEST = {
  title: "Which Chess Piece Are You?",
  intro: "Seven questions about meaning, control, equality, rules and loyalty. Answer honestly and the board will tell you which piece you are.",
  startButtonLabel: "Start the test",
  questionsPerRound: 3
};

const PIECES = [
  {
    id: "pawn",
    name: "The Pawn",
    glyph: "♙",
    tagline: "Quiet, steady, and underestimated until it is too late.",
    description: "You do the work nobody notices, and you keep moving. You stay loyal to the group, adapt to what you are given, and you are far stronger in a crowd than you think. People underestimate you because you never announce what you are doing."
  },
  {
    id: "knight",
    name: "The Knight",
    glyph: "♘",
    tagline: "Leaps before anyone expects you to.",
    description: "You do not think in straight lines. Your mind jumps to angles nobody else considered, and you would rather do it your own way than follow the obvious plan. You are independent, inventive and hard to pin down, and you work best with room to move."
  },
  {
    id: "bishop",
    name: "The Bishop",
    glyph: "♗",
    tagline: "Sees the long diagonal everyone else misses.",
    description: "You look past the obvious and read the pattern underneath it. Meaning, ethics, learning and long-term thinking matter more to you than quick wins. You commit to a direction early and you would rather lose a battle while staying on your square than win one by moving."
  },
  {
    id: "rook",
    name: "The Rook",
    glyph: "♖",
    tagline: "Straight lines, solid ground, no wasted motion.",
    description: "You are direct and practical. You want structure, clear goals and visible results, and you dislike anything that slows the plan down. You build things that last because you refuse to cut corners, and once you are rolling nothing moves you off the file."
  },
  {
    id: "queen",
    name: "The Queen",
    glyph: "♕",
    tagline: "Every direction at once, and no patience for standing still.",
    description: "You are versatile and hard to categorise. Whatever the situation needs, you can become it: the leader, the organiser, the one who actually gets things moving. You want to act, you want range, and you are not interested in being one small part of someone else's plan."
  },
  {
    id: "king",
    name: "The King",
    glyph: "♔",
    tagline: "The whole board depends on you staying upright.",
    description: "You carry the weight of the position. You think before you act, you protect the people around you, and you do not waste energy on moves that only look brave. Under pressure you are the calmest person in the room, which is exactly why everything depends on you."
  }
];

const QUESTIONS = [
  {
    text: "Do you believe life itself has a meaning or an inherent purpose?",
    options: [
      { text: "No, life has no inherent purpose or meaning.", points: { pawn: "", knight: "", bishop: "3", rook: "", queen: "", king: "3" } },
      { text: "It's true that life has no purpose, but that shouldn't affect the life of an individual.", points: { pawn: "", knight: "3", bishop: "", rook: "", queen: "3", king: "" } },
      { text: "Yes, I believe life has a purpose.", points: { pawn: "3", knight: "", bishop: "", rook: "3", queen: "", king: "" } }
    ]
  },
  {
    text: "Do you believe we have control over the decisions we make?",
    options: [
      { text: "Yes, we have absolute control over everything around us and our lives.", points: { pawn: "", knight: "", bishop: "", rook: "1", queen: "1", king: "1" } },
      { text: "Most of the decisions we make are affected by our surroundings and our conditions.", points: { pawn: "1", knight: "1", bishop: "1", rook: "", queen: "", king: "" } }
    ]
  },
  {
    text: "Do you believe all humans are equal?",
    options: [
      { text: "Every life has the same meaning. Our status or wealth doesn't define who we are.", points: { pawn: "2", knight: "", bishop: "", rook: "", queen: "2", king: "" } },
      { text: "A person's worth should be judged by what they have achieved in their life.", points: { pawn: "1", knight: "2", bishop: "2", rook: "2", queen: "", king: "2" } }
    ]
  },
  {
    text: "What matters most to you?",
    options: [
      { text: "Knowledge", points: { pawn: "", knight: "2", bishop: "2", rook: "", queen: "", king: "" } },
      { text: "Peace", points: { pawn: "2", knight: "", bishop: "", rook: "", queen: "2", king: "" } },
      { text: "Power", points: { pawn: "", knight: "", bishop: "", rook: "2", queen: "", king: "2" } }
    ]
  },
  {
    text: "If you have to trade your honour for wealth, will you do it?",
    options: [
      { text: "There is no such thing as honour. It's an excuse people use when they have lost in life.", points: { pawn: "", knight: "2", bishop: "2", rook: "", queen: "", king: "2" } },
      { text: "Wealth can be earned, but honour defines a person.", points: { pawn: "2", knight: "", bishop: "", rook: "2", queen: "2", king: "" } }
    ]
  },
  {
    text: "What do you think of rules and laws?",
    options: [
      { text: "They only serve one purpose: to control people and keep the rich free.", points: { pawn: "", knight: "1", bishop: "1", rook: "", queen: "1", king: "1" } },
      { text: "A perfect society needs its people to follow the laws. They are important for the growth of an individual.", points: { pawn: "1", knight: "", bishop: "", rook: "1", queen: "", king: "" } }
    ]
  },
  {
    text: "How important is it for a human being to seek connection?",
    options: [
      { text: "A person can succeed in life without the help of a single soul. Emotions like love or empathy make us weak.", points: { pawn: "", knight: "", bishop: "", rook: "3", queen: "", king: "3" } },
      { text: "We need connection and loved ones in life, but one should always put their career above them.", points: { pawn: "", knight: "", bishop: "3", rook: "", queen: "3", king: "" } },
      { text: "People and connections are everything. That's what makes us human: to see comfort, to understand, and to be understood.", points: { pawn: "3", knight: "3", bishop: "", rook: "", queen: "", king: "" } }
    ]
  }
];